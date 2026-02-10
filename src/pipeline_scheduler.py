"""
Pipeline Scheduler for Where2Eat.
Orchestrates automatic video discovery and processing.

This module ties together SubscriptionManager, VideoQueueManager,
PipelineLogger, and BackendService into a scheduled pipeline that:
1. Polls subscriptions for new YouTube videos
2. Enqueues discovered videos for processing
3. Processes queued videos through the analysis pipeline
4. Cleans up stale jobs and old logs
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict

from database import Database, get_database
from subscription_manager import SubscriptionManager
from video_queue_manager import VideoQueueManager
from pipeline_logger import PipelineLogger
from config import (
    PIPELINE_POLL_INTERVAL_HOURS,
    PIPELINE_PROCESS_INTERVAL_MINUTES,
    PIPELINE_MAX_INITIAL_VIDEOS,
    PIPELINE_STALE_TIMEOUT_HOURS,
    PIPELINE_LOG_RETENTION_DAYS,
    PIPELINE_SCHEDULER_ENABLED,
)

try:
    from apscheduler.schedulers.background import BackgroundScheduler
except ImportError:
    BackgroundScheduler = None

logger = logging.getLogger(__name__)


class PipelineScheduler:
    """Orchestrates automatic YouTube video discovery and processing.

    Uses APScheduler to run periodic jobs:
    - poll_subscriptions: checks YouTube channels for new videos
    - process_next_video: processes the next queued video
    - cleanup_stale_jobs: cleans up stuck processing jobs and old logs
    """

    def __init__(self, db: Database = None):
        """Initialize the pipeline scheduler.

        Args:
            db: Database instance. If None, uses the default database.
        """
        self.db = db or get_database()
        self.sub_manager = SubscriptionManager(self.db)
        self.queue_manager = VideoQueueManager(self.db)
        self.pipeline_logger = PipelineLogger(self.db)
        self._scheduler = None
        self._running = False
        self._backend_service = None

    def start(self):
        """Start the scheduler with APScheduler.

        No-op if PIPELINE_SCHEDULER_ENABLED is False.
        Creates interval jobs for poll, process, and cleanup.
        """
        if not PIPELINE_SCHEDULER_ENABLED:
            logger.info("Pipeline scheduler is disabled by configuration")
            return

        if BackgroundScheduler is None:
            logger.error("APScheduler is not installed; cannot start scheduler")
            return

        try:
            self._scheduler = BackgroundScheduler()

            # Poll subscriptions for new videos
            self._scheduler.add_job(
                self.poll_subscriptions,
                trigger='interval',
                hours=PIPELINE_POLL_INTERVAL_HOURS,
                id='poll_subscriptions',
                name='Poll YouTube subscriptions for new videos',
            )

            # Process next queued video
            self._scheduler.add_job(
                self.process_next_video,
                trigger='interval',
                minutes=PIPELINE_PROCESS_INTERVAL_MINUTES,
                id='process_next_video',
                name='Process next video in queue',
            )

            # Clean up stale processing jobs
            self._scheduler.add_job(
                self.cleanup_stale_jobs,
                trigger='interval',
                hours=PIPELINE_STALE_TIMEOUT_HOURS,
                id='cleanup_stale_jobs',
                name='Clean up stale processing jobs',
            )

            self._scheduler.start()
            self._running = True
            logger.info("Pipeline scheduler started")
        except Exception as e:
            logger.error("Failed to start pipeline scheduler: %s", e)
            self._running = False

    def stop(self):
        """Stop the scheduler gracefully."""
        if self._scheduler is not None:
            try:
                self._scheduler.shutdown()
                logger.info("Pipeline scheduler stopped")
            except Exception as e:
                logger.error("Error shutting down scheduler: %s", e)
        self._running = False
        self._scheduler = None

    def get_status(self) -> dict:
        """Return scheduler status.

        Returns:
            Dict with keys: running, scheduler_enabled, next_poll_at,
            next_process_at, queue_depth, currently_processing.
        """
        next_poll_at = None
        next_process_at = None

        if self._scheduler is not None and self._running:
            try:
                poll_job = self._scheduler.get_job('poll_subscriptions')
                if poll_job and poll_job.next_run_time:
                    next_poll_at = poll_job.next_run_time.isoformat()
            except Exception:
                pass

            try:
                process_job = self._scheduler.get_job('process_next_video')
                if process_job and process_job.next_run_time:
                    next_process_at = process_job.next_run_time.isoformat()
            except Exception:
                pass

        try:
            queue_depth = self.queue_manager.get_queue_depth()
        except Exception:
            queue_depth = 0

        try:
            currently_processing = len(self.queue_manager.get_processing())
        except Exception:
            currently_processing = 0

        return {
            'running': self._running,
            'scheduler_enabled': PIPELINE_SCHEDULER_ENABLED,
            'next_poll_at': next_poll_at,
            'next_process_at': next_process_at,
            'queue_depth': queue_depth,
            'currently_processing': currently_processing,
        }

    def poll_subscriptions(self):
        """Check all active subscriptions for new videos.

        For each active subscription:
        1. Fetch video list from YouTube (mock-friendly via _fetch_channel_videos)
        2. Filter out already-known videos (in episodes or queue)
        3. Enqueue new videos with subscription priority
        4. Update subscription stats and last_checked_at
        5. Log events
        """
        subscriptions = self.sub_manager.list_subscriptions(active_only=True)

        for sub in subscriptions:
            sub_id = sub['id']
            sub_name = sub.get('source_name') or sub.get('source_id', 'unknown')

            self.pipeline_logger.info(
                'poll_started',
                f'Polling subscription: {sub_name}',
                subscription_id=sub_id,
            )

            try:
                videos = self._fetch_channel_videos(sub)
            except Exception as e:
                logger.error("Error fetching videos for subscription %s: %s", sub_id, e)
                self.pipeline_logger.error(
                    'poll_error',
                    f'Failed to fetch videos for {sub_name}: {e}',
                    subscription_id=sub_id,
                )
                # Update last_checked_at even on failure so we don't hammer it
                self.sub_manager.update_subscription(
                    sub_id,
                    last_checked_at=datetime.utcnow().isoformat(),
                )
                continue

            # Determine if this is a first poll (no videos previously found)
            is_first_poll = (sub.get('total_videos_found', 0) == 0
                            and sub.get('last_checked_at') is None)

            # Cap the number of videos on first poll
            if is_first_poll and len(videos) > PIPELINE_MAX_INITIAL_VIDEOS:
                videos = videos[:PIPELINE_MAX_INITIAL_VIDEOS]

            enqueued_count = 0
            for video in videos:
                video_id = video.get('video_id')
                if not video_id:
                    continue

                # Check if already in queue
                try:
                    with self.db.get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            "SELECT id FROM video_queue WHERE video_id = ?",
                            (video_id,),
                        )
                        if cursor.fetchone():
                            continue
                except Exception:
                    pass

                # Check if already in episodes
                existing_episode = self.db.get_episode(video_id=video_id)
                if existing_episode is not None:
                    continue

                try:
                    self.queue_manager.enqueue(
                        video_id=video_id,
                        video_url=video.get('video_url', f'https://www.youtube.com/watch?v={video_id}'),
                        subscription_id=sub_id,
                        video_title=video.get('video_title'),
                        published_at=video.get('published_at'),
                        priority=sub.get('priority', 5),
                    )
                    enqueued_count += 1
                except ValueError:
                    # Video is already in queue (race condition guard)
                    pass
                except Exception as e:
                    logger.warning("Failed to enqueue video %s: %s", video_id, e)

            # Update subscription stats
            if enqueued_count > 0:
                self.sub_manager.update_stats(
                    sub_id,
                    videos_found=enqueued_count,
                )

            # Update last_checked_at
            self.sub_manager.update_subscription(
                sub_id,
                last_checked_at=datetime.utcnow().isoformat(),
            )

            self.pipeline_logger.info(
                'poll_completed',
                f'Poll completed for {sub_name}: {enqueued_count} new videos enqueued',
                subscription_id=sub_id,
                details={'videos_found': len(videos), 'enqueued': enqueued_count},
            )

    def process_next_video(self):
        """Process the next video in the queue.

        1. Dequeue highest-priority ready video
        2. Call BackendService.process_video()
        3. Mark completed or failed
        4. Update subscription stats
        5. Log events
        """
        item = self.queue_manager.dequeue()
        if item is None:
            return

        queue_id = item['id']
        video_url = item['video_url']
        video_id = item['video_id']
        subscription_id = item.get('subscription_id')

        self.pipeline_logger.info(
            'video_processing',
            f'Processing video: {video_id}',
            video_queue_id=queue_id,
            subscription_id=subscription_id,
        )

        try:
            backend = self._get_backend_service()
            result = backend.process_video(video_url=video_url)
        except Exception as e:
            error_msg = f'BackendService error: {e}'
            logger.error("Error processing video %s: %s", video_id, e)
            self.queue_manager.mark_failed(queue_id, error_msg)
            self.pipeline_logger.error(
                'video_failed',
                f'Video {video_id} processing failed: {error_msg}',
                video_queue_id=queue_id,
                subscription_id=subscription_id,
            )
            return

        if result.get('success'):
            restaurants_found = result.get('restaurants_found', 0)
            episode_id = result.get('episode_id')

            self.queue_manager.mark_completed(
                queue_id,
                restaurants_found=restaurants_found,
                episode_id=episode_id,
            )

            if subscription_id:
                self.sub_manager.update_stats(
                    subscription_id,
                    videos_processed=1,
                    restaurants_found=restaurants_found,
                )

            self.pipeline_logger.info(
                'video_completed',
                f'Video {video_id} processed: {restaurants_found} restaurants found',
                video_queue_id=queue_id,
                subscription_id=subscription_id,
                details={
                    'restaurants_found': restaurants_found,
                    'episode_id': episode_id,
                },
            )
        else:
            error_msg = result.get('error', 'Unknown processing error')
            self.queue_manager.mark_failed(queue_id, error_msg)

            self.pipeline_logger.error(
                'video_failed',
                f'Video {video_id} failed: {error_msg}',
                video_queue_id=queue_id,
                subscription_id=subscription_id,
            )

    def cleanup_stale_jobs(self):
        """Clean up stale processing jobs and old logs."""
        try:
            cleaned = self.queue_manager.cleanup_stale()
        except Exception as e:
            logger.error("Error cleaning up stale jobs: %s", e)
            cleaned = 0

        self.pipeline_logger.info(
            'stale_cleanup',
            f'Stale job cleanup: {cleaned} entries cleaned',
            details={'cleaned_count': cleaned},
        )

        # Also clean up old logs
        try:
            deleted_logs = self.pipeline_logger.cleanup(
                retention_days=PIPELINE_LOG_RETENTION_DAYS,
            )
            if deleted_logs > 0:
                logger.info("Cleaned up %d old log entries", deleted_logs)
        except Exception as e:
            logger.error("Error cleaning up old logs: %s", e)

    def _fetch_channel_videos(self, subscription: dict) -> List[dict]:
        """Fetch videos from a YouTube channel/playlist.

        Returns list of dicts: [{video_id, video_url, video_title, published_at}, ...]

        This method is separated to be easily mockable in tests.
        Uses YouTubeChannelCollector internally.
        """
        try:
            from youtube_channel_collector import YouTubeChannelCollector
            collector = YouTubeChannelCollector()

            source_url = subscription.get('source_url', '')
            videos_raw = collector.get_channel_videos(
                channel_url=source_url,
                max_results=PIPELINE_MAX_INITIAL_VIDEOS,
            )

            result = []
            for v in (videos_raw or []):
                vid = v.get('video_id')
                if vid:
                    result.append({
                        'video_id': vid,
                        'video_url': v.get('video_url', f'https://www.youtube.com/watch?v={vid}'),
                        'video_title': v.get('title', ''),
                        'published_at': v.get('published_at'),
                    })
            return result
        except ImportError:
            logger.error("YouTubeChannelCollector is not available")
            return []
        except Exception as e:
            raise

    def _get_backend_service(self):
        """Lazy-load BackendService (to avoid import issues in tests)."""
        if self._backend_service is None:
            from backend_service import BackendService
            self._backend_service = BackendService(db=self.db)
        return self._backend_service

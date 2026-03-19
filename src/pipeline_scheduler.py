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
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from urllib.request import urlopen, Request
from urllib.error import URLError

from database import Database, get_database
from subscription_manager import SubscriptionManager
from video_queue_manager import VideoQueueManager
from pipeline_logger import PipelineLogger
from config import (
    PIPELINE_POLL_INTERVAL_HOURS,
    PIPELINE_PROCESS_INTERVAL_MINUTES,
    PIPELINE_MAX_INITIAL_VIDEOS,
    PIPELINE_MAX_RECENT_VIDEOS,
    PIPELINE_MAX_VIDEO_AGE_DAYS,
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

    def start(self, force=False):
        """Start the scheduler with APScheduler.

        No-op if PIPELINE_SCHEDULER_ENABLED is False (unless force=True).
        Creates interval jobs for poll, process, and cleanup.
        """
        if not force and not PIPELINE_SCHEDULER_ENABLED:
            logger.info("Pipeline scheduler is disabled by configuration")
            return

        if BackgroundScheduler is None:
            logger.error("APScheduler is not installed; cannot start scheduler")
            return

        try:
            self._scheduler = BackgroundScheduler()

            # Poll subscriptions for new videos (run immediately on startup)
            self._scheduler.add_job(
                self.poll_subscriptions,
                trigger='interval',
                hours=PIPELINE_POLL_INTERVAL_HOURS,
                id='poll_subscriptions',
                name='Poll YouTube subscriptions for new videos',
                next_run_time=datetime.utcnow(),
            )

            # Process next queued video (run immediately on startup)
            self._scheduler.add_job(
                self.process_next_video,
                trigger='interval',
                minutes=PIPELINE_PROCESS_INTERVAL_MINUTES,
                id='process_next_video',
                name='Process next video in queue',
                next_run_time=datetime.utcnow(),
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

        if not subscriptions:
            logger.warning("No active subscriptions found — nothing to poll")
            self.pipeline_logger.warning(
                'poll_empty',
                'No active subscriptions configured. Add subscriptions via admin panel.',
            )
            return

        logger.info("Polling %d active subscription(s)", len(subscriptions))

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

            if not videos:
                logger.warning(
                    "Subscription %s (%s) returned 0 videos — "
                    "both RSS and yt-dlp may be failing",
                    sub_name, sub_id,
                )
                self.pipeline_logger.warning(
                    'poll_no_videos',
                    f'No videos returned for {sub_name} ({sub_id}). '
                    f'Check if the playlist/channel ID is correct.',
                    subscription_id=sub_id,
                )

            # Filter out videos older than the age cutoff
            videos = self._filter_by_age(videos)

            # Sort videos by published_at descending (most recent first).
            videos = self._sort_videos_by_date(videos)

            # Split into recent (to analyze) and old (beyond the recent cap)
            recent_videos = videos[:PIPELINE_MAX_RECENT_VIDEOS]

            enqueued_count = 0

            for video in recent_videos:
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
                details={
                    'videos_found': len(videos),
                    'enqueued': enqueued_count,
                },
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
            result = backend.process_video(
                video_url=video_url,
                enrich_with_google=True,
                published_at=item.get('published_at'),
            )
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

            log_level = 'info' if restaurants_found > 0 else 'warning'
            log_method = getattr(self.pipeline_logger, log_level)
            log_method(
                'video_completed',
                f'Video {video_id} processed: {restaurants_found} restaurants found',
                video_queue_id=queue_id,
                subscription_id=subscription_id,
                details={
                    'restaurants_found': restaurants_found,
                    'episode_id': episode_id,
                    'steps': result.get('steps', {}),
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

        # Clean up old videos beyond the age cutoff
        try:
            deleted_old = self.queue_manager.cleanup_old_videos()
            if deleted_old > 0:
                logger.info("Cleaned up %d old video queue entries", deleted_old)
        except Exception as e:
            logger.error("Error cleaning up old videos: %s", e)

        # Also clean up old logs
        try:
            deleted_logs = self.pipeline_logger.cleanup(
                retention_days=PIPELINE_LOG_RETENTION_DAYS,
            )
            if deleted_logs > 0:
                logger.info("Cleaned up %d old log entries", deleted_logs)
        except Exception as e:
            logger.error("Error cleaning up old logs: %s", e)

    def refresh_subscription(self, subscription_id: str) -> dict:
        """Refresh a subscription: fetch latest videos and queue new ones.

        Admin-triggered flow that:
        1. Fetches videos from the YouTube channel/playlist
        2. Sorts by published date, takes the N most recent
        3. Skips videos already processed successfully (in episodes DB)
        4. Queues new ones for processing
        5. Marks older videos as skipped for admin visibility

        Args:
            subscription_id: ID of the subscription to refresh.

        Returns:
            Dict with keys: enqueued, skipped_existing, skipped_old, total_fetched.
        """
        sub = self.sub_manager.get_subscription(subscription_id)
        if sub is None:
            raise ValueError(f"Subscription {subscription_id} not found")

        sub_name = sub.get('source_name') or sub.get('source_id', 'unknown')

        self.pipeline_logger.info(
            'refresh_started',
            f'Manual refresh for subscription: {sub_name}',
            subscription_id=subscription_id,
        )

        try:
            videos = self._fetch_channel_videos(sub)
        except Exception as e:
            self.pipeline_logger.error(
                'refresh_error',
                f'Failed to fetch videos for {sub_name}: {e}',
                subscription_id=subscription_id,
            )
            raise

        # Filter out videos older than the age cutoff, then sort
        videos = self._filter_by_age(videos)
        videos = self._sort_videos_by_date(videos)
        recent_videos = videos[:PIPELINE_MAX_RECENT_VIDEOS]

        enqueued = 0
        skipped_existing = 0

        for video in recent_videos:
            video_id = video.get('video_id')
            if not video_id:
                continue

            # Skip if already processed successfully
            existing_episode = self.db.get_episode(video_id=video_id)
            if existing_episode is not None:
                skipped_existing += 1
                continue

            # Skip if already in queue
            try:
                with self.db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "SELECT id FROM video_queue WHERE video_id = ?",
                        (video_id,),
                    )
                    if cursor.fetchone():
                        skipped_existing += 1
                        continue
            except Exception:
                pass

            try:
                self.queue_manager.enqueue(
                    video_id=video_id,
                    video_url=video.get('video_url', f'https://www.youtube.com/watch?v={video_id}'),
                    subscription_id=subscription_id,
                    video_title=video.get('video_title'),
                    published_at=video.get('published_at'),
                    priority=sub.get('priority', 5),
                )
                enqueued += 1
            except ValueError:
                skipped_existing += 1
            except Exception as e:
                logger.warning("Failed to enqueue video %s: %s", video_id, e)

        # Update subscription stats
        if enqueued > 0:
            self.sub_manager.update_stats(
                subscription_id,
                videos_found=enqueued,
            )

        self.sub_manager.update_subscription(
            subscription_id,
            last_checked_at=datetime.utcnow().isoformat(),
        )

        result = {
            'total_fetched': len(videos),
            'enqueued': enqueued,
            'skipped_existing': skipped_existing,
            'skipped_old': 0,
        }

        self.pipeline_logger.info(
            'refresh_completed',
            f'Refresh completed for {sub_name}: {enqueued} queued, '
            f'{skipped_existing} already processed',
            subscription_id=subscription_id,
            details=result,
        )

        return result

    @staticmethod
    def _filter_by_age(videos: List[dict]) -> List[dict]:
        """Filter out videos older than PIPELINE_MAX_VIDEO_AGE_DAYS.

        Videos without a valid published_at are INCLUDED — yt-dlp often
        cannot retrieve dates for playlist videos. Since we only fetch the
        most recent N videos from the playlist, position-based recency
        is sufficient.
        """
        cutoff = datetime.utcnow() - timedelta(days=PIPELINE_MAX_VIDEO_AGE_DAYS)
        cutoff_str = cutoff.isoformat()

        result = []
        for video in videos:
            date_str = video.get('published_at') or ''
            if not date_str:
                # No date — include (playlist order implies recency)
                result.append(video)
                continue
            if date_str >= cutoff_str:
                result.append(video)
        return result

    @staticmethod
    def _sort_videos_by_date(videos: List[dict]) -> List[dict]:
        """Sort videos by published_at descending (most recent first).

        Videos without a valid published_at are placed at the FRONT
        (treated as most recent), since yt-dlp often cannot retrieve
        dates for playlist videos and their position implies recency.
        """
        def sort_key(v):
            date_str = v.get('published_at') or ''
            if not date_str:
                # Sort undated videos to the front by using a far-future date
                return '9999-12-31T23:59:59'
            return date_str

        return sorted(videos, key=sort_key, reverse=True)

    def _fetch_channel_videos(self, subscription: dict) -> List[dict]:
        """Fetch videos from a YouTube channel or playlist.

        Returns list of dicts: [{video_id, video_url, video_title, published_at}, ...]

        This method is separated to be easily mockable in tests.

        Strategy: Try YouTube RSS feed first (works reliably from data
        centers), fall back to yt-dlp if RSS fails or returns no results.
        """
        source_type = subscription.get('source_type', '')
        source_id = subscription.get('source_id', '')

        if not source_id:
            source_url = subscription.get('source_url', '')
            if not source_url:
                logger.warning("No source_id or source_url for subscription %s",
                               subscription.get('id'))
                return []
            # Fall back to yt-dlp for unresolved URLs
            return self._fetch_videos_with_ytdlp(source_url)

        # Try RSS first (reliable from data centers, no API key needed)
        videos = self._fetch_videos_from_rss(source_type, source_id)
        if videos:
            logger.info("RSS feed returned %d videos for %s (%s)",
                        len(videos), source_id, source_type)
            return videos

        # Fall back to yt-dlp
        logger.info("RSS returned 0 videos for %s, falling back to yt-dlp", source_id)
        if source_type == 'playlist':
            url = f'https://www.youtube.com/playlist?list={source_id}'
        else:
            url = subscription.get('source_url', '')
            if not url:
                url = f'https://www.youtube.com/channel/{source_id}'
        return self._fetch_videos_with_ytdlp(url)

    def _fetch_videos_from_rss(self, source_type: str, source_id: str,
                                max_retries: int = 3) -> List[dict]:
        """Fetch videos from YouTube's public RSS/Atom feed.

        YouTube exposes RSS feeds for both channels and playlists:
        - Channel: https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
        - Playlist: https://www.youtube.com/feeds/videos.xml?playlist_id=PLAYLIST_ID

        These feeds are NOT blocked by YouTube's anti-bot measures (unlike
        yt-dlp scraping), making them reliable from data center IPs.

        Returns up to 15 most recent videos (YouTube RSS limit).

        Args:
            source_type: 'channel' or 'playlist'.
            source_id: YouTube channel or playlist ID.
            max_retries: Number of retry attempts for transient failures.

        Returns:
            List of video dicts, or empty list on failure.
        """
        if source_type == 'playlist':
            feed_url = f'https://www.youtube.com/feeds/videos.xml?playlist_id={source_id}'
        elif source_type == 'channel':
            feed_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={source_id}'
        else:
            logger.warning("RSS not supported for source_type=%s", source_type)
            return []

        for attempt in range(max_retries):
            try:
                req = Request(feed_url, headers={
                    'User-Agent': 'Where2Eat/1.0 (restaurant discovery)',
                })
                with urlopen(req, timeout=30) as response:
                    xml_data = response.read()

                return self._parse_youtube_rss(xml_data)

            except URLError as e:
                logger.warning("RSS fetch attempt %d/%d failed for %s: %s",
                               attempt + 1, max_retries, source_id, e)
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # 1s, 2s backoff
            except ET.ParseError as e:
                logger.error("RSS XML parse error for %s: %s", source_id, e)
                return []
            except Exception as e:
                logger.error("RSS unexpected error for %s: %s", source_id, e)
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)

        logger.warning("All %d RSS fetch attempts failed for %s", max_retries, source_id)
        return []

    @staticmethod
    def _parse_youtube_rss(xml_data: bytes) -> List[dict]:
        """Parse YouTube Atom feed XML into video dicts.

        YouTube's feed uses the Atom namespace with media extensions.
        Each <entry> contains the video ID in <yt:videoId>, title in <title>,
        and publication date in <published>.
        """
        ns = {
            'atom': 'http://www.w3.org/2005/Atom',
            'yt': 'http://www.youtube.com/xml/schemas/2015',
            'media': 'http://search.yahoo.com/mrss/',
        }

        root = ET.fromstring(xml_data)
        videos = []

        for entry in root.findall('atom:entry', ns):
            video_id_elem = entry.find('yt:videoId', ns)
            title_elem = entry.find('atom:title', ns)
            published_elem = entry.find('atom:published', ns)

            if video_id_elem is None:
                continue

            video_id = video_id_elem.text.strip()
            title = title_elem.text.strip() if title_elem is not None and title_elem.text else ''

            published_at = ''
            if published_elem is not None and published_elem.text:
                # Convert '2024-01-15T10:30:00+00:00' to '2024-01-15T10:30:00'
                raw = published_elem.text.strip()
                # Remove timezone suffix for consistency with yt-dlp format
                if '+' in raw:
                    published_at = raw[:raw.rfind('+')]
                elif raw.endswith('Z'):
                    published_at = raw[:-1]
                else:
                    published_at = raw

            videos.append({
                'video_id': video_id,
                'video_url': f'https://www.youtube.com/watch?v={video_id}',
                'video_title': title,
                'published_at': published_at,
            })

        return videos

    def _fetch_playlist_videos(self, subscription: dict) -> List[dict]:
        """Fetch videos from a YouTube playlist.

        Kept for backward compatibility with tests that mock this method.
        Delegates to _fetch_channel_videos which handles RSS + yt-dlp fallback.
        """
        return self._fetch_channel_videos(subscription)

    def _fetch_videos_with_ytdlp(self, url: str, max_videos: int = None) -> List[dict]:
        """Fetch video list from a YouTube URL using yt-dlp.

        Works for playlists, channels, and any YouTube URL containing
        multiple videos. Uses flat extraction (no download, no API key).

        This is the fallback method when RSS feeds don't work.

        Args:
            url: YouTube playlist or channel URL.
            max_videos: Max videos to fetch. None = use default (15).

        Returns:
            List of video dicts with video_id, video_url, video_title, published_at.
        """
        try:
            import yt_dlp

            ydl_opts = {
                'extract_flat': True,
                'quiet': True,
                'no_warnings': True,
            }
            fetch_limit = max_videos or 15
            ydl_opts['playlistend'] = fetch_limit

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)

            if not info:
                logger.warning("yt-dlp returned no info for %s", url)
                return []

            videos = []
            for entry in (info.get('entries') or []):
                video_id = entry.get('id')
                if video_id:
                    upload_date = entry.get('upload_date') or ''
                    if upload_date and len(upload_date) == 8:
                        upload_date = f'{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}'

                    videos.append({
                        'video_id': video_id,
                        'video_url': entry.get('url') or f'https://www.youtube.com/watch?v={video_id}',
                        'video_title': entry.get('title', ''),
                        'published_at': upload_date,
                    })

            logger.info("yt-dlp returned %d videos for %s", len(videos), url)
            return videos
        except ImportError:
            logger.error("yt-dlp is not installed. Install with: pip install yt-dlp")
            return []
        except Exception as e:
            logger.error("yt-dlp error fetching videos from %s: %s", url, e)
            return []

    def _get_backend_service(self):
        """Lazy-load BackendService (to avoid import issues in tests)."""
        if self._backend_service is None:
            from backend_service import BackendService
            self._backend_service = BackendService(db=self.db)
        return self._backend_service

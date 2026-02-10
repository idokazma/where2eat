"""
Tests for the PipelineScheduler module.
Verifies automatic video discovery, processing orchestration,
stale job cleanup, and scheduler lifecycle management.

TDD: Tests written first, implementation follows.
"""

import os
import sys
import pytest
import tempfile
import uuid
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from subscription_manager import SubscriptionManager
from video_queue_manager import VideoQueueManager
from pipeline_logger import PipelineLogger
from config import PIPELINE_MAX_INITIAL_VIDEOS


@pytest.fixture
def db():
    """Create a temporary test database."""
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, 'test.db')
        yield Database(db_path)


@pytest.fixture
def scheduler(db):
    """Create a PipelineScheduler with a test database."""
    from pipeline_scheduler import PipelineScheduler
    return PipelineScheduler(db=db)


@pytest.fixture
def subscription(db):
    """Create a test subscription and return its dict."""
    mgr = SubscriptionManager(db)
    sub = mgr.add_subscription(
        source_url='https://www.youtube.com/channel/UCtest123',
        source_name='Test Channel',
        priority=3,
        check_interval_hours=12,
    )
    return sub


def _make_video_list(video_ids):
    """Helper to build a list of video dicts from a list of IDs."""
    return [
        {
            'video_id': vid,
            'video_url': f'https://www.youtube.com/watch?v={vid}',
            'video_title': f'Title for {vid}',
            'published_at': datetime.utcnow().isoformat(),
        }
        for vid in video_ids
    ]


# ---------------------------------------------------------------------------
# TestPollSubscriptions
# ---------------------------------------------------------------------------
class TestPollSubscriptions:
    """Test the poll_subscriptions method."""

    def test_poll_discovers_new_videos_and_enqueues(self, scheduler, subscription, db):
        """Mock YT channel collector returning a video list, verify they are enqueued."""
        videos = _make_video_list(['vid_a', 'vid_b', 'vid_c'])

        with patch.object(scheduler, '_fetch_channel_videos', return_value=videos):
            scheduler.poll_subscriptions()

        queue_mgr = VideoQueueManager(db)
        depth = queue_mgr.get_queue_depth()
        assert depth == 3

    def test_poll_skips_already_known_videos(self, scheduler, subscription, db):
        """Videos already in episodes or queue are not re-enqueued."""
        # Create an episode for vid_existing so it is already known
        db.create_episode(
            video_id='vid_existing',
            video_url='https://www.youtube.com/watch?v=vid_existing',
        )

        # Also enqueue vid_queued so it is already in the queue
        queue_mgr = VideoQueueManager(db)
        queue_mgr.enqueue(
            video_id='vid_queued',
            video_url='https://www.youtube.com/watch?v=vid_queued',
        )

        videos = _make_video_list(['vid_existing', 'vid_queued', 'vid_new'])

        with patch.object(scheduler, '_fetch_channel_videos', return_value=videos):
            scheduler.poll_subscriptions()

        # Only vid_new should have been newly enqueued; vid_queued was already
        # there, and vid_existing gets auto-skipped by the enqueue method.
        # The queue should contain vid_queued (original) + vid_new = 2 queued.
        # vid_existing will be inserted as 'skipped' by enqueue().
        depth = queue_mgr.get_queue_depth()
        assert depth == 2  # vid_queued + vid_new

    def test_poll_respects_max_initial_videos(self, scheduler, subscription, db):
        """First poll caps at PIPELINE_MAX_INITIAL_VIDEOS."""
        # Generate more videos than the cap
        count = PIPELINE_MAX_INITIAL_VIDEOS + 20
        video_ids = [f'vid_{i:04d}' for i in range(count)]
        videos = _make_video_list(video_ids)

        with patch.object(scheduler, '_fetch_channel_videos', return_value=videos):
            scheduler.poll_subscriptions()

        queue_mgr = VideoQueueManager(db)
        depth = queue_mgr.get_queue_depth()
        assert depth == PIPELINE_MAX_INITIAL_VIDEOS

    def test_poll_updates_subscription_last_checked(self, scheduler, subscription, db):
        """last_checked_at is updated after poll."""
        assert subscription['last_checked_at'] is None

        with patch.object(scheduler, '_fetch_channel_videos', return_value=[]):
            scheduler.poll_subscriptions()

        mgr = SubscriptionManager(db)
        updated = mgr.get_subscription(subscription['id'])
        assert updated['last_checked_at'] is not None

    def test_poll_updates_subscription_stats(self, scheduler, subscription, db):
        """total_videos_found is incremented after poll."""
        videos = _make_video_list(['vid_x', 'vid_y'])

        with patch.object(scheduler, '_fetch_channel_videos', return_value=videos):
            scheduler.poll_subscriptions()

        mgr = SubscriptionManager(db)
        updated = mgr.get_subscription(subscription['id'])
        assert updated['total_videos_found'] == 2

    def test_poll_logs_events(self, scheduler, subscription, db):
        """poll_started and poll_completed events are logged."""
        videos = _make_video_list(['vid_log'])

        with patch.object(scheduler, '_fetch_channel_videos', return_value=videos):
            scheduler.poll_subscriptions()

        pl = PipelineLogger(db)
        logs = pl.get_logs(event_type='poll_started')
        assert logs['total'] >= 1

        logs = pl.get_logs(event_type='poll_completed')
        assert logs['total'] >= 1

    def test_poll_handles_playlist_subscription(self, scheduler, db):
        """Playlist subscriptions use _fetch_playlist_videos."""
        mgr = SubscriptionManager(db)
        sub = mgr.add_subscription(
            source_url='https://www.youtube.com/playlist?list=PLtest123',
            source_name='Test Playlist',
            priority=3,
        )

        videos = _make_video_list(['pl_vid_1', 'pl_vid_2'])

        with patch.object(
            scheduler, '_fetch_playlist_videos', return_value=videos
        ) as mock_fetch_playlist:
            scheduler.poll_subscriptions()

        # _fetch_playlist_videos should have been called (via _fetch_channel_videos dispatch)
        mock_fetch_playlist.assert_called_once()
        call_arg = mock_fetch_playlist.call_args[0][0]
        assert call_arg['source_type'] == 'playlist'
        assert call_arg['source_id'] == 'PLtest123'

        # Videos should be enqueued
        queue_mgr = VideoQueueManager(db)
        depth = queue_mgr.get_queue_depth()
        assert depth == 2

    def test_poll_handles_api_error_gracefully(self, scheduler, db):
        """If YT API fails, logs error, continues to next subscription."""
        # Create two subscriptions
        mgr = SubscriptionManager(db)
        sub1 = mgr.add_subscription(
            source_url='https://www.youtube.com/channel/UCfail',
            source_name='Failing Channel',
        )
        sub2 = mgr.add_subscription(
            source_url='https://www.youtube.com/channel/UCsucceed',
            source_name='Good Channel',
        )

        call_count = {'n': 0}

        def mock_fetch(subscription):
            call_count['n'] += 1
            if subscription['source_id'] == 'UCfail':
                raise Exception('API quota exceeded')
            return _make_video_list(['vid_good'])

        with patch.object(scheduler, '_fetch_channel_videos', side_effect=mock_fetch):
            scheduler.poll_subscriptions()

        # Both subscriptions should have been attempted
        assert call_count['n'] == 2

        # An error log should exist
        pl = PipelineLogger(db)
        error_logs = pl.get_logs(level='error')
        assert error_logs['total'] >= 1

        # The good subscription's video should still have been enqueued
        queue_mgr = VideoQueueManager(db)
        depth = queue_mgr.get_queue_depth()
        assert depth >= 1


# ---------------------------------------------------------------------------
# TestProcessNextVideo
# ---------------------------------------------------------------------------
class TestProcessNextVideo:
    """Test the process_next_video method."""

    def _enqueue_video(self, db, video_id='vid_proc', subscription_id=None):
        """Helper to enqueue a video for processing."""
        queue_mgr = VideoQueueManager(db)
        entry = queue_mgr.enqueue(
            video_id=video_id,
            video_url=f'https://www.youtube.com/watch?v={video_id}',
            video_title=f'Title {video_id}',
            subscription_id=subscription_id,
        )
        return entry

    def test_process_dequeues_and_calls_backend(self, scheduler, db):
        """Dequeues video, calls BackendService.process_video."""
        self._enqueue_video(db)

        mock_backend = Mock()
        mock_backend.process_video.return_value = {
            'success': True,
            'episode_id': 'ep_001',
            'restaurants': [{'name_hebrew': 'Test'}],
            'restaurants_found': 1,
        }

        with patch.object(scheduler, '_get_backend_service', return_value=mock_backend):
            scheduler.process_next_video()

        mock_backend.process_video.assert_called_once()
        call_args = mock_backend.process_video.call_args
        assert 'vid_proc' in call_args[1].get('video_url', call_args[0][0] if call_args[0] else '')

    def test_process_marks_completed_on_success(self, scheduler, db):
        """On success, marks completed with restaurant count."""
        entry = self._enqueue_video(db)

        mock_backend = Mock()
        mock_backend.process_video.return_value = {
            'success': True,
            'episode_id': 'ep_002',
            'restaurants': [{'name_hebrew': 'R1'}, {'name_hebrew': 'R2'}],
            'restaurants_found': 2,
        }

        with patch.object(scheduler, '_get_backend_service', return_value=mock_backend):
            scheduler.process_next_video()

        queue_mgr = VideoQueueManager(db)
        # Queue should be empty (completed items are not 'queued')
        assert queue_mgr.get_queue_depth() == 0

        # Check history for completed item
        history = queue_mgr.get_history()
        completed = [i for i in history['items'] if i['status'] == 'completed']
        assert len(completed) == 1
        assert completed[0]['restaurants_found'] == 2

    def test_process_marks_failed_on_error(self, scheduler, db):
        """On error, marks failed with error message."""
        self._enqueue_video(db)

        mock_backend = Mock()
        mock_backend.process_video.return_value = {
            'success': False,
            'error': 'Transcript not available',
        }

        with patch.object(scheduler, '_get_backend_service', return_value=mock_backend):
            scheduler.process_next_video()

        queue_mgr = VideoQueueManager(db)
        # With retries, the video may be re-queued or marked as failed.
        # Check that the item is not still in 'processing' state.
        processing = queue_mgr.get_processing()
        assert len(processing) == 0

    def test_process_updates_subscription_stats(self, scheduler, subscription, db):
        """Updates processed count and restaurant count on the subscription."""
        self._enqueue_video(db, subscription_id=subscription['id'])

        mock_backend = Mock()
        mock_backend.process_video.return_value = {
            'success': True,
            'episode_id': 'ep_003',
            'restaurants': [{'name_hebrew': 'R1'}],
            'restaurants_found': 1,
        }

        with patch.object(scheduler, '_get_backend_service', return_value=mock_backend):
            scheduler.process_next_video()

        mgr = SubscriptionManager(db)
        updated = mgr.get_subscription(subscription['id'])
        assert updated['total_videos_processed'] >= 1
        assert updated['total_restaurants_found'] >= 1

    def test_process_does_nothing_when_queue_empty(self, scheduler, db):
        """Returns gracefully when nothing to process."""
        mock_backend = Mock()

        with patch.object(scheduler, '_get_backend_service', return_value=mock_backend):
            # Should not raise
            scheduler.process_next_video()

        mock_backend.process_video.assert_not_called()

    def test_process_logs_events(self, scheduler, db):
        """video_processing and video_completed events are logged."""
        self._enqueue_video(db)

        mock_backend = Mock()
        mock_backend.process_video.return_value = {
            'success': True,
            'episode_id': 'ep_log',
            'restaurants': [],
            'restaurants_found': 0,
        }

        with patch.object(scheduler, '_get_backend_service', return_value=mock_backend):
            scheduler.process_next_video()

        pl = PipelineLogger(db)
        processing_logs = pl.get_logs(event_type='video_processing')
        assert processing_logs['total'] >= 1

        completed_logs = pl.get_logs(event_type='video_completed')
        assert completed_logs['total'] >= 1


# ---------------------------------------------------------------------------
# TestCleanupStaleJobs
# ---------------------------------------------------------------------------
class TestCleanupStaleJobs:
    """Test the cleanup_stale_jobs method."""

    def test_cleanup_marks_stale_as_failed(self, scheduler, db):
        """Calls queue.cleanup_stale() and stale items are cleaned up."""
        queue_mgr = VideoQueueManager(db)

        # Enqueue and dequeue to get a 'processing' item
        queue_mgr.enqueue(
            video_id='vid_stale',
            video_url='https://www.youtube.com/watch?v=vid_stale',
        )
        item = queue_mgr.dequeue()
        assert item is not None

        # Backdate the processing_started_at to simulate staleness
        with db.get_connection() as conn:
            cursor = conn.cursor()
            stale_time = (datetime.utcnow() - timedelta(hours=10)).isoformat()
            cursor.execute(
                "UPDATE video_queue SET processing_started_at = ? WHERE id = ?",
                (stale_time, item['id']),
            )

        scheduler.cleanup_stale_jobs()

        # The item should now be failed
        updated = queue_mgr.get_video(item['id'])
        assert updated['status'] == 'failed'

    def test_cleanup_logs_count(self, scheduler, db):
        """Logs the number of cleaned up entries."""
        scheduler.cleanup_stale_jobs()

        pl = PipelineLogger(db)
        logs = pl.get_logs(event_type='stale_cleanup')
        assert logs['total'] >= 1


# ---------------------------------------------------------------------------
# TestSchedulerLifecycle
# ---------------------------------------------------------------------------
class TestSchedulerLifecycle:
    """Test scheduler start/stop/status lifecycle."""

    def test_scheduler_start_creates_jobs(self, scheduler):
        """scheduler.start() registers poll, process, cleanup jobs."""
        with patch('pipeline_scheduler.BackgroundScheduler') as MockSchedulerClass:
            mock_sched = MagicMock()
            MockSchedulerClass.return_value = mock_sched

            scheduler.start()

            # The APScheduler should have been started
            mock_sched.start.assert_called_once()

            # Three interval jobs should have been added
            assert mock_sched.add_job.call_count == 3

            # Verify the scheduler is marked as running
            assert scheduler._running is True

    def test_scheduler_stop(self, scheduler):
        """scheduler.stop() shuts down cleanly."""
        with patch('pipeline_scheduler.BackgroundScheduler') as MockSchedulerClass:
            mock_sched = MagicMock()
            MockSchedulerClass.return_value = mock_sched

            scheduler.start()
            scheduler.stop()

            mock_sched.shutdown.assert_called_once()
            assert scheduler._running is False

    def test_scheduler_status(self, scheduler, db):
        """get_status() returns running, next_poll, next_process, queue_depth."""
        status = scheduler.get_status()

        assert 'running' in status
        assert 'scheduler_enabled' in status
        assert 'next_poll_at' in status
        assert 'next_process_at' in status
        assert 'queue_depth' in status
        assert 'currently_processing' in status

        assert status['running'] is False
        assert isinstance(status['queue_depth'], int)

    def test_scheduler_disabled_by_config(self, db):
        """When PIPELINE_SCHEDULER_ENABLED=False, start() is a no-op."""
        from pipeline_scheduler import PipelineScheduler

        with patch('pipeline_scheduler.PIPELINE_SCHEDULER_ENABLED', False):
            sched = PipelineScheduler(db=db)
            with patch('pipeline_scheduler.BackgroundScheduler') as MockSchedulerClass:
                sched.start()
                MockSchedulerClass.assert_not_called()

            assert sched._running is False

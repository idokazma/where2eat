"""
Integration tests for the auto video fetching pipeline.
Tests the flow: subscription → queue → process lifecycle with logging.
"""

import os
import sys
import pytest
import tempfile
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from subscription_manager import SubscriptionManager
from video_queue_manager import VideoQueueManager
from pipeline_logger import PipelineLogger


@pytest.fixture
def db():
    """Create a temporary test database."""
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, 'test.db')
        yield Database(db_path)


@pytest.fixture
def managers(db):
    """Create all pipeline managers."""
    return {
        'sub': SubscriptionManager(db),
        'queue': VideoQueueManager(db),
        'logger': PipelineLogger(db),
        'db': db,
    }


class TestSubscriptionToQueueFlow:
    """Test adding a subscription then queuing videos from it."""

    def test_add_subscription_then_enqueue_videos(self, managers):
        """Full flow: add subscription, enqueue videos, verify queue state."""
        sub = managers['sub']
        queue = managers['queue']

        subscription = sub.add_subscription(
            source_url='https://www.youtube.com/channel/UC1234567890abcdef12345',
            source_name='Test Channel',
            priority=2
        )

        assert subscription['source_type'] == 'channel'
        assert subscription['priority'] == 2

        v1 = queue.enqueue(
            video_id='vid_001',
            video_url='https://www.youtube.com/watch?v=vid_001',
            subscription_id=subscription['id'],
            video_title='Video 1',
            channel_name='Test Channel',
            priority=subscription['priority']
        )
        v2 = queue.enqueue(
            video_id='vid_002',
            video_url='https://www.youtube.com/watch?v=vid_002',
            subscription_id=subscription['id'],
            video_title='Video 2',
            channel_name='Test Channel',
            priority=subscription['priority']
        )

        assert v1['status'] == 'queued'
        assert v2['status'] == 'queued'
        assert queue.get_queue_depth() == 2

    def test_enqueue_skips_already_processed_episodes(self, managers):
        """Videos already in episodes table are skipped."""
        sub = managers['sub']
        queue = managers['queue']
        db = managers['db']

        subscription = sub.add_subscription(
            source_url='https://www.youtube.com/@testchannel',
            source_name='Test'
        )

        db.create_episode(
            video_id='already_done',
            video_url='https://www.youtube.com/watch?v=already_done',
            title='Already Processed'
        )

        entry = queue.enqueue(
            video_id='already_done',
            video_url='https://www.youtube.com/watch?v=already_done',
            subscription_id=subscription['id']
        )

        assert entry['status'] == 'skipped'
        assert queue.get_queue_depth() == 0


class TestQueueProcessingLifecycle:
    """Test the full dequeue, process, complete/fail lifecycle."""

    def test_dequeue_process_complete(self, managers):
        """Dequeue a video, simulate processing, mark complete."""
        queue = managers['queue']
        logger = managers['logger']

        queue.enqueue(
            video_id='proc_001',
            video_url='https://www.youtube.com/watch?v=proc_001',
            video_title='Process Me'
        )

        video = queue.dequeue()
        assert video is not None
        assert video['video_id'] == 'proc_001'
        assert video['status'] == 'processing'

        logger.info('video_processing', f'Processing: {video["video_title"]}',
                     video_queue_id=video['id'])

        queue.mark_completed(video['id'], restaurants_found=3, episode_id='ep_001')

        completed = queue.get_video(video['id'])
        assert completed['status'] == 'completed'
        assert completed['restaurants_found'] == 3

        logs = logger.get_logs(event_type='video_processing')
        assert logs['total'] == 1

    def test_dequeue_process_fail_retry(self, managers):
        """Dequeue a video, fail it, verify it gets requeued for retry."""
        queue = managers['queue']
        logger = managers['logger']

        queue.enqueue(
            video_id='fail_001',
            video_url='https://www.youtube.com/watch?v=fail_001',
            video_title='Will Fail'
        )

        video = queue.dequeue()
        queue.mark_failed(video['id'], 'Transcript unavailable')
        logger.error('video_failed', 'Failed: Transcript unavailable',
                      video_queue_id=video['id'])

        updated = queue.get_video(video['id'])
        assert updated['status'] == 'queued'
        assert updated['attempt_count'] == 1
        assert queue.get_queue_depth() == 1

    def test_permanent_failure_after_max_attempts(self, managers):
        """After max attempts, video is permanently failed."""
        queue = managers['queue']

        queue.enqueue(
            video_id='perm_fail',
            video_url='https://www.youtube.com/watch?v=perm_fail',
            video_title='Permanent Failure'
        )

        for i in range(3):
            video = queue.get_video(
                queue.get_queue(limit=1)['items'][0]['id']
            )
            with queue.db.get_connection() as conn:
                conn.execute(
                    "UPDATE video_queue SET status='processing', scheduled_for=? WHERE id=?",
                    (datetime.utcnow().isoformat(), video['id'])
                )
            queue.mark_failed(video['id'], f'Error attempt {i+1}')

        final = queue.get_video(video['id'])
        assert final['status'] == 'failed'
        assert final['attempt_count'] == 3
        assert queue.get_queue_depth() == 0


class TestSubscriptionStatsTracking:
    """Test that stats accumulate correctly across the pipeline."""

    def test_stats_update_after_processing(self, managers):
        """Subscription stats increment after videos are processed."""
        sub = managers['sub']
        queue = managers['queue']
        db = managers['db']

        subscription = sub.add_subscription(
            source_url='https://www.youtube.com/channel/UCstats_test_123456789',
            source_name='Stats Test'
        )

        sub.update_stats(subscription['id'], videos_found=2)

        # Enqueue both with scheduled_for in the past so they're immediately available
        now = datetime.utcnow().isoformat()
        queue.enqueue(
            video_id='stats_v1',
            video_url='https://www.youtube.com/watch?v=stats_v1',
            subscription_id=subscription['id']
        )
        queue.enqueue(
            video_id='stats_v2',
            video_url='https://www.youtube.com/watch?v=stats_v2',
            subscription_id=subscription['id']
        )

        # Force both to be immediately available by setting scheduled_for to past
        with db.get_connection() as conn:
            conn.execute("UPDATE video_queue SET scheduled_for = ?", (now,))

        v1 = queue.dequeue()
        queue.mark_completed(v1['id'], restaurants_found=3)
        sub.update_stats(subscription['id'], videos_processed=1, restaurants_found=3)

        v2 = queue.dequeue()
        assert v2 is not None, "Second video should be dequeueable"
        queue.mark_completed(v2['id'], restaurants_found=2)
        sub.update_stats(subscription['id'], videos_processed=1, restaurants_found=2)

        updated_sub = sub.get_subscription(subscription['id'])
        assert updated_sub['total_videos_found'] == 2
        assert updated_sub['total_videos_processed'] == 2
        assert updated_sub['total_restaurants_found'] == 5


class TestPipelineWithLogging:
    """Test that the full pipeline generates appropriate logs."""

    def test_full_pipeline_logs(self, managers):
        """Full pipeline generates correct log trail."""
        sub = managers['sub']
        queue = managers['queue']
        logger = managers['logger']

        subscription = sub.add_subscription(
            source_url='https://www.youtube.com/channel/UClog_test_12345678901',
            source_name='Log Test Channel'
        )
        logger.info('subscription_added', 'Added: Log Test Channel',
                     subscription_id=subscription['id'])

        logger.info('poll_started', 'Polling 1 subscription')
        logger.info('video_queued', 'New video discovered',
                     subscription_id=subscription['id'],
                     details={'video_id': 'log_v1', 'title': 'Test Video'})

        queue.enqueue(
            video_id='log_v1',
            video_url='https://www.youtube.com/watch?v=log_v1',
            subscription_id=subscription['id'],
            video_title='Test Video'
        )

        logger.info('poll_completed', 'Found 1 new video',
                     subscription_id=subscription['id'])

        video = queue.dequeue()
        logger.info('video_processing', f'Starting: {video["video_title"]}',
                     video_queue_id=video['id'])

        queue.mark_completed(video['id'], restaurants_found=5)
        logger.info('video_completed', 'Done: 5 restaurants',
                     video_queue_id=video['id'],
                     details={'restaurants_found': 5})

        all_logs = logger.get_logs(limit=100)
        assert all_logs['total'] == 6

        event_types = [log['event_type'] for log in all_logs['items']]
        assert 'subscription_added' in event_types
        assert 'poll_started' in event_types
        assert 'video_queued' in event_types
        assert 'poll_completed' in event_types
        assert 'video_processing' in event_types
        assert 'video_completed' in event_types

        counts = logger.get_event_counts(days=1)
        assert counts.get('video_completed', 0) == 1
        assert counts.get('poll_started', 0) == 1


class TestDatabaseSchemaIntegrity:
    """Test that the new tables exist and have correct structure."""

    def test_new_tables_exist(self, db):
        """Verify subscriptions, video_queue, pipeline_logs tables exist."""
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row['name'] for row in cursor.fetchall()]

            assert 'subscriptions' in tables
            assert 'video_queue' in tables
            assert 'pipeline_logs' in tables

    def test_new_indexes_exist(self, db):
        """Verify indexes on new tables."""
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='index'")
            indexes = [row['name'] for row in cursor.fetchall()]

            assert 'idx_subscriptions_is_active' in indexes
            assert 'idx_video_queue_status' in indexes
            assert 'idx_video_queue_video_id' in indexes
            assert 'idx_pipeline_logs_timestamp' in indexes
            assert 'idx_pipeline_logs_event_type' in indexes


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

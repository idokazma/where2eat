"""
Tests for the VideoQueueManager - manages video processing queue.
TDD: Tests written first, implementation follows.
"""

import os
import sys
import pytest
import tempfile
import json
from datetime import datetime, timedelta
import uuid

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from video_queue_manager import VideoQueueManager
from config import (
    PIPELINE_PROCESS_INTERVAL_MINUTES,
    PIPELINE_MAX_RETRY_ATTEMPTS,
    PIPELINE_STALE_TIMEOUT_HOURS,
)


@pytest.fixture
def db():
    """Create a temporary test database."""
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, 'test.db')
        yield Database(db_path)


@pytest.fixture
def manager(db):
    """Create a VideoQueueManager with a test database."""
    return VideoQueueManager(db)


@pytest.fixture
def db_with_subscription(db):
    """Create database with a subscription entry that has priority=2."""
    sub_id = str(uuid.uuid4())
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO subscriptions (id, source_type, source_url, source_id, source_name, priority)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (sub_id, 'channel', 'https://youtube.com/@test', 'UC_test123', 'Test Channel', 2))
    return db, sub_id


class TestEnqueueVideo:
    """Test video enqueue operations."""

    def test_enqueue_new_video(self, db, manager):
        """Adding a video to the queue creates an entry with status='queued'."""
        entry = manager.enqueue(
            video_id='vid001',
            video_url='https://youtube.com/watch?v=vid001',
            video_title='Test Video'
        )

        assert entry['status'] == 'queued'
        assert entry['video_id'] == 'vid001'
        assert entry['video_url'] == 'https://youtube.com/watch?v=vid001'
        assert entry['video_title'] == 'Test Video'
        assert entry['id'] is not None

    def test_enqueue_sets_scheduled_for(self, db, manager):
        """Enqueued video gets a valid scheduled_for timestamp."""
        entry = manager.enqueue(
            video_id='vid002',
            video_url='https://youtube.com/watch?v=vid002'
        )

        assert entry['scheduled_for'] is not None
        # scheduled_for should be parseable as a datetime
        scheduled = datetime.fromisoformat(entry['scheduled_for'])
        assert isinstance(scheduled, datetime)

    def test_enqueue_inherits_subscription_priority(self, db_with_subscription):
        """When subscription_id is provided, priority comes from the subscription."""
        db, sub_id = db_with_subscription
        mgr = VideoQueueManager(db)

        entry = mgr.enqueue(
            video_id='vid003',
            video_url='https://youtube.com/watch?v=vid003',
            subscription_id=sub_id
        )

        assert entry['priority'] == 2

    def test_enqueue_skips_already_processed_video(self, db, manager):
        """If video_id exists in episodes table, enqueue marks it as 'skipped'."""
        db.create_episode(
            video_id='processed001',
            video_url='https://youtube.com/watch?v=processed001'
        )

        entry = manager.enqueue(
            video_id='processed001',
            video_url='https://youtube.com/watch?v=processed001'
        )

        assert entry['status'] == 'skipped'

    def test_enqueue_duplicate_video_id_raises(self, db, manager):
        """Enqueuing the same video_id twice raises ValueError."""
        manager.enqueue(
            video_id='dup001',
            video_url='https://youtube.com/watch?v=dup001'
        )

        with pytest.raises(ValueError):
            manager.enqueue(
                video_id='dup001',
                video_url='https://youtube.com/watch?v=dup001'
            )

    def test_enqueue_multiple_videos_sequential_scheduling(self, db, manager):
        """Each enqueued video is scheduled PIPELINE_PROCESS_INTERVAL_MINUTES apart."""
        entries = []
        for i in range(3):
            entry = manager.enqueue(
                video_id=f'seq{i:03d}',
                video_url=f'https://youtube.com/watch?v=seq{i:03d}'
            )
            entries.append(entry)

        for i in range(1, len(entries)):
            prev_time = datetime.fromisoformat(entries[i - 1]['scheduled_for'])
            curr_time = datetime.fromisoformat(entries[i]['scheduled_for'])
            diff_minutes = (curr_time - prev_time).total_seconds() / 60
            assert diff_minutes == pytest.approx(PIPELINE_PROCESS_INTERVAL_MINUTES, abs=1)


class TestDequeueVideo:
    """Test video dequeue operations."""

    def test_dequeue_returns_highest_priority(self, db, manager):
        """Dequeue returns the video with the lowest priority number first."""
        manager.enqueue(video_id='low', video_url='url_low', priority=10)
        manager.enqueue(video_id='high', video_url='url_high', priority=1)

        # Set both scheduled_for to past so they are eligible
        past = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET scheduled_for = ?",
                (past,)
            )

        result = manager.dequeue()
        assert result is not None
        assert result['video_id'] == 'high'
        assert result['priority'] == 1

    def test_dequeue_returns_none_when_empty(self, db, manager):
        """Dequeue returns None when the queue is empty."""
        result = manager.dequeue()
        assert result is None

    def test_dequeue_respects_scheduled_for(self, db, manager):
        """Dequeue does not return videos scheduled in the future."""
        manager.enqueue(video_id='future', video_url='url_future')

        # Set scheduled_for to far in the future
        future = (datetime.utcnow() + timedelta(hours=24)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET scheduled_for = ?",
                (future,)
            )

        result = manager.dequeue()
        assert result is None

    def test_dequeue_skips_non_queued_statuses(self, db, manager):
        """Dequeue only returns videos with status='queued'."""
        manager.enqueue(video_id='proc', video_url='url_proc')

        past = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET status = 'processing', scheduled_for = ?",
                (past,)
            )

        result = manager.dequeue()
        assert result is None

    def test_dequeue_marks_as_processing(self, db, manager):
        """Dequeue sets status to 'processing' and records processing_started_at."""
        manager.enqueue(video_id='toprocess', video_url='url_toprocess')

        past = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET scheduled_for = ?",
                (past,)
            )

        result = manager.dequeue()
        assert result is not None
        assert result['status'] == 'processing'
        assert result['processing_started_at'] is not None

        # Verify persisted in database
        video = manager.get_video(result['id'])
        assert video['status'] == 'processing'


class TestCompleteVideo:
    """Test marking videos as completed."""

    def test_mark_completed(self, db, manager):
        """mark_completed sets status, processing_completed_at, and restaurants_found."""
        entry = manager.enqueue(video_id='comp1', video_url='url_comp1')

        result = manager.mark_completed(entry['id'], restaurants_found=5)
        assert result is True

        video = manager.get_video(entry['id'])
        assert video['status'] == 'completed'
        assert video['processing_completed_at'] is not None
        assert video['restaurants_found'] == 5

    def test_mark_completed_sets_episode_id(self, db, manager):
        """mark_completed links to the created episode via episode_id."""
        entry = manager.enqueue(video_id='comp2', video_url='url_comp2')
        episode_id = db.create_episode(
            video_id='comp2',
            video_url='url_comp2'
        )

        manager.mark_completed(entry['id'], restaurants_found=3, episode_id=episode_id)

        video = manager.get_video(entry['id'])
        assert video['episode_id'] == episode_id


class TestFailVideo:
    """Test marking videos as failed."""

    def test_mark_failed_with_retries_left(self, db, manager):
        """First failure increments attempt_count and requeues the video."""
        entry = manager.enqueue(video_id='fail1', video_url='url_fail1')

        result = manager.mark_failed(entry['id'], error_message='Transcript fetch failed')
        assert result is True

        video = manager.get_video(entry['id'])
        assert video['attempt_count'] == 1
        assert video['status'] == 'queued'  # Requeued for retry
        assert video['scheduled_for'] is not None

    def test_mark_failed_max_attempts_reached(self, db, manager):
        """After max attempts, the video is permanently marked as 'failed'."""
        entry = manager.enqueue(video_id='fail2', video_url='url_fail2')

        # Fail up to max attempts
        for i in range(PIPELINE_MAX_RETRY_ATTEMPTS):
            manager.mark_failed(entry['id'], error_message=f'Failure {i + 1}')

        video = manager.get_video(entry['id'])
        assert video['status'] == 'failed'
        assert video['attempt_count'] == PIPELINE_MAX_RETRY_ATTEMPTS

    def test_mark_failed_stores_error(self, db, manager):
        """error_message and error_log are updated on failure."""
        entry = manager.enqueue(video_id='fail3', video_url='url_fail3')

        manager.mark_failed(entry['id'], error_message='Something broke')

        video = manager.get_video(entry['id'])
        assert video['error_message'] == 'Something broke'

        error_log = json.loads(video['error_log'])
        assert len(error_log) == 1
        assert error_log[0]['message'] == 'Something broke'

    def test_mark_failed_permanent_failure_skips(self, db, manager):
        """Videos with permanent failures are skipped, not retried."""
        permanent_errors = [
            "Transcript not available for this video",
            "Video unavailable",
            "Private video - cannot access",
            "Sign in to confirm your age to view",
        ]

        for i, error_msg in enumerate(permanent_errors):
            entry = manager.enqueue(
                video_id=f'perm_fail_{i}',
                video_url=f'https://youtube.com/watch?v=perm_fail_{i}',
            )

            # Dequeue so status is 'processing' (simulating real flow)
            past = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
            with db.get_connection() as conn:
                conn.execute(
                    "UPDATE video_queue SET scheduled_for = ? WHERE id = ?",
                    (past, entry['id']),
                )
            dequeued = manager.dequeue()
            assert dequeued is not None

            result = manager.mark_failed(dequeued['id'], error_msg)
            assert result is True

            video = manager.get_video(dequeued['id'])
            assert video['status'] == 'skipped', (
                f"Expected 'skipped' for error '{error_msg}', got '{video['status']}'"
            )
            # Should NOT be requeued
            assert video['status'] != 'queued'

    def test_retry_backoff_calculation(self, db, manager):
        """Backoff increases exponentially: 1h, 2h, 4h."""
        entry = manager.enqueue(video_id='backoff1', video_url='url_backoff1')

        # Set max_attempts=4 so we can observe all three retries
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET max_attempts = 4 WHERE id = ?",
                (entry['id'],)
            )

        expected_delays_minutes = [
            PIPELINE_PROCESS_INTERVAL_MINUTES * 1,   # 60 min = 1h  (2^0)
            PIPELINE_PROCESS_INTERVAL_MINUTES * 2,   # 120 min = 2h (2^1)
            PIPELINE_PROCESS_INTERVAL_MINUTES * 4,   # 240 min = 4h (2^2)
        ]

        for i, expected_delay in enumerate(expected_delays_minutes):
            before_fail = datetime.utcnow()
            manager.mark_failed(entry['id'], error_message=f'Fail {i + 1}')
            video = manager.get_video(entry['id'])

            scheduled = datetime.fromisoformat(video['scheduled_for'])
            actual_delay_minutes = (scheduled - before_fail).total_seconds() / 60
            assert actual_delay_minutes == pytest.approx(expected_delay, abs=2)


class TestSkipVideo:
    """Test skipping videos."""

    def test_skip_video(self, db, manager):
        """skip_video sets status to 'skipped'."""
        entry = manager.enqueue(video_id='skip1', video_url='url_skip1')

        result = manager.skip_video(entry['id'])
        assert result is True

        video = manager.get_video(entry['id'])
        assert video['status'] == 'skipped'


class TestQueueQueries:
    """Test queue query operations."""

    def test_get_queue_depth(self, db, manager):
        """get_queue_depth returns the count of videos with status='queued'."""
        manager.enqueue(video_id='q1', video_url='url1')
        manager.enqueue(video_id='q2', video_url='url2')
        manager.enqueue(video_id='q3', video_url='url3')

        depth = manager.get_queue_depth()
        assert depth == 3

    def test_get_queue_items_paginated(self, db, manager):
        """get_queue returns paginated results with total count."""
        for i in range(5):
            manager.enqueue(video_id=f'page{i:03d}', video_url=f'url{i}')

        result = manager.get_queue(page=1, limit=2)
        assert len(result['items']) == 2
        assert result['total'] == 5

        result2 = manager.get_queue(page=2, limit=2)
        assert len(result2['items']) == 2

        result3 = manager.get_queue(page=3, limit=2)
        assert len(result3['items']) == 1

    def test_get_processing_videos(self, db, manager):
        """get_processing returns only videos with status='processing'."""
        entry1 = manager.enqueue(video_id='proc1', video_url='url1')
        manager.enqueue(video_id='proc2', video_url='url2')

        # Manually set one to processing
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET status = 'processing', processing_started_at = ? WHERE id = ?",
                (datetime.utcnow().isoformat(), entry1['id'])
            )

        processing = manager.get_processing()
        assert len(processing) == 1
        assert processing[0]['video_id'] == 'proc1'

    def test_get_history(self, db, manager):
        """get_history returns completed and failed videos."""
        entry1 = manager.enqueue(video_id='hist1', video_url='url1')
        entry2 = manager.enqueue(video_id='hist2', video_url='url2')
        manager.enqueue(video_id='hist3', video_url='url3')  # stays queued

        manager.mark_completed(entry1['id'], restaurants_found=2)

        # Simulate a full failure for entry2
        now = datetime.utcnow().isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET status = 'failed', attempt_count = 3, processing_completed_at = ? WHERE id = ?",
                (now, entry2['id'])
            )

        history = manager.get_history(page=1, limit=10)
        assert len(history['items']) == 2
        assert history['total'] == 2

    def test_get_video_by_id(self, db, manager):
        """get_video returns a single queue entry by its id."""
        entry = manager.enqueue(
            video_id='single1',
            video_url='url_single1',
            video_title='My Video'
        )

        video = manager.get_video(entry['id'])
        assert video is not None
        assert video['video_id'] == 'single1'
        assert video['video_title'] == 'My Video'

    def test_cleanup_stale_processing(self, db, manager):
        """Videos in 'processing' for longer than STALE_TIMEOUT_HOURS are marked as 'failed'."""
        entry = manager.enqueue(video_id='stale1', video_url='url_stale1')

        # Set to processing with a timestamp beyond the stale threshold
        stale_time = (datetime.utcnow() - timedelta(hours=PIPELINE_STALE_TIMEOUT_HOURS + 1)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET status = 'processing', processing_started_at = ? WHERE id = ?",
                (stale_time, entry['id'])
            )

        cleaned = manager.cleanup_stale()
        assert cleaned == 1

        video = manager.get_video(entry['id'])
        assert video['status'] == 'failed'


class TestQueueActions:
    """Test queue action operations."""

    def test_prioritize_video(self, db, manager):
        """prioritize sets priority=0 and scheduled_for to approximately now."""
        entry = manager.enqueue(video_id='prio1', video_url='url_prio1', priority=5)

        before = datetime.utcnow()
        result = manager.prioritize(entry['id'])
        assert result is True

        video = manager.get_video(entry['id'])
        assert video['priority'] == 0

        scheduled = datetime.fromisoformat(video['scheduled_for'])
        assert abs((scheduled - before).total_seconds()) < 5

    def test_remove_from_queue(self, db, manager):
        """remove deletes the queue entry entirely."""
        entry = manager.enqueue(video_id='rem1', video_url='url_rem1')

        result = manager.remove(entry['id'])
        assert result is True

        video = manager.get_video(entry['id'])
        assert video is None


class TestRetryAllFailed:
    """Test bulk retry of all failed videos."""

    def test_retry_all_failed_resets_failed_videos(self, db, manager):
        """retry_all_failed should reset all failed videos to queued status."""
        entry1 = manager.enqueue(video_id='fail1', video_url='url1')
        entry2 = manager.enqueue(video_id='fail2', video_url='url2')
        entry3 = manager.enqueue(video_id='ok1', video_url='url3')

        # Exhaust retries for entry1 and entry2 to make them permanently failed
        now = datetime.utcnow().isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE video_queue SET status = 'failed', attempt_count = 3, "
                "error_message = 'Some error', processing_completed_at = ? WHERE id = ?",
                (now, entry1['id'])
            )
            conn.execute(
                "UPDATE video_queue SET status = 'failed', attempt_count = 3, "
                "error_message = 'Another error', processing_completed_at = ? WHERE id = ?",
                (now, entry2['id'])
            )

        # Complete entry3
        manager.mark_completed(entry3['id'], restaurants_found=2)

        result = manager.retry_all_failed()

        assert result['count'] == 2

        v1 = manager.get_video(entry1['id'])
        v2 = manager.get_video(entry2['id'])
        v3 = manager.get_video(entry3['id'])

        assert v1['status'] == 'queued'
        assert v1['attempt_count'] == 0
        assert v1['error_message'] is None

        assert v2['status'] == 'queued'
        assert v2['attempt_count'] == 0

        # Completed should be unchanged
        assert v3['status'] == 'completed'

    def test_retry_all_failed_returns_zero_when_no_failures(self, db, manager):
        """retry_all_failed should return count=0 when no failed videos exist."""
        manager.enqueue(video_id='ok1', video_url='url1')

        result = manager.retry_all_failed()
        assert result['count'] == 0


class TestEnqueueAsSkipped:
    """Test enqueue_as_skipped for admin-visible skipped videos."""

    def test_enqueue_as_skipped_creates_skipped_entry(self, db, manager):
        """enqueue_as_skipped inserts a video with status='skipped'."""
        entry = manager.enqueue_as_skipped(
            video_id='old_vid_1',
            video_url='https://youtube.com/watch?v=old_vid_1',
            video_title='Old Video',
            reason='Not among the 10 most recent videos',
        )

        assert entry['status'] == 'skipped'
        assert entry['video_id'] == 'old_vid_1'
        assert entry['error_message'] == 'Not among the 10 most recent videos'

    def test_enqueue_as_skipped_with_subscription_id(self, db_with_subscription):
        """enqueue_as_skipped links to a subscription."""
        db, sub_id = db_with_subscription
        mgr = VideoQueueManager(db)

        entry = mgr.enqueue_as_skipped(
            video_id='old_vid_2',
            video_url='https://youtube.com/watch?v=old_vid_2',
            subscription_id=sub_id,
            reason='Too old',
        )

        assert entry['subscription_id'] == sub_id
        assert entry['status'] == 'skipped'

    def test_enqueue_as_skipped_with_published_at(self, db, manager):
        """enqueue_as_skipped stores the published_at date."""
        entry = manager.enqueue_as_skipped(
            video_id='old_vid_3',
            video_url='https://youtube.com/watch?v=old_vid_3',
            published_at='2024-01-15',
            reason='Too old',
        )

        assert entry['published_at'] == '2024-01-15'

    def test_enqueue_as_skipped_does_not_affect_queue_depth(self, db, manager):
        """Skipped videos don't count in queue depth."""
        manager.enqueue(video_id='queued_1', video_url='url1')
        manager.enqueue_as_skipped(
            video_id='skipped_1', video_url='url2', reason='old'
        )

        assert manager.get_queue_depth() == 1

    def test_enqueue_as_skipped_skips_duplicate(self, db, manager):
        """If video_id already in queue, enqueue_as_skipped returns None."""
        manager.enqueue(video_id='dup_1', video_url='url1')

        result = manager.enqueue_as_skipped(
            video_id='dup_1', video_url='url1', reason='old'
        )
        assert result is None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

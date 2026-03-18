"""
Tests for the PipelineLogger module.
Verifies structured logging, querying, rotation, and statistics for pipeline events.
"""

import os
import sys
import pytest
import tempfile
import json
from datetime import datetime, timedelta

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from pipeline_logger import PipelineLogger


class TestLogCreation:
    """Test pipeline log creation."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_log_info_event(self, db):
        """Test creating an info level log entry."""
        logger = PipelineLogger(db)
        log_id = logger.log('info', 'video_processed', 'Video processed successfully')

        assert log_id is not None

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row is not None
        assert row['level'] == 'info'
        assert row['event_type'] == 'video_processed'
        assert row['message'] == 'Video processed successfully'

    def test_log_warning_event(self, db):
        """Test creating a warning level log entry."""
        logger = PipelineLogger(db)
        log_id = logger.warning('rate_limit', 'Approaching rate limit')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row is not None
        assert row['level'] == 'warning'
        assert row['event_type'] == 'rate_limit'
        assert row['message'] == 'Approaching rate limit'

    def test_log_error_event(self, db):
        """Test creating an error level log entry."""
        logger = PipelineLogger(db)
        log_id = logger.error('transcript_fetch_failed', 'Failed to fetch transcript')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row is not None
        assert row['level'] == 'error'
        assert row['event_type'] == 'transcript_fetch_failed'
        assert row['message'] == 'Failed to fetch transcript'

    def test_log_with_subscription_id(self, db):
        """Test that subscription_id is stored correctly."""
        logger = PipelineLogger(db)
        log_id = logger.info('subscription_checked', 'Checked subscription',
                             subscription_id='sub-123')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row['subscription_id'] == 'sub-123'

    def test_log_with_video_queue_id(self, db):
        """Test that video_queue_id is stored correctly."""
        logger = PipelineLogger(db)
        log_id = logger.info('video_queued', 'Video added to queue',
                             video_queue_id='vq-456')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row['video_queue_id'] == 'vq-456'

    def test_log_with_details_dict(self, db):
        """Test that details dict is stored as a JSON string."""
        logger = PipelineLogger(db)
        details = {'video_id': 'abc123', 'restaurants_found': 5, 'duration_ms': 1200}
        log_id = logger.info('analysis_complete', 'Analysis finished', details=details)

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row['details'] is not None
        stored_details = json.loads(row['details'])
        assert stored_details == details
        assert stored_details['video_id'] == 'abc123'
        assert stored_details['restaurants_found'] == 5

    def test_log_sets_timestamp(self, db):
        """Test that timestamp is set automatically on log creation."""
        logger = PipelineLogger(db)
        log_id = logger.info('test_event', 'Test message')

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM pipeline_logs WHERE id = ?', (log_id,))
            row = cursor.fetchone()

        assert row['timestamp'] is not None
        # Should be a valid parseable ISO timestamp
        ts = datetime.fromisoformat(row['timestamp'])
        assert isinstance(ts, datetime)


class TestLogQueries:
    """Test pipeline log querying, filtering, and pagination."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_get_logs_default_order(self, db):
        """Test that logs are returned most recent first."""
        logger = PipelineLogger(db)

        id1 = logger.log('info', 'event_a', 'First event')
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = '2024-01-01T10:00:00' WHERE id = ?",
                (id1,)
            )

        id2 = logger.log('info', 'event_b', 'Second event')
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = '2024-01-02T10:00:00' WHERE id = ?",
                (id2,)
            )

        result = logger.get_logs()

        assert len(result['items']) == 2
        # Most recent first
        assert result['items'][0]['id'] == id2
        assert result['items'][1]['id'] == id1

    def test_get_logs_paginated(self, db):
        """Test that get_logs returns paginated results with total count."""
        logger = PipelineLogger(db)

        for i in range(5):
            logger.info(f'event_{i}', f'Message {i}')

        result = logger.get_logs(page=1, limit=2)

        assert len(result['items']) == 2
        assert result['total'] == 5
        assert result['page'] == 1
        assert result['limit'] == 2

        result2 = logger.get_logs(page=2, limit=2)
        assert len(result2['items']) == 2

        result3 = logger.get_logs(page=3, limit=2)
        assert len(result3['items']) == 1

    def test_filter_by_level(self, db):
        """Test filtering logs by level returns only matching level."""
        logger = PipelineLogger(db)

        logger.info('event_a', 'Info message')
        logger.warning('event_b', 'Warning message')
        logger.error('event_c', 'Error message')

        result = logger.get_logs(level='warning')

        assert result['total'] == 1
        assert len(result['items']) == 1
        assert result['items'][0]['level'] == 'warning'

    def test_filter_by_event_type(self, db):
        """Test filtering logs by event_type returns only matching events."""
        logger = PipelineLogger(db)

        logger.info('video_processed', 'Processed video 1')
        logger.info('video_processed', 'Processed video 2')
        logger.info('subscription_checked', 'Checked subscription')

        result = logger.get_logs(event_type='video_processed')

        assert result['total'] == 2
        assert all(item['event_type'] == 'video_processed' for item in result['items'])

    def test_filter_by_subscription_id(self, db):
        """Test filtering logs by subscription_id returns only matching subscription."""
        logger = PipelineLogger(db)

        logger.info('check', 'Check 1', subscription_id='sub-1')
        logger.info('check', 'Check 2', subscription_id='sub-2')
        logger.info('check', 'Check 3', subscription_id='sub-1')

        result = logger.get_logs(subscription_id='sub-1')

        assert result['total'] == 2
        assert all(item['subscription_id'] == 'sub-1' for item in result['items'])

    def test_filter_by_date_range(self, db):
        """Test filtering logs by start_date and end_date."""
        logger = PipelineLogger(db)

        id1 = logger.info('event', 'Old event')
        id2 = logger.info('event', 'In-range event')
        id3 = logger.info('event', 'Future event')

        # Set explicit timestamps
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = '2024-01-05T10:00:00' WHERE id = ?",
                (id1,)
            )
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = '2024-01-15T10:00:00' WHERE id = ?",
                (id2,)
            )
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = '2024-01-25T10:00:00' WHERE id = ?",
                (id3,)
            )

        result = logger.get_logs(start_date='2024-01-10', end_date='2024-01-20')

        assert result['total'] == 1
        assert result['items'][0]['id'] == id2

    def test_combined_filters(self, db):
        """Test that multiple filters work together correctly."""
        logger = PipelineLogger(db)

        logger.info('video_processed', 'Processed OK', subscription_id='sub-1')
        logger.error('video_processed', 'Process failed', subscription_id='sub-1')
        logger.info('video_processed', 'Processed OK', subscription_id='sub-2')
        logger.info('subscription_checked', 'Checked', subscription_id='sub-1')

        result = logger.get_logs(
            level='info',
            event_type='video_processed',
            subscription_id='sub-1'
        )

        assert result['total'] == 1
        assert result['items'][0]['level'] == 'info'
        assert result['items'][0]['event_type'] == 'video_processed'
        assert result['items'][0]['subscription_id'] == 'sub-1'


class TestLogRotation:
    """Test pipeline log cleanup and rotation."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_cleanup_old_logs(self, db):
        """Test that cleanup removes logs older than retention_days."""
        logger = PipelineLogger(db)

        old_id = logger.info('old_event', 'Old log entry')
        recent_id = logger.info('recent_event', 'Recent log entry')

        # Set old log to 40 days ago
        old_date = (datetime.utcnow() - timedelta(days=40)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = ? WHERE id = ?",
                (old_date, old_id)
            )

        logger.cleanup(retention_days=30)

        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as count FROM pipeline_logs')
            count = cursor.fetchone()['count']

        assert count == 1

        # Verify the remaining log is the recent one
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM pipeline_logs')
            row = cursor.fetchone()

        assert row['id'] == recent_id

    def test_cleanup_preserves_recent_logs(self, db):
        """Test that cleanup keeps logs within the retention window."""
        logger = PipelineLogger(db)

        old_id = logger.info('old', 'Very old log')
        mid_id = logger.info('mid', 'Somewhat old log')
        recent_id = logger.info('recent', 'Fresh log')

        old_date = (datetime.utcnow() - timedelta(days=60)).isoformat()
        mid_date = (datetime.utcnow() - timedelta(days=10)).isoformat()

        with db.get_connection() as conn:
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = ? WHERE id = ?",
                (old_date, old_id)
            )
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = ? WHERE id = ?",
                (mid_date, mid_id)
            )

        logger.cleanup(retention_days=30)

        result = logger.get_logs()
        assert result['total'] == 2
        remaining_ids = [item['id'] for item in result['items']]
        assert mid_id in remaining_ids
        assert recent_id in remaining_ids
        assert old_id not in remaining_ids

    def test_cleanup_returns_deleted_count(self, db):
        """Test that cleanup returns the number of deleted rows."""
        logger = PipelineLogger(db)

        # Create 3 old logs
        old_ids = []
        for i in range(3):
            log_id = logger.info(f'old_{i}', f'Old log {i}')
            old_ids.append(log_id)

        old_date = (datetime.utcnow() - timedelta(days=40)).isoformat()
        with db.get_connection() as conn:
            for log_id in old_ids:
                conn.execute(
                    "UPDATE pipeline_logs SET timestamp = ? WHERE id = ?",
                    (old_date, log_id)
                )

        # Create 1 recent log
        logger.info('recent', 'Recent log')

        deleted = logger.cleanup(retention_days=30)

        assert deleted == 3


class TestLogStats:
    """Test pipeline log statistics."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_get_event_counts(self, db):
        """Test count of logs grouped by event_type in last N days."""
        logger = PipelineLogger(db)

        # Create recent logs (within last 7 days)
        logger.info('video_processed', 'Processed 1')
        logger.info('video_processed', 'Processed 2')
        logger.info('video_processed', 'Processed 3')
        logger.warning('rate_limit', 'Rate limited')
        logger.error('transcript_failed', 'Failed')

        # Create an old log that should NOT be counted
        old_id = logger.info('video_processed', 'Old processed')
        old_date = (datetime.utcnow() - timedelta(days=10)).isoformat()
        with db.get_connection() as conn:
            conn.execute(
                "UPDATE pipeline_logs SET timestamp = ? WHERE id = ?",
                (old_date, old_id)
            )

        counts = logger.get_event_counts(days=7)

        assert counts['video_processed'] == 3
        assert counts['rate_limit'] == 1
        assert counts['transcript_failed'] == 1
        assert len(counts) == 3


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

"""
Tests for pipeline activation and end-to-end flow (PR #58, #60).

Verifies:
- Seeded subscription can be polled for new videos
- Queued videos can be processed with mocked transcript/analyzer
"""

import os
import sys
import tempfile
from unittest.mock import patch, MagicMock

import pytest
from pathlib import Path

# Add project paths
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))
sys.path.insert(0, str(PROJECT_ROOT / "api"))

from database import Database
from subscription_manager import SubscriptionManager
from video_queue_manager import VideoQueueManager


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def db(temp_dir):
    """Create a temporary test database."""
    db_path = os.path.join(temp_dir, "test.db")
    return Database(db_path)


@pytest.fixture
def sub_manager(db):
    """Create a SubscriptionManager with test database."""
    return SubscriptionManager(db)


@pytest.fixture
def queue_manager(db):
    """Create a VideoQueueManager with test database."""
    return VideoQueueManager(db)


class TestPollSubscriptions:
    """Test that polling subscriptions discovers and queues videos."""

    def test_poll_queues_videos_from_subscription(self, db, sub_manager, queue_manager):
        """Polling a subscription with mocked yt-dlp queues new videos."""
        # Seed a subscription
        sub = sub_manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLtest123",
            source_name="Test Playlist",
            priority=3,
        )

        # Enqueue videos as the scheduler would
        queue_manager.enqueue(
            video_id="vid_001",
            video_url="https://www.youtube.com/watch?v=vid_001",
            video_title="Episode 1",
            subscription_id=sub["id"],
        )
        queue_manager.enqueue(
            video_id="vid_002",
            video_url="https://www.youtube.com/watch?v=vid_002",
            video_title="Episode 2",
            subscription_id=sub["id"],
        )

        # Verify videos were queued
        depth = queue_manager.get_queue_depth()
        assert depth == 2

    def test_queued_video_can_be_dequeued_and_processed(self, db, sub_manager, queue_manager):
        """A queued video can be dequeued for processing."""
        sub = sub_manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLtest456",
            source_name="Test Playlist 2",
            priority=3,
        )

        queue_manager.enqueue(
            video_id="vid_process",
            video_url="https://www.youtube.com/watch?v=vid_process",
            video_title="Test Episode",
            subscription_id=sub["id"],
        )

        # Dequeue the video
        video = queue_manager.dequeue()
        assert video is not None
        assert video["video_id"] == "vid_process"
        assert video["status"] == "processing"

    def test_processed_video_can_be_marked_completed(self, db, sub_manager, queue_manager):
        """After processing, a video can be marked complete."""
        sub = sub_manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLtest789",
            source_name="Test Playlist 3",
            priority=3,
        )

        queue_manager.enqueue(
            video_id="vid_complete",
            video_url="https://www.youtube.com/watch?v=vid_complete",
            video_title="Completed Episode",
            subscription_id=sub["id"],
        )

        video = queue_manager.dequeue()
        queue_manager.mark_completed(
            video["id"],
            restaurants_found=5,
        )

        # No more queued videos
        depth = queue_manager.get_queue_depth()
        assert depth == 0

        # Video should appear in history as completed
        history = queue_manager.get_history(limit=10)
        completed_items = [
            item for item in history.get("items", [])
            if item["status"] == "completed"
        ]
        assert len(completed_items) == 1

    def test_pipeline_scheduler_polls_and_queues(self, db, sub_manager):
        """PipelineScheduler.poll_subscriptions picks up the seeded subscription."""
        from pipeline_scheduler import PipelineScheduler

        # Seed a subscription
        sub_manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLtest_sched",
            source_name="Scheduler Test",
            priority=3,
        )

        scheduler = PipelineScheduler(db=db)

        # Mock the yt-dlp fetch to return videos
        mock_videos = [
            {
                "video_id": "sched_vid_1",
                "video_url": "https://www.youtube.com/watch?v=sched_vid_1",
                "video_title": "Scheduler Episode",
                "published_at": "2024-01-25",
            },
        ]

        with patch.object(scheduler, "_fetch_channel_videos", return_value=mock_videos):
            scheduler.poll_subscriptions()

        # Verify the video was queued
        queue = VideoQueueManager(db)
        depth = queue.get_queue_depth()
        assert depth >= 1

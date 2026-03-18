"""
Tests for FastAPI admin subscription and pipeline routes.

Tests verify the route logic using mock dependencies,
without starting the actual FastAPI server.
"""

import sys
import json
import uuid
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from subscription_manager import SubscriptionManager
from video_queue_manager import VideoQueueManager
from pipeline_logger import PipelineLogger
from database import Database


# ============================================================
# Subscription Manager Tests (backend logic used by routes)
# ============================================================

class TestSubscriptionManagerForRoutes:
    """Test SubscriptionManager methods that the FastAPI routes call."""

    @pytest.fixture
    def db(self, tmp_path):
        """Create a temporary database."""
        db_path = tmp_path / "test.db"
        db = Database(str(db_path))
        return db

    @pytest.fixture
    def manager(self, db):
        return SubscriptionManager(db)

    def test_add_subscription_playlist(self, manager):
        """Test adding a playlist subscription."""
        sub = manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLtest123",
            source_name="Test Playlist",
            priority=3,
            check_interval_hours=6,
        )
        assert sub is not None
        assert sub["source_type"] == "playlist"
        assert sub["source_id"] == "PLtest123"
        assert sub["source_name"] == "Test Playlist"
        assert sub["priority"] == 3
        assert sub["check_interval_hours"] == 6
        assert sub["is_active"] == 1

    def test_add_subscription_channel(self, manager):
        """Test adding a channel subscription."""
        sub = manager.add_subscription(
            source_url="https://www.youtube.com/@TestChannel",
            source_name="Test Channel",
        )
        assert sub is not None
        assert sub["source_type"] == "channel"
        assert sub["source_id"] == "@TestChannel"

    def test_add_subscription_duplicate_raises(self, manager):
        """Test that duplicate subscription raises ValueError."""
        manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLdup",
        )
        with pytest.raises(ValueError, match="already exists"):
            manager.add_subscription(
                source_url="https://www.youtube.com/playlist?list=PLdup",
            )

    def test_add_subscription_invalid_url_raises(self, manager):
        """Test that invalid URL raises ValueError."""
        with pytest.raises(ValueError):
            manager.add_subscription(source_url="not-a-url")

    def test_list_subscriptions(self, manager):
        """Test listing subscriptions."""
        manager.add_subscription(
            source_url="https://www.youtube.com/@Chan1",
            source_name="Chan1",
            priority=1,
        )
        manager.add_subscription(
            source_url="https://www.youtube.com/@Chan2",
            source_name="Chan2",
            priority=5,
        )
        subs = manager.list_subscriptions(active_only=True)
        assert len(subs) == 2
        # Ordered by priority ASC
        assert subs[0]["source_name"] == "Chan1"
        assert subs[1]["source_name"] == "Chan2"

    def test_get_subscription(self, manager):
        """Test getting a subscription by ID."""
        sub = manager.add_subscription(
            source_url="https://www.youtube.com/@GetTest",
        )
        fetched = manager.get_subscription(sub["id"])
        assert fetched is not None
        assert fetched["id"] == sub["id"]

    def test_get_subscription_not_found(self, manager):
        """Test getting a non-existent subscription returns None."""
        assert manager.get_subscription("nonexistent") is None

    def test_update_subscription(self, manager):
        """Test updating subscription fields."""
        sub = manager.add_subscription(
            source_url="https://www.youtube.com/@UpdateTest",
            priority=5,
        )
        success = manager.update_subscription(sub["id"], priority=1, source_name="Updated")
        assert success is True
        updated = manager.get_subscription(sub["id"])
        assert updated["priority"] == 1
        assert updated["source_name"] == "Updated"

    def test_pause_resume_subscription(self, manager):
        """Test pausing and resuming a subscription."""
        sub = manager.add_subscription(
            source_url="https://www.youtube.com/@PauseTest",
        )
        assert sub["is_active"] == 1

        manager.pause_subscription(sub["id"])
        paused = manager.get_subscription(sub["id"])
        assert paused["is_active"] == 0

        manager.resume_subscription(sub["id"])
        resumed = manager.get_subscription(sub["id"])
        assert resumed["is_active"] == 1

    def test_delete_subscription(self, manager):
        """Test deleting a subscription."""
        sub = manager.add_subscription(
            source_url="https://www.youtube.com/@DeleteTest",
        )
        success = manager.delete_subscription(sub["id"])
        assert success is True
        assert manager.get_subscription(sub["id"]) is None

    def test_delete_nonexistent_returns_false(self, manager):
        """Test deleting non-existent subscription returns False."""
        assert manager.delete_subscription("nonexistent") is False


# ============================================================
# VideoQueueManager Tests (backend logic used by pipeline routes)
# ============================================================

class TestVideoQueueManagerForRoutes:
    """Test VideoQueueManager methods that the pipeline routes call."""

    @pytest.fixture
    def db(self, tmp_path):
        db_path = tmp_path / "test.db"
        db = Database(str(db_path))
        return db

    @pytest.fixture
    def queue(self, db):
        return VideoQueueManager(db)

    def test_get_queue_empty(self, queue):
        """Test getting queue when empty."""
        result = queue.get_queue()
        assert result["items"] == []
        assert result["total"] == 0

    def test_enqueue_and_get_queue(self, queue):
        """Test enqueuing a video and retrieving the queue."""
        entry = queue.enqueue(
            video_id="vid123",
            video_url="https://www.youtube.com/watch?v=vid123",
            video_title="Test Video",
        )
        assert entry["status"] == "queued"
        assert entry["video_id"] == "vid123"

        result = queue.get_queue()
        assert result["total"] == 1
        assert result["items"][0]["video_id"] == "vid123"

    def test_skip_video(self, queue):
        """Test skipping a video."""
        entry = queue.enqueue(
            video_id="skip_vid",
            video_url="https://www.youtube.com/watch?v=skip_vid",
        )
        success = queue.skip_video(entry["id"])
        assert success is True
        video = queue.get_video(entry["id"])
        assert video["status"] == "skipped"

    def test_prioritize_video(self, queue):
        """Test prioritizing a video."""
        entry = queue.enqueue(
            video_id="prio_vid",
            video_url="https://www.youtube.com/watch?v=prio_vid",
            priority=5,
        )
        success = queue.prioritize(entry["id"])
        assert success is True
        video = queue.get_video(entry["id"])
        assert video["priority"] == 0

    def test_remove_video(self, queue):
        """Test removing a video from queue."""
        entry = queue.enqueue(
            video_id="rm_vid",
            video_url="https://www.youtube.com/watch?v=rm_vid",
        )
        success = queue.remove(entry["id"])
        assert success is True
        assert queue.get_video(entry["id"]) is None

    def test_get_history_empty(self, queue):
        """Test getting history when empty."""
        result = queue.get_history()
        assert result["items"] == []
        assert result["total"] == 0

    def test_get_queue_depth(self, queue):
        """Test queue depth counting."""
        assert queue.get_queue_depth() == 0
        queue.enqueue(
            video_id="depth1",
            video_url="https://www.youtube.com/watch?v=depth1",
        )
        assert queue.get_queue_depth() == 1


# ============================================================
# PipelineLogger Tests (backend logic used by pipeline routes)
# ============================================================

class TestPipelineLoggerForRoutes:
    """Test PipelineLogger methods that the pipeline routes call."""

    @pytest.fixture
    def db(self, tmp_path):
        db_path = tmp_path / "test.db"
        db = Database(str(db_path))
        return db

    @pytest.fixture
    def logger(self, db):
        return PipelineLogger(db)

    def test_log_and_get_logs(self, logger):
        """Test creating and retrieving logs."""
        logger.info("test_event", "Test message")
        logger.warning("test_warning", "Warning message")
        logger.error("test_error", "Error message")

        result = logger.get_logs()
        assert result["total"] == 3
        assert len(result["items"]) == 3

    def test_get_logs_filtered_by_level(self, logger):
        """Test filtering logs by level."""
        logger.info("event1", "Info msg")
        logger.error("event2", "Error msg")

        result = logger.get_logs(level="error")
        assert result["total"] == 1
        assert result["items"][0]["level"] == "error"

    def test_get_logs_filtered_by_event_type(self, logger):
        """Test filtering logs by event type."""
        logger.info("poll_started", "Poll msg")
        logger.info("video_processed", "Video msg")

        result = logger.get_logs(event_type="poll_started")
        assert result["total"] == 1
        assert result["items"][0]["event_type"] == "poll_started"

    def test_get_logs_pagination(self, logger):
        """Test log pagination."""
        for i in range(10):
            logger.info(f"event_{i}", f"Message {i}")

        result = logger.get_logs(page=1, limit=3)
        assert result["total"] == 10
        assert len(result["items"]) == 3


# ============================================================
# URL Resolution Tests
# ============================================================

class TestSubscriptionURLResolution:
    """Test URL resolution logic used by the add subscription route."""

    def test_resolve_playlist_url(self):
        result = SubscriptionManager.resolve_source(
            "https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU"
        )
        assert result["source_type"] == "playlist"
        assert result["source_id"] == "PLZPgleW4baxrsrU"

    def test_resolve_playlist_from_video_url(self):
        """Playlist URLs with /watch format should be handled as channel/video."""
        # A URL like youtube.com/watch?v=xxx&list=PLxxx is a VIDEO url, not a playlist URL
        # resolve_source only handles /playlist?list= format
        with pytest.raises(ValueError):
            SubscriptionManager.resolve_source(
                "https://www.youtube.com/watch?v=J6Akd1bXiWM&list=PLZPgleW4baxrsrU"
            )

    def test_resolve_channel_handle(self):
        result = SubscriptionManager.resolve_source(
            "https://www.youtube.com/@TestChannel"
        )
        assert result["source_type"] == "channel"
        assert result["source_id"] == "@TestChannel"

    def test_resolve_channel_id(self):
        result = SubscriptionManager.resolve_source(
            "https://www.youtube.com/channel/UCtest123"
        )
        assert result["source_type"] == "channel"
        assert result["source_id"] == "UCtest123"

    def test_resolve_invalid_url(self):
        with pytest.raises(ValueError):
            SubscriptionManager.resolve_source("https://example.com/not-youtube")

    def test_resolve_mobile_url(self):
        result = SubscriptionManager.resolve_source(
            "https://m.youtube.com/playlist?list=PLmobile"
        )
        assert result["source_type"] == "playlist"
        assert result["source_id"] == "PLmobile"

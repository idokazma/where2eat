"""Tests for the seed subscription script."""

import sys
import pytest
from pathlib import Path

# Add scripts and src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from seed_subscription import normalize_playlist_url


class TestNormalizePlaylistUrl:
    """Test URL normalization for playlist URLs."""

    def test_video_with_list_param(self):
        """Convert watch?v=xxx&list=PLxxx to playlist?list=PLxxx."""
        url = "https://www.youtube.com/watch?v=J6Akd1bXiWM&list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"
        result = normalize_playlist_url(url)
        assert result == "https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"

    def test_direct_playlist_url_unchanged(self):
        """Direct playlist URL should pass through unchanged."""
        url = "https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"
        result = normalize_playlist_url(url)
        assert result == url

    def test_channel_url_unchanged(self):
        """Channel URL without list param should pass through unchanged."""
        url = "https://www.youtube.com/@TestChannel"
        result = normalize_playlist_url(url)
        assert result == url

    def test_video_without_list_unchanged(self):
        """Video URL without list param should pass through unchanged."""
        url = "https://www.youtube.com/watch?v=J6Akd1bXiWM"
        result = normalize_playlist_url(url)
        assert result == url


class TestSeedSubscriptionAdd:
    """Test the add command functionality."""

    @pytest.fixture
    def db(self, tmp_path):
        from database import Database
        db_path = tmp_path / "test.db"
        return Database(str(db_path))

    def test_add_playlist_subscription(self, db):
        """Test adding a playlist subscription via the manager."""
        from subscription_manager import SubscriptionManager
        manager = SubscriptionManager(db)

        url = normalize_playlist_url(
            "https://www.youtube.com/watch?v=J6Akd1bXiWM&list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"
        )
        sub = manager.add_subscription(
            source_url=url,
            source_name="Hebrew Food Podcast",
            priority=3,
        )

        assert sub["source_type"] == "playlist"
        assert sub["source_id"] == "PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"
        assert sub["source_name"] == "Hebrew Food Podcast"
        assert sub["priority"] == 3

    def test_add_and_list(self, db):
        """Test adding and listing subscriptions."""
        from subscription_manager import SubscriptionManager
        manager = SubscriptionManager(db)

        manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PL111",
            source_name="Playlist 1",
        )
        manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PL222",
            source_name="Playlist 2",
        )

        subs = manager.list_subscriptions()
        assert len(subs) == 2


class TestSeedSubscriptionStatus:
    """Test the status command functionality."""

    @pytest.fixture
    def db(self, tmp_path):
        from database import Database
        db_path = tmp_path / "test.db"
        return Database(str(db_path))

    def test_status_with_empty_db(self, db):
        """Status should work with no subscriptions or queue items."""
        from video_queue_manager import VideoQueueManager
        from subscription_manager import SubscriptionManager

        queue = VideoQueueManager(db)
        sub_manager = SubscriptionManager(db)

        subs = sub_manager.list_subscriptions(active_only=False)
        assert len(subs) == 0
        assert queue.get_queue_depth() == 0

    def test_status_with_data(self, db):
        """Status should reflect subscriptions and queue."""
        from subscription_manager import SubscriptionManager
        from video_queue_manager import VideoQueueManager

        sub_manager = SubscriptionManager(db)
        queue = VideoQueueManager(db)

        sub = sub_manager.add_subscription(
            source_url="https://www.youtube.com/playlist?list=PLstatus",
            source_name="Status Test",
        )

        queue.enqueue(
            video_id="status_vid1",
            video_url="https://www.youtube.com/watch?v=status_vid1",
            subscription_id=sub["id"],
        )

        subs = sub_manager.list_subscriptions(active_only=False)
        assert len(subs) == 1
        assert queue.get_queue_depth() == 1

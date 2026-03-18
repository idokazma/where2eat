"""
Tests for the SubscriptionManager module.
Verifies subscription CRUD operations, URL resolution, stats tracking,
and ordering logic for YouTube channel/playlist subscriptions.
"""

import os
import sys
import pytest
import tempfile
from datetime import datetime

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from subscription_manager import SubscriptionManager


@pytest.fixture
def db():
    """Create a temporary test database."""
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, 'test.db')
        yield Database(db_path)


@pytest.fixture
def manager(db):
    """Create a SubscriptionManager with a test database."""
    return SubscriptionManager(db)


class TestAddSubscription:
    """Test adding subscriptions."""

    def test_add_channel_subscription(self, manager, db):
        """Add a channel URL, verify it is stored correctly."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCxyz123',
            source_name='Test Channel'
        )

        assert sub is not None
        assert sub['id'] is not None
        assert sub['source_type'] == 'channel'
        assert sub['source_url'] == 'https://www.youtube.com/channel/UCxyz123'
        assert sub['source_id'] == 'UCxyz123'
        assert sub['source_name'] == 'Test Channel'
        assert sub['is_active'] == 1
        assert sub['priority'] == 5
        assert sub['check_interval_hours'] == 12
        assert sub['total_videos_found'] == 0
        assert sub['total_videos_processed'] == 0
        assert sub['total_restaurants_found'] == 0

    def test_add_playlist_subscription(self, manager):
        """Add a playlist URL, verify source_type is 'playlist'."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/playlist?list=PLabc123xyz',
            source_name='Test Playlist'
        )

        assert sub['source_type'] == 'playlist'
        assert sub['source_id'] == 'PLabc123xyz'
        assert sub['source_name'] == 'Test Playlist'

    def test_add_subscription_resolves_channel_id_from_url(self, manager):
        """URL like youtube.com/channel/UCxxx resolves source_id correctly."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UC_food_reviews_123'
        )

        assert sub['source_type'] == 'channel'
        assert sub['source_id'] == 'UC_food_reviews_123'

    def test_add_subscription_resolves_handle_url(self, manager):
        """URL like youtube.com/@handle works and stores the handle."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/@FoodReviewer'
        )

        assert sub['source_type'] == 'channel'
        assert sub['source_id'] == '@FoodReviewer'

    def test_add_subscription_duplicate_source_id_raises(self, manager):
        """Adding the same channel twice raises ValueError."""
        manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCdup123',
            source_name='First Add'
        )

        with pytest.raises(ValueError, match='already exists'):
            manager.add_subscription(
                source_url='https://www.youtube.com/channel/UCdup123',
                source_name='Second Add'
            )

    def test_add_subscription_invalid_url_raises(self, manager):
        """Garbage URL raises ValueError."""
        with pytest.raises(ValueError, match='Invalid'):
            manager.add_subscription(source_url='not-a-youtube-url')

    def test_add_subscription_custom_priority(self, manager):
        """Priority parameter is stored correctly."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCpriority1',
            priority=1
        )

        assert sub['priority'] == 1

    def test_add_subscription_custom_interval(self, manager):
        """check_interval_hours parameter is stored correctly."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCinterval1',
            check_interval_hours=24
        )

        assert sub['check_interval_hours'] == 24


class TestGetSubscriptions:
    """Test retrieving subscriptions."""

    def test_get_subscription_by_id(self, manager):
        """Returns the correct subscription by ID."""
        created = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCget123',
            source_name='Get Test'
        )

        fetched = manager.get_subscription(created['id'])

        assert fetched is not None
        assert fetched['id'] == created['id']
        assert fetched['source_name'] == 'Get Test'
        assert fetched['source_id'] == 'UCget123'

    def test_get_subscription_not_found(self, manager):
        """Returns None for non-existent subscription."""
        result = manager.get_subscription('nonexistent-id-12345')

        assert result is None

    def test_list_active_subscriptions(self, manager):
        """Only returns subscriptions with is_active=1."""
        manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCactive1',
            source_name='Active'
        )
        sub2 = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCpaused1',
            source_name='Paused'
        )
        manager.pause_subscription(sub2['id'])

        active = manager.list_subscriptions(active_only=True)

        assert len(active) == 1
        assert active[0]['source_name'] == 'Active'

    def test_list_all_subscriptions(self, manager):
        """Returns all subscriptions including paused ones."""
        manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCall1',
            source_name='Active'
        )
        sub2 = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCall2',
            source_name='Paused'
        )
        manager.pause_subscription(sub2['id'])

        all_subs = manager.list_subscriptions(active_only=False)

        assert len(all_subs) == 2

    def test_list_subscriptions_ordered_by_priority(self, manager):
        """Subscriptions are ordered by priority ASC, then last_checked_at ASC."""
        manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCord3',
            source_name='Low Priority',
            priority=10
        )
        manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCord1',
            source_name='High Priority',
            priority=1
        )
        manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCord2',
            source_name='Medium Priority',
            priority=5
        )

        subs = manager.list_subscriptions(active_only=True)

        assert len(subs) == 3
        assert subs[0]['source_name'] == 'High Priority'
        assert subs[1]['source_name'] == 'Medium Priority'
        assert subs[2]['source_name'] == 'Low Priority'


class TestUpdateSubscription:
    """Test updating subscriptions."""

    def test_pause_subscription(self, manager):
        """Sets is_active=0 when pausing."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCpause1'
        )

        result = manager.pause_subscription(sub['id'])

        assert result is True
        fetched = manager.get_subscription(sub['id'])
        assert fetched['is_active'] == 0

    def test_resume_subscription(self, manager):
        """Sets is_active=1 when resuming."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCresume1'
        )
        manager.pause_subscription(sub['id'])

        result = manager.resume_subscription(sub['id'])

        assert result is True
        fetched = manager.get_subscription(sub['id'])
        assert fetched['is_active'] == 1

    def test_update_priority(self, manager):
        """Changes priority value."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCpri1',
            priority=5
        )

        result = manager.update_subscription(sub['id'], priority=1)

        assert result is True
        fetched = manager.get_subscription(sub['id'])
        assert fetched['priority'] == 1

    def test_update_interval(self, manager):
        """Changes check_interval_hours value."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCint1',
            check_interval_hours=12
        )

        result = manager.update_subscription(sub['id'], check_interval_hours=6)

        assert result is True
        fetched = manager.get_subscription(sub['id'])
        assert fetched['check_interval_hours'] == 6

    def test_update_last_checked(self, manager):
        """Updates last_checked_at timestamp."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UClast1'
        )

        now = datetime.now().isoformat()
        result = manager.update_subscription(sub['id'], last_checked_at=now)

        assert result is True
        fetched = manager.get_subscription(sub['id'])
        assert fetched['last_checked_at'] == now

    def test_update_stats(self, manager):
        """Increments total_videos_found, total_videos_processed, total_restaurants_found."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCstats1'
        )

        result = manager.update_stats(
            sub['id'],
            videos_found=10,
            videos_processed=8,
            restaurants_found=25
        )
        assert result is True

        fetched = manager.get_subscription(sub['id'])
        assert fetched['total_videos_found'] == 10
        assert fetched['total_videos_processed'] == 8
        assert fetched['total_restaurants_found'] == 25

        # Increment again to verify additive behavior
        manager.update_stats(
            sub['id'],
            videos_found=5,
            videos_processed=3,
            restaurants_found=7
        )

        fetched = manager.get_subscription(sub['id'])
        assert fetched['total_videos_found'] == 15
        assert fetched['total_videos_processed'] == 11
        assert fetched['total_restaurants_found'] == 32


class TestDeleteSubscription:
    """Test deleting subscriptions."""

    def test_delete_subscription(self, manager):
        """Removes subscription from DB and returns True."""
        sub = manager.add_subscription(
            source_url='https://www.youtube.com/channel/UCdel1',
            source_name='To Delete'
        )

        result = manager.delete_subscription(sub['id'])

        assert result is True
        assert manager.get_subscription(sub['id']) is None

    def test_delete_nonexistent_returns_false(self, manager):
        """Returns False when deleting non-existent subscription."""
        result = manager.delete_subscription('nonexistent-id-99999')

        assert result is False


class TestResolveSource:
    """Test the static URL resolution method."""

    def test_resolve_channel_url(self):
        """Resolves youtube.com/channel/UCxxx format."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/channel/UCabcdef123'
        )
        assert result == {'source_type': 'channel', 'source_id': 'UCabcdef123'}

    def test_resolve_handle_url(self):
        """Resolves youtube.com/@handle format."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/@MyChannel'
        )
        assert result == {'source_type': 'channel', 'source_id': '@MyChannel'}

    def test_resolve_c_url(self):
        """Resolves youtube.com/c/name format."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/c/FoodReviews'
        )
        assert result == {'source_type': 'channel', 'source_id': 'c/FoodReviews'}

    def test_resolve_user_url(self):
        """Resolves youtube.com/user/name format."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/user/FoodChannel'
        )
        assert result == {'source_type': 'channel', 'source_id': 'user/FoodChannel'}

    def test_resolve_playlist_url(self):
        """Resolves youtube.com/playlist?list=PLxxx format."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/playlist?list=PLabc123'
        )
        assert result == {'source_type': 'playlist', 'source_id': 'PLabc123'}

    def test_resolve_mobile_url(self):
        """Resolves m.youtube.com variants."""
        result = SubscriptionManager.resolve_source(
            'https://m.youtube.com/channel/UCmobile123'
        )
        assert result == {'source_type': 'channel', 'source_id': 'UCmobile123'}

    def test_resolve_mobile_handle_url(self):
        """Resolves m.youtube.com/@handle variants."""
        result = SubscriptionManager.resolve_source(
            'https://m.youtube.com/@MobileHandle'
        )
        assert result == {'source_type': 'channel', 'source_id': '@MobileHandle'}

    def test_resolve_invalid_url_raises(self):
        """Raises ValueError for unrecognized URLs."""
        with pytest.raises(ValueError, match='Invalid'):
            SubscriptionManager.resolve_source('https://www.google.com/search?q=food')

    def test_resolve_empty_string_raises(self):
        """Raises ValueError for empty string."""
        with pytest.raises(ValueError, match='Invalid'):
            SubscriptionManager.resolve_source('')

    def test_resolve_http_url(self):
        """Resolves http:// (non-https) YouTube URLs."""
        result = SubscriptionManager.resolve_source(
            'http://www.youtube.com/channel/UChttp123'
        )
        assert result == {'source_type': 'channel', 'source_id': 'UChttp123'}

    def test_resolve_no_www_url(self):
        """Resolves YouTube URLs without www prefix."""
        result = SubscriptionManager.resolve_source(
            'https://youtube.com/channel/UCnowww123'
        )
        assert result == {'source_type': 'channel', 'source_id': 'UCnowww123'}

    def test_resolve_playlist_with_extra_params(self):
        """Resolves playlist URL that has extra query parameters."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/playlist?list=PLextra456&index=1'
        )
        assert result == {'source_type': 'playlist', 'source_id': 'PLextra456'}

    def test_resolve_channel_with_trailing_slash(self):
        """Resolves channel URL with trailing slash."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/channel/UCtrailing123/'
        )
        assert result == {'source_type': 'channel', 'source_id': 'UCtrailing123'}

    def test_resolve_handle_with_trailing_slash(self):
        """Resolves handle URL with trailing slash."""
        result = SubscriptionManager.resolve_source(
            'https://www.youtube.com/@HandleTrail/'
        )
        assert result == {'source_type': 'channel', 'source_id': '@HandleTrail'}


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

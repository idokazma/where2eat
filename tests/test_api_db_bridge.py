"""
Tests for the API database bridge (scripts/api_db_bridge.py).
Tests the Python bridge that connects Node.js API to SQLite database.
"""

import pytest
import json
import subprocess
import os
import sys

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

from src.database import Database


class TestApiDbBridge:
    """Tests for the API database bridge script."""

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        """Set up test database and bridge script path."""
        self.db_path = str(tmp_path / "test_where2eat.db")
        self.bridge_script = os.path.join(project_root, "scripts", "api_db_bridge.py")

        # Create test database with sample data
        self.db = Database(self.db_path)

        # Add test episode
        self.episode_id = self.db.create_episode(
            video_id="test_video_123",
            video_url="https://www.youtube.com/watch?v=test_video_123",
            channel_name="Test Channel",
            title="Test Episode",
            language="he",
            analysis_date="2026-01-01"
        )

        # Add test restaurants
        self.restaurant1_id = self.db.create_restaurant(
            name_hebrew="מסעדת טסט",
            episode_id=self.episode_id,
            name_english="Test Restaurant",
            city="תל אביב",
            cuisine_type="איטלקי",
            price_range="בינוני",
            host_opinion="חיובית",
            google_rating=4.5
        )

        self.restaurant2_id = self.db.create_restaurant(
            name_hebrew="בית קפה טסט",
            episode_id=self.episode_id,
            name_english="Test Cafe",
            city="ירושלים",
            cuisine_type="קפה",
            price_range="זול",
            host_opinion="חיובית מאוד"
        )

    def call_bridge(self, method, args=None):
        """Call the bridge script and return parsed JSON response."""
        args_json = json.dumps(args or {})

        # Set up environment to use test database
        env = os.environ.copy()
        env['WHERE2EAT_DB_PATH'] = self.db_path
        env['PYTHONPATH'] = project_root

        result = subprocess.run(
            [sys.executable, self.bridge_script, method, args_json],
            capture_output=True,
            text=True,
            env=env,
            cwd=project_root
        )

        if result.returncode != 0:
            print(f"STDERR: {result.stderr}")

        return json.loads(result.stdout)

    # ==================== Restaurant Tests ====================

    def test_get_all_restaurants_returns_success(self):
        """Test that get_all_restaurants returns success."""
        result = self.call_bridge('get_all_restaurants')
        assert result['success'] is True
        assert 'restaurants' in result
        assert 'count' in result

    def test_get_all_restaurants_returns_correct_count(self):
        """Test that get_all_restaurants returns correct count."""
        result = self.call_bridge('get_all_restaurants')
        assert result['count'] == 2

    def test_get_all_restaurants_includes_nested_location(self):
        """Test that restaurants have nested location structure."""
        result = self.call_bridge('get_all_restaurants')
        restaurant = result['restaurants'][0]
        assert 'location' in restaurant
        assert 'city' in restaurant['location']

    def test_search_restaurants_filters_by_location(self):
        """Test that search_restaurants filters by location."""
        result = self.call_bridge('search_restaurants', {'location': 'תל אביב'})
        assert result['success'] is True
        assert len(result['restaurants']) == 1
        assert result['restaurants'][0]['location']['city'] == 'תל אביב'

    def test_search_restaurants_filters_by_cuisine(self):
        """Test that search_restaurants filters by cuisine."""
        result = self.call_bridge('search_restaurants', {'cuisine': 'קפה'})
        assert result['success'] is True
        assert len(result['restaurants']) == 1
        assert 'קפה' in result['restaurants'][0]['cuisine_type']

    def test_search_restaurants_returns_analytics(self):
        """Test that search_restaurants returns analytics."""
        result = self.call_bridge('search_restaurants')
        assert result['success'] is True
        assert 'analytics' in result
        assert 'total_count' in result['analytics']
        assert 'filter_counts' in result['analytics']

    def test_get_restaurant_by_id(self):
        """Test getting a single restaurant by ID."""
        result = self.call_bridge('get_restaurant', {'restaurant_id': self.restaurant1_id})
        assert result['success'] is True
        assert result['restaurant']['id'] == self.restaurant1_id
        assert result['restaurant']['name_hebrew'] == 'מסעדת טסט'

    def test_get_restaurant_not_found(self):
        """Test that non-existent restaurant returns error."""
        result = self.call_bridge('get_restaurant', {'restaurant_id': 'non_existent_id'})
        assert result['success'] is False
        assert 'error' in result

    def test_create_restaurant(self):
        """Test creating a new restaurant."""
        result = self.call_bridge('create_restaurant', {
            'name_hebrew': 'מסעדה חדשה',
            'name_english': 'New Restaurant',
            'city': 'חיפה',
            'cuisine_type': 'ים תיכוני'
        })
        assert result['success'] is True
        assert 'restaurant_id' in result

        # Verify it was created
        all_restaurants = self.call_bridge('get_all_restaurants')
        assert all_restaurants['count'] == 3

    def test_update_restaurant(self):
        """Test updating a restaurant."""
        result = self.call_bridge('update_restaurant', {
            'restaurant_id': self.restaurant1_id,
            'name_english': 'Updated Restaurant Name'
        })
        assert result['success'] is True

        # Verify update
        get_result = self.call_bridge('get_restaurant', {'restaurant_id': self.restaurant1_id})
        assert get_result['restaurant']['name_english'] == 'Updated Restaurant Name'

    def test_delete_restaurant(self):
        """Test deleting a restaurant."""
        result = self.call_bridge('delete_restaurant', {'restaurant_id': self.restaurant1_id})
        assert result['success'] is True

        # Verify deletion
        all_restaurants = self.call_bridge('get_all_restaurants')
        assert all_restaurants['count'] == 1

    # ==================== Job Tests ====================

    def test_create_job(self):
        """Test creating a new job."""
        result = self.call_bridge('create_job', {
            'job_type': 'video',
            'video_url': 'https://www.youtube.com/watch?v=test123'
        })
        assert result['success'] is True
        assert 'job_id' in result

    def test_get_job(self):
        """Test getting a job by ID."""
        # Create a job first
        create_result = self.call_bridge('create_job', {
            'job_type': 'channel',
            'channel_url': 'https://www.youtube.com/c/test'
        })
        job_id = create_result['job_id']

        # Get the job
        result = self.call_bridge('get_job', {'job_id': job_id})
        assert result['success'] is True
        assert result['job']['id'] == job_id
        assert result['job']['type'] == 'channel'
        assert result['job']['status'] == 'pending'

    def test_get_job_not_found(self):
        """Test that non-existent job returns error."""
        result = self.call_bridge('get_job', {'job_id': 'non_existent_job'})
        assert result['success'] is False
        assert 'error' in result

    def test_update_job_status(self):
        """Test updating job status."""
        # Create a job
        create_result = self.call_bridge('create_job', {'job_type': 'video'})
        job_id = create_result['job_id']

        # Update status
        result = self.call_bridge('update_job_status', {
            'job_id': job_id,
            'status': 'processing'
        })
        assert result['success'] is True

        # Verify update
        get_result = self.call_bridge('get_job', {'job_id': job_id})
        assert get_result['job']['status'] == 'processing'

    def test_update_job_progress(self):
        """Test updating job progress."""
        # Create a job
        create_result = self.call_bridge('create_job', {'job_type': 'channel'})
        job_id = create_result['job_id']

        # Update progress
        result = self.call_bridge('update_job_progress', {
            'job_id': job_id,
            'videos_completed': 5,
            'videos_total': 10,
            'restaurants_found': 15
        })
        assert result['success'] is True

        # Verify update
        get_result = self.call_bridge('get_job', {'job_id': job_id})
        assert get_result['job']['progress']['videosCompleted'] == 5
        assert get_result['job']['progress']['videosTotal'] == 10
        assert get_result['job']['progress']['restaurantsFound'] == 15

    def test_list_jobs(self):
        """Test listing all jobs."""
        # Create some jobs
        self.call_bridge('create_job', {'job_type': 'video'})
        self.call_bridge('create_job', {'job_type': 'channel'})

        result = self.call_bridge('list_jobs')
        assert result['success'] is True
        assert result['count'] >= 2
        assert len(result['jobs']) >= 2

    def test_list_jobs_with_status_filter(self):
        """Test listing jobs filtered by status."""
        # Create jobs with different statuses
        create_result = self.call_bridge('create_job', {'job_type': 'video'})
        job_id = create_result['job_id']
        self.call_bridge('update_job_status', {'job_id': job_id, 'status': 'completed'})

        # Filter by completed
        result = self.call_bridge('list_jobs', {'status': 'completed'})
        assert result['success'] is True
        assert all(job['status'] == 'completed' for job in result['jobs'])

    def test_cancel_job(self):
        """Test cancelling a job."""
        # Create a job
        create_result = self.call_bridge('create_job', {'job_type': 'video'})
        job_id = create_result['job_id']

        # Cancel it
        result = self.call_bridge('cancel_job', {'job_id': job_id})
        assert result['success'] is True

        # Verify cancellation
        get_result = self.call_bridge('get_job', {'job_id': job_id})
        assert get_result['job']['status'] == 'cancelled'

    # ==================== Analytics Tests ====================

    def test_get_timeline_analytics(self):
        """Test getting timeline analytics."""
        result = self.call_bridge('get_timeline_analytics')
        assert result['success'] is True
        assert 'timeline' in result
        assert 'total_restaurants' in result

    def test_get_trends_analytics(self):
        """Test getting trends analytics."""
        result = self.call_bridge('get_trends_analytics')
        assert result['success'] is True
        assert 'trends' in result
        assert 'top_cuisines' in result['trends']
        assert 'top_locations' in result['trends']

    def test_get_stats(self):
        """Test getting database stats."""
        result = self.call_bridge('get_stats')
        assert result['success'] is True
        assert 'stats' in result
        assert result['stats']['restaurants'] == 2
        assert result['stats']['episodes'] == 1

    # ==================== Episode Tests ====================

    def test_get_all_episodes(self):
        """Test getting all episodes."""
        result = self.call_bridge('get_all_episodes')
        assert result['success'] is True
        assert result['count'] == 1
        assert result['episodes'][0]['video_id'] == 'test_video_123'

    def test_search_episodes(self):
        """Test searching episodes."""
        result = self.call_bridge('search_episodes', {'query': 'Test'})
        assert result['success'] is True
        assert result['count'] >= 0

    # ==================== Error Handling Tests ====================

    def test_unknown_method_returns_error(self):
        """Test that unknown method returns error."""
        result = self.call_bridge('unknown_method_xyz')
        assert result['success'] is False
        assert 'error' in result
        assert 'Unknown method' in result['error']

    def test_missing_required_args_handled_gracefully(self):
        """Test that missing required args are handled."""
        # get_restaurant without restaurant_id should handle gracefully
        result = self.call_bridge('get_restaurant', {})
        assert result['success'] is False


class TestApiDbBridgeIntegration:
    """Integration tests that verify the bridge works with real subprocess calls."""

    def test_bridge_script_exists(self):
        """Test that the bridge script exists."""
        bridge_path = os.path.join(project_root, "scripts", "api_db_bridge.py")
        assert os.path.exists(bridge_path)

    def test_bridge_script_is_executable(self):
        """Test that the bridge script can be executed."""
        bridge_path = os.path.join(project_root, "scripts", "api_db_bridge.py")
        result = subprocess.run(
            [sys.executable, bridge_path, 'get_stats', '{}'],
            capture_output=True,
            text=True,
            cwd=project_root
        )
        # Should produce valid JSON output
        response = json.loads(result.stdout)
        assert 'success' in response

"""
Tests for the SQLite database layer.
These tests verify data persistence independently of the frontend.
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


class TestDatabaseInit:
    """Test database initialization."""

    def test_database_creates_file(self):
        """Test that database file is created."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            db = Database(db_path)

            assert os.path.exists(db_path)

    def test_database_creates_tables(self):
        """Test that required tables are created."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            db = Database(db_path)

            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
                tables = [row['name'] for row in cursor.fetchall()]

                assert 'episodes' in tables
                assert 'restaurants' in tables
                assert 'jobs' in tables

    def test_database_creates_indexes(self):
        """Test that indexes are created."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            db = Database(db_path)

            with db.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT name FROM sqlite_master WHERE type='index'"
                )
                indexes = [row['name'] for row in cursor.fetchall()]

                assert 'idx_restaurants_city' in indexes
                assert 'idx_restaurants_cuisine' in indexes


class TestEpisodeOperations:
    """Test episode CRUD operations."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_create_episode(self, db):
        """Test creating an episode."""
        episode_id = db.create_episode(
            video_id='test123',
            video_url='https://www.youtube.com/watch?v=test123',
            title='Test Episode',
            language='he'
        )

        assert episode_id is not None

    def test_get_episode_by_id(self, db):
        """Test getting episode by ID."""
        episode_id = db.create_episode(
            video_id='test123',
            video_url='https://www.youtube.com/watch?v=test123',
            title='Test Episode'
        )

        episode = db.get_episode(episode_id=episode_id)

        assert episode is not None
        assert episode['video_id'] == 'test123'
        assert episode['title'] == 'Test Episode'

    def test_get_episode_by_video_id(self, db):
        """Test getting episode by video_id."""
        db.create_episode(
            video_id='unique123',
            video_url='https://www.youtube.com/watch?v=unique123'
        )

        episode = db.get_episode(video_id='unique123')

        assert episode is not None
        assert episode['video_id'] == 'unique123'

    def test_episode_upsert_on_duplicate_video_id(self, db):
        """Test that duplicate video_id updates instead of inserting."""
        db.create_episode(
            video_id='dup123',
            video_url='https://www.youtube.com/watch?v=dup123',
            title='Original Title'
        )

        db.create_episode(
            video_id='dup123',
            video_url='https://www.youtube.com/watch?v=dup123',
            title='Updated Title'
        )

        episodes = db.get_all_episodes()
        dup_episodes = [e for e in episodes if e['video_id'] == 'dup123']

        assert len(dup_episodes) == 1
        assert dup_episodes[0]['title'] == 'Updated Title'

    def test_episode_stores_food_trends(self, db):
        """Test that food_trends are stored as JSON."""
        trends = ['Mediterranean', 'Israeli cuisine']
        db.create_episode(
            video_id='trends123',
            video_url='https://www.youtube.com/watch?v=trends123',
            food_trends=trends
        )

        episode = db.get_episode(video_id='trends123')

        assert episode['food_trends'] == trends


class TestRestaurantOperations:
    """Test restaurant CRUD operations."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_create_restaurant(self, db):
        """Test creating a restaurant."""
        restaurant_id = db.create_restaurant(
            name_hebrew='צ\'קולי',
            name_english='Checoli',
            city='תל אביב',
            cuisine_type='Spanish'
        )

        assert restaurant_id is not None

    def test_get_restaurant(self, db):
        """Test getting restaurant by ID."""
        restaurant_id = db.create_restaurant(
            name_hebrew='גורמי סבזי',
            name_english='Gourmet Sabzi',
            city='תל אביב',
            neighborhood='שוק לוינסקי',
            cuisine_type='Persian',
            price_range='budget'
        )

        restaurant = db.get_restaurant(restaurant_id)

        assert restaurant is not None
        assert restaurant['name_hebrew'] == 'גורמי סבזי'
        assert restaurant['location']['city'] == 'תל אביב'
        assert restaurant['location']['neighborhood'] == 'שוק לוינסקי'
        assert restaurant['cuisine_type'] == 'Persian'
        assert restaurant['price_range'] == 'budget'

    def test_restaurant_with_nested_location(self, db):
        """Test creating restaurant with nested location dict."""
        restaurant_id = db.create_restaurant(
            name_hebrew='מסעדה',
            location={
                'city': 'ירושלים',
                'neighborhood': 'מחנה יהודה',
                'address': 'רחוב הנביאים 1',
                'region': 'Center'
            }
        )

        restaurant = db.get_restaurant(restaurant_id)

        assert restaurant['location']['city'] == 'ירושלים'
        assert restaurant['location']['neighborhood'] == 'מחנה יהודה'
        assert restaurant['location']['address'] == 'רחוב הנביאים 1'

    def test_restaurant_with_contact_info(self, db):
        """Test creating restaurant with contact info."""
        restaurant_id = db.create_restaurant(
            name_hebrew='מסעדה',
            contact_info={
                'hours': '12:00-24:00',
                'phone': '03-1234567',
                'website': 'https://example.com'
            }
        )

        restaurant = db.get_restaurant(restaurant_id)

        assert restaurant['contact_info']['hours'] == '12:00-24:00'
        assert restaurant['contact_info']['phone'] == '03-1234567'

    def test_restaurant_with_menu_items(self, db):
        """Test storing menu items as JSON."""
        menu = ['שקשוקה', 'חומוס', 'פלאפל']
        restaurant_id = db.create_restaurant(
            name_hebrew='מסעדה',
            menu_items=menu
        )

        restaurant = db.get_restaurant(restaurant_id)

        assert restaurant['menu_items'] == menu

    def test_update_restaurant(self, db):
        """Test updating a restaurant."""
        restaurant_id = db.create_restaurant(
            name_hebrew='מסעדה',
            price_range='budget'
        )

        success = db.update_restaurant(
            restaurant_id,
            price_range='mid-range',
            host_opinion='positive'
        )

        assert success is True

        restaurant = db.get_restaurant(restaurant_id)
        assert restaurant['price_range'] == 'mid-range'
        assert restaurant['host_opinion'] == 'positive'

    def test_delete_restaurant(self, db):
        """Test deleting a restaurant."""
        restaurant_id = db.create_restaurant(
            name_hebrew='מסעדה לחמריה'
        )

        success = db.delete_restaurant(restaurant_id)
        assert success is True

        restaurant = db.get_restaurant(restaurant_id)
        assert restaurant is None

    def test_get_all_restaurants(self, db):
        """Test getting all restaurants."""
        db.create_restaurant(name_hebrew='מסעדה 1')
        db.create_restaurant(name_hebrew='מסעדה 2')
        db.create_restaurant(name_hebrew='מסעדה 3')

        restaurants = db.get_all_restaurants()

        assert len(restaurants) == 3

    def test_restaurants_with_episode_info(self, db):
        """Test restaurants include episode info when linked."""
        episode_id = db.create_episode(
            video_id='ep123',
            video_url='https://www.youtube.com/watch?v=ep123',
            title='Food Review Episode',
            channel_name='Food Channel'
        )

        db.create_restaurant(
            name_hebrew='מסעדה מקושרת',
            episode_id=episode_id
        )

        restaurants = db.get_all_restaurants(include_episode_info=True)

        assert len(restaurants) == 1
        assert restaurants[0]['episode_info']['video_id'] == 'ep123'
        assert restaurants[0]['episode_info']['channel_name'] == 'Food Channel'


class TestGoogleNamePersistence:
    """Test google_name storage and retrieval."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_create_restaurant_with_google_name(self, db):
        """google_name should be stored and retrievable."""
        restaurant_id = db.create_restaurant(
            name_hebrew='מלגוב מדבר',
            name_english='Malgov Midbar',
            google_name='Milgo Milbar',
            google_place_id='ChIJ123',
        )

        restaurant = db.get_restaurant(restaurant_id)
        assert restaurant['google_places']['google_name'] == 'Milgo Milbar'
        assert restaurant['google_places']['place_id'] == 'ChIJ123'

    def test_create_restaurant_with_google_places_dict(self, db):
        """google_name extracted from google_places dict should be stored."""
        restaurant_id = db.create_restaurant(
            name_hebrew='קבקם',
            google_places={
                'place_id': 'ChIJ456',
                'google_name': 'Kab Kem',
                'google_url': 'https://maps.google.com/...',
            }
        )

        restaurant = db.get_restaurant(restaurant_id)
        assert restaurant['google_places']['google_name'] == 'Kab Kem'
        assert restaurant['google_places']['place_id'] == 'ChIJ456'

    def test_update_restaurant_preserves_google_name(self, db):
        """update_restaurant with google_places dict should persist google_name."""
        restaurant_id = db.create_restaurant(name_hebrew='מסעדה')

        db.update_restaurant(restaurant_id, google_places={
            'place_id': 'ChIJ789',
            'google_name': 'The Restaurant',
        })

        restaurant = db.get_restaurant(restaurant_id)
        assert restaurant['google_place_id'] == 'ChIJ789'
        assert restaurant['google_places']['google_name'] == 'The Restaurant'

    def test_google_name_none_when_not_set(self, db):
        """google_name should be None when not provided."""
        restaurant_id = db.create_restaurant(name_hebrew='מסעדה')

        restaurant = db.get_restaurant(restaurant_id)
        assert restaurant['google_places']['google_name'] is None

    def test_google_name_column_exists(self, db):
        """The google_name column should exist in the restaurants table."""
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(restaurants)")
            columns = [row['name'] for row in cursor.fetchall()]
            assert 'google_name' in columns


class TestRestaurantSearch:
    """Test restaurant search functionality."""

    @pytest.fixture
    def db_with_data(self):
        """Create database with sample data."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            db = Database(db_path)

            # Create episodes
            ep1 = db.create_episode(
                video_id='ep1',
                video_url='https://www.youtube.com/watch?v=ep1',
                analysis_date='2024-01-15'
            )

            ep2 = db.create_episode(
                video_id='ep2',
                video_url='https://www.youtube.com/watch?v=ep2',
                analysis_date='2024-02-20'
            )

            # Create restaurants
            db.create_restaurant(
                name_hebrew='מסעדה ספרדית',
                episode_id=ep1,
                city='תל אביב',
                cuisine_type='Spanish',
                price_range='mid-range',
                host_opinion='positive'
            )

            db.create_restaurant(
                name_hebrew='מסעדה פרסית',
                episode_id=ep1,
                city='תל אביב',
                cuisine_type='Persian',
                price_range='budget',
                host_opinion='positive'
            )

            db.create_restaurant(
                name_hebrew='מסעדה תאילנדית',
                episode_id=ep2,
                city='ירושלים',
                cuisine_type='Thai',
                price_range='expensive',
                host_opinion='neutral'
            )

            yield db

    def test_search_by_location(self, db_with_data):
        """Test searching by location."""
        result = db_with_data.search_restaurants(location='תל אביב')

        assert result['analytics']['total_count'] == 2
        assert len(result['restaurants']) == 2

    def test_search_by_cuisine(self, db_with_data):
        """Test searching by cuisine."""
        result = db_with_data.search_restaurants(cuisine='Persian')

        assert result['analytics']['total_count'] == 1
        assert result['restaurants'][0]['name_hebrew'] == 'מסעדה פרסית'

    def test_search_by_price_range(self, db_with_data):
        """Test searching by price range."""
        result = db_with_data.search_restaurants(price_range='budget')

        assert result['analytics']['total_count'] == 1

    def test_search_by_host_opinion(self, db_with_data):
        """Test searching by host opinion."""
        result = db_with_data.search_restaurants(host_opinion='positive')

        assert result['analytics']['total_count'] == 2

    def test_search_with_date_range(self, db_with_data):
        """Test searching with date range."""
        result = db_with_data.search_restaurants(
            date_start='2024-02-01',
            date_end='2024-02-28'
        )

        assert result['analytics']['total_count'] == 1
        assert result['restaurants'][0]['name_hebrew'] == 'מסעדה תאילנדית'

    def test_search_with_pagination(self, db_with_data):
        """Test search pagination."""
        result = db_with_data.search_restaurants(page=1, limit=2)

        assert len(result['restaurants']) == 2
        assert result['analytics']['total_pages'] == 2
        assert result['analytics']['page'] == 1

        result2 = db_with_data.search_restaurants(page=2, limit=2)
        assert len(result2['restaurants']) == 1

    def test_search_returns_analytics(self, db_with_data):
        """Test that search returns analytics."""
        result = db_with_data.search_restaurants()

        assert 'filter_counts' in result['analytics']
        assert 'cuisine' in result['analytics']['filter_counts']
        assert 'location' in result['analytics']['filter_counts']

    def test_search_combined_filters(self, db_with_data):
        """Test combining multiple filters."""
        result = db_with_data.search_restaurants(
            location='תל אביב',
            host_opinion='positive'
        )

        assert result['analytics']['total_count'] == 2


class TestJobOperations:
    """Test job management operations."""

    @pytest.fixture
    def db(self):
        """Create a temporary test database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield Database(db_path)

    def test_create_job(self, db):
        """Test creating a job."""
        job_id = db.create_job(
            job_type='channel',
            channel_url='https://www.youtube.com/@channel',
            filters={'max_results': 50}
        )

        assert job_id is not None

    def test_get_job(self, db):
        """Test getting a job."""
        job_id = db.create_job(
            job_type='video',
            video_url='https://www.youtube.com/watch?v=test'
        )

        job = db.get_job(job_id)

        assert job is not None
        assert job['job_type'] == 'video'
        assert job['status'] == 'pending'

    def test_update_job_status(self, db):
        """Test updating job status."""
        job_id = db.create_job(job_type='video')

        db.update_job_status(job_id, 'processing')
        job = db.get_job(job_id)
        assert job['status'] == 'processing'

        db.update_job_status(job_id, 'completed')
        job = db.get_job(job_id)
        assert job['status'] == 'completed'
        assert job['completed_at'] is not None

    def test_update_job_progress(self, db):
        """Test updating job progress."""
        job_id = db.create_job(job_type='channel')

        db.update_job_progress(
            job_id,
            videos_completed=5,
            videos_total=20,
            restaurants_found=15
        )

        job = db.get_job(job_id)
        assert job['progress_videos_completed'] == 5
        assert job['progress_videos_total'] == 20
        assert job['progress_restaurants_found'] == 15

    def test_list_jobs_with_status_filter(self, db):
        """Test listing jobs with status filter."""
        job1 = db.create_job(job_type='video')
        job2 = db.create_job(job_type='channel')

        db.update_job_status(job1, 'completed')

        pending_jobs = db.get_jobs(status='pending')
        assert len(pending_jobs) == 1

        completed_jobs = db.get_jobs(status='completed')
        assert len(completed_jobs) == 1


class TestDatabaseStats:
    """Test database statistics."""

    @pytest.fixture
    def db_with_data(self):
        """Create database with sample data."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            db = Database(db_path)

            # Create episodes and restaurants
            ep = db.create_episode(video_id='ep1', video_url='url')
            db.create_restaurant(name_hebrew='מסעדה 1', episode_id=ep, city='תל אביב', cuisine_type='Spanish')
            db.create_restaurant(name_hebrew='מסעדה 2', city='ירושלים', cuisine_type='Persian')

            yield db

    def test_get_stats(self, db_with_data):
        """Test getting database statistics."""
        stats = db_with_data.get_stats()

        assert stats['restaurants'] == 2
        assert stats['episodes'] == 1
        assert stats['unique_cities'] == 2
        assert stats['unique_cuisines'] == 2


class TestJsonImport:
    """Test JSON file import functionality."""

    @pytest.fixture
    def sample_json_dir(self):
        """Create temporary directory with sample JSON files."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create sample restaurant JSON files
            restaurant1 = {
                'name_hebrew': 'צ\'קולי',
                'name_english': 'Checoli',
                'location': {
                    'city': 'תל אביב',
                    'neighborhood': 'נמל תל אביב'
                },
                'cuisine_type': 'Spanish',
                'episode_info': {
                    'video_id': 'test123',
                    'video_url': 'https://www.youtube.com/watch?v=test123',
                    'analysis_date': '2024-01-15'
                }
            }

            restaurant2 = {
                'name_hebrew': 'גורמי סבזי',
                'location': {'city': 'תל אביב'},
                'cuisine_type': 'Persian'
            }

            with open(os.path.join(temp_dir, 'rest1.json'), 'w', encoding='utf-8') as f:
                json.dump(restaurant1, f)

            with open(os.path.join(temp_dir, 'rest2.json'), 'w', encoding='utf-8') as f:
                json.dump(restaurant2, f)

            yield temp_dir

    def test_import_json_files(self, sample_json_dir):
        """Test importing JSON files."""
        with tempfile.TemporaryDirectory() as db_dir:
            db_path = os.path.join(db_dir, 'test.db')
            db = Database(db_path)

            result = db.import_from_json_files(sample_json_dir)

            assert result['imported'] == 2
            assert result['failed'] == 0

            restaurants = db.get_all_restaurants()
            assert len(restaurants) == 2

    def test_import_creates_episodes(self, sample_json_dir):
        """Test that import creates episodes from episode_info."""
        with tempfile.TemporaryDirectory() as db_dir:
            db_path = os.path.join(db_dir, 'test.db')
            db = Database(db_path)

            db.import_from_json_files(sample_json_dir)

            episodes = db.get_all_episodes()
            assert len(episodes) >= 1
            assert any(e['video_id'] == 'test123' for e in episodes)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

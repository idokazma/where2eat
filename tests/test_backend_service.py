"""
Tests for the backend service layer.
These tests verify the full pipeline independently of the frontend.
"""

import os
import sys
import pytest
import tempfile
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from backend_service import BackendService, get_backend_service


class TestBackendServiceInit:
    """Test backend service initialization."""

    def test_service_creates_database(self):
        """Test that service creates database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            service = BackendService(db_path=db_path)

            assert os.path.exists(db_path)

    def test_service_accepts_existing_database(self):
        """Test that service accepts existing database instance."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            db = Database(db_path)

            service = BackendService(db=db)

            assert service.db is db


class TestVideoIdExtraction:
    """Test YouTube video ID extraction."""

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    def test_extract_from_watch_url(self, service):
        """Test extracting video ID from standard watch URL."""
        url = 'https://www.youtube.com/watch?v=6jvskRWvQkg'
        video_id = service.extract_video_id(url)

        assert video_id == '6jvskRWvQkg'

    def test_extract_from_short_url(self, service):
        """Test extracting video ID from short URL."""
        url = 'https://youtu.be/6jvskRWvQkg'
        video_id = service.extract_video_id(url)

        assert video_id == '6jvskRWvQkg'

    def test_extract_from_embed_url(self, service):
        """Test extracting video ID from embed URL."""
        url = 'https://www.youtube.com/v/6jvskRWvQkg'
        video_id = service.extract_video_id(url)

        assert video_id == '6jvskRWvQkg'

    def test_extract_direct_video_id(self, service):
        """Test extracting when given direct video ID."""
        video_id = service.extract_video_id('6jvskRWvQkg')

        assert video_id == '6jvskRWvQkg'

    def test_invalid_url_returns_none(self, service):
        """Test that invalid URL returns None."""
        assert service.extract_video_id('not_a_url') is None
        assert service.extract_video_id('https://vimeo.com/123') is None
        assert service.extract_video_id('') is None


class TestTranscriptFetching:
    """Test transcript fetching functionality."""

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    @pytest.fixture
    def mock_transcript_data(self):
        """Sample transcript data."""
        return {
            'video_id': '6jvskRWvQkg',
            'video_url': 'https://www.youtube.com/watch?v=6jvskRWvQkg',
            'language': 'he',
            'transcript': 'שלום זוהי בדיקה של מסעדה צ\'קולי בתל אביב',
            'segments': [
                {'text': 'שלום זוהי בדיקה', 'start': 0.0, 'duration': 3.0},
                {'text': 'של מסעדה צ\'קולי', 'start': 3.0, 'duration': 3.0},
                {'text': 'בתל אביב', 'start': 6.0, 'duration': 2.0}
            ]
        }

    def test_fetch_transcript_invalid_url(self, service):
        """Test fetching with invalid URL returns error."""
        result = service.fetch_transcript('not_a_url')

        assert result['success'] is False
        assert 'Invalid YouTube URL' in result['error']

    @patch('backend_service.BackendService._get_transcript_collector')
    def test_fetch_transcript_success(self, mock_collector, service, mock_transcript_data):
        """Test successful transcript fetching."""
        mock_instance = Mock()
        mock_instance.get_transcript.return_value = mock_transcript_data
        mock_collector.return_value = mock_instance

        result = service.fetch_transcript('https://www.youtube.com/watch?v=6jvskRWvQkg')

        assert result['success'] is True
        assert result['video_id'] == '6jvskRWvQkg'
        assert 'צ\'קולי' in result['transcript']
        assert len(result['segments']) == 3

    @patch('backend_service.BackendService._get_transcript_collector')
    def test_fetch_transcript_not_found(self, mock_collector, service):
        """Test when transcript is not available."""
        mock_instance = Mock()
        mock_instance.get_transcript.return_value = None
        mock_instance.get_transcript_auto.return_value = None
        mock_collector.return_value = mock_instance

        # Use a valid 11-character video ID
        result = service.fetch_transcript('https://www.youtube.com/watch?v=notFound123')

        assert result['success'] is False
        assert 'Failed to fetch transcript' in result['error']


class TestTranscriptAnalysis:
    """Test transcript analysis functionality."""

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    @pytest.fixture
    def valid_transcript_data(self):
        """Valid transcript data for analysis."""
        return {
            'success': True,
            'video_id': 'test123',
            'video_url': 'https://www.youtube.com/watch?v=test123',
            'language': 'he',
            'transcript': '''
            היום נדבר על מסעדה מעולה בתל אביב - צ'קולי.
            זה מקום ספרדי עם נוף לים ואוכל מדהים.
            המחירים הם בסביבות 100-150 שקל למנה.
            ''',
            'segments': []
        }

    def test_analyze_invalid_transcript(self, service):
        """Test analyzing invalid transcript returns error."""
        result = service.analyze_transcript({'success': False})

        assert result['success'] is False
        assert result['restaurants'] == []

    @patch('backend_service.BackendService._get_analyzer')
    def test_analyze_transcript_success(self, mock_analyzer, service, valid_transcript_data):
        """Test successful transcript analysis."""
        mock_instance = Mock()
        mock_instance.analyze_transcript.return_value = {
            'restaurants': [
                {
                    'name_hebrew': 'צ\'קולי',
                    'name_english': 'Checoli',
                    'location': {'city': 'תל אביב'},
                    'cuisine_type': 'Spanish'
                }
            ],
            'food_trends': ['ספרדי'],
            'episode_summary': 'סקירה של מסעדה ספרדית'
        }
        mock_analyzer.return_value = mock_instance

        result = service.analyze_transcript(valid_transcript_data)

        assert result['success'] is True
        assert len(result['restaurants']) == 1
        assert result['restaurants'][0]['name_hebrew'] == 'צ\'קולי'


class TestFullPipeline:
    """Test full video processing pipeline."""

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    @pytest.fixture
    def mock_transcript_data(self):
        """Sample transcript data."""
        return {
            'video_id': 'pipeTest123',  # Must be exactly 11 characters like real YouTube IDs
            'video_url': 'https://www.youtube.com/watch?v=pipeTest123',
            'language': 'he',
            'transcript': 'מסעדה צ\'קולי בתל אביב היא מקום ספרדי נהדר',
            'segments': []
        }

    @patch('backend_service.BackendService._get_analyzer')
    @patch('backend_service.BackendService._get_transcript_collector')
    def test_process_video_full_pipeline(
        self, mock_collector, mock_analyzer, service, mock_transcript_data
    ):
        """Test full video processing pipeline."""
        # Mock transcript collector
        mock_transcript_instance = Mock()
        mock_transcript_instance.get_transcript.return_value = mock_transcript_data
        mock_collector.return_value = mock_transcript_instance

        # Mock analyzer
        mock_analyzer_instance = Mock()
        mock_analyzer_instance.analyze_transcript.return_value = {
            'restaurants': [
                {
                    'name_hebrew': 'צ\'קולי',
                    'name_english': 'Checoli',
                    'location': {'city': 'תל אביב', 'region': 'Center'},
                    'cuisine_type': 'Spanish',
                    'price_range': 'mid-range'
                }
            ],
            'food_trends': ['ספרדי'],
            'episode_summary': 'סקירת מסעדה ספרדית'
        }
        mock_analyzer.return_value = mock_analyzer_instance

        result = service.process_video(
            video_url='https://www.youtube.com/watch?v=pipeTest123'
        )

        assert result['success'] is True
        assert result['video_id'] == 'pipeTest123'
        assert result['restaurants_found'] == 1
        assert len(result['restaurants']) == 1
        assert result['episode_id'] is not None

        # Verify data was saved to database
        restaurants = service.get_all_restaurants()
        assert len(restaurants) == 1
        assert restaurants[0]['name_hebrew'] == 'צ\'קולי'

    @patch('backend_service.BackendService._get_transcript_collector')
    def test_process_video_transcript_failure(self, mock_collector, service):
        """Test pipeline handles transcript failure."""
        mock_instance = Mock()
        mock_instance.get_transcript.return_value = None
        mock_instance.get_transcript_auto.return_value = None
        mock_collector.return_value = mock_instance

        result = service.process_video(
            video_url='https://www.youtube.com/watch?v=no_transcript'
        )

        assert result['success'] is False
        assert 'Failed to fetch transcript' in result['error']

    def test_process_video_invalid_url(self, service):
        """Test pipeline handles invalid URL."""
        result = service.process_video(video_url='not_a_url')

        assert result['success'] is False
        assert 'Invalid YouTube URL' in result['error']

    @patch('backend_service.BackendService._get_analyzer')
    @patch('backend_service.BackendService._get_transcript_collector')
    def test_process_video_with_progress_callback(
        self, mock_collector, mock_analyzer, service, mock_transcript_data
    ):
        """Test progress callback is called."""
        mock_transcript_instance = Mock()
        mock_transcript_instance.get_transcript.return_value = mock_transcript_data
        mock_collector.return_value = mock_transcript_instance

        mock_analyzer_instance = Mock()
        mock_analyzer_instance.analyze_transcript.return_value = {
            'restaurants': [],
            'food_trends': [],
            'episode_summary': ''
        }
        mock_analyzer.return_value = mock_analyzer_instance

        progress_steps = []

        def track_progress(step, progress):
            progress_steps.append((step, progress))

        # Use valid 11-character video ID
        service.process_video(
            video_url='https://www.youtube.com/watch?v=pipeTest123',
            progress_callback=track_progress
        )

        assert len(progress_steps) > 0
        assert any(step == 'completed' for step, _ in progress_steps)


class TestRestaurantCRUD:
    """Test restaurant CRUD operations via service."""

    @pytest.fixture
    def service_with_data(self):
        """Create service with sample data."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            service = BackendService(db_path=db_path)

            # Add sample restaurants
            service.create_restaurant({
                'name_hebrew': 'מסעדה 1',
                'city': 'תל אביב',
                'cuisine_type': 'Spanish',
                'price_range': 'mid-range',
                'host_opinion': 'positive'
            })

            service.create_restaurant({
                'name_hebrew': 'מסעדה 2',
                'city': 'ירושלים',
                'cuisine_type': 'Persian',
                'price_range': 'budget',
                'host_opinion': 'positive'
            })

            yield service

    def test_get_all_restaurants(self, service_with_data):
        """Test getting all restaurants."""
        restaurants = service_with_data.get_all_restaurants()

        assert len(restaurants) == 2

    def test_search_restaurants_by_location(self, service_with_data):
        """Test searching by location."""
        result = service_with_data.search_restaurants(location='תל אביב')

        assert result['analytics']['total_count'] == 1

    def test_search_restaurants_by_cuisine(self, service_with_data):
        """Test searching by cuisine."""
        result = service_with_data.search_restaurants(cuisine='Spanish')

        assert result['analytics']['total_count'] == 1

    def test_create_restaurant(self, service_with_data):
        """Test creating restaurant via service."""
        restaurant_id = service_with_data.create_restaurant({
            'name_hebrew': 'מסעדה חדשה',
            'city': 'חיפה'
        })

        assert restaurant_id is not None

        restaurant = service_with_data.get_restaurant(restaurant_id)
        assert restaurant['name_hebrew'] == 'מסעדה חדשה'

    def test_update_restaurant(self, service_with_data):
        """Test updating restaurant via service."""
        restaurants = service_with_data.get_all_restaurants()
        restaurant_id = restaurants[0]['id']

        success = service_with_data.update_restaurant(
            restaurant_id,
            {'host_comments': 'מקום נהדר!'}
        )

        assert success is True

        updated = service_with_data.get_restaurant(restaurant_id)
        assert updated['host_comments'] == 'מקום נהדר!'

    def test_delete_restaurant(self, service_with_data):
        """Test deleting restaurant via service."""
        restaurants = service_with_data.get_all_restaurants()
        restaurant_id = restaurants[0]['id']

        success = service_with_data.delete_restaurant(restaurant_id)

        assert success is True

        deleted = service_with_data.get_restaurant(restaurant_id)
        assert deleted is None


class TestEpisodeOperations:
    """Test episode operations via service."""

    @pytest.fixture
    def service_with_episodes(self):
        """Create service with episodes and restaurants."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            service = BackendService(db_path=db_path)

            # Create episodes with restaurants
            ep1 = service.db.create_episode(
                video_id='ep1',
                video_url='https://youtube.com/watch?v=ep1',
                title='Episode 1',
                analysis_date='2024-01-15'
            )

            ep2 = service.db.create_episode(
                video_id='ep2',
                video_url='https://youtube.com/watch?v=ep2',
                title='Episode 2',
                analysis_date='2024-02-20'
            )

            service.db.create_restaurant(
                name_hebrew='מסעדה 1',
                episode_id=ep1,
                city='תל אביב',
                cuisine_type='Spanish'
            )

            service.db.create_restaurant(
                name_hebrew='מסעדה 2',
                episode_id=ep1,
                city='תל אביב',
                cuisine_type='Italian'
            )

            service.db.create_restaurant(
                name_hebrew='מסעדה 3',
                episode_id=ep2,
                city='ירושלים',
                cuisine_type='Thai'
            )

            yield service

    def test_get_all_episodes(self, service_with_episodes):
        """Test getting all episodes."""
        episodes = service_with_episodes.get_all_episodes()

        assert len(episodes) == 2

    def test_get_episode_by_video_id(self, service_with_episodes):
        """Test getting episode by video ID."""
        episode = service_with_episodes.get_episode(video_id='ep1')

        assert episode is not None
        assert episode['title'] == 'Episode 1'

    def test_search_episodes(self, service_with_episodes):
        """Test searching episodes."""
        result = service_with_episodes.search_episodes(min_restaurants=2)

        # Only ep1 has 2 restaurants
        assert result['count'] == 1

    def test_search_episodes_by_location(self, service_with_episodes):
        """Test searching episodes by restaurant location."""
        result = service_with_episodes.search_episodes(location_filter='תל אביב')

        assert result['count'] == 1


class TestAnalytics:
    """Test analytics functionality."""

    @pytest.fixture
    def service_with_data(self):
        """Create service with sample data for analytics."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            service = BackendService(db_path=db_path)

            # Create episodes and restaurants
            ep1 = service.db.create_episode(
                video_id='ep1',
                video_url='url1',
                analysis_date='2024-01-15'
            )

            ep2 = service.db.create_episode(
                video_id='ep2',
                video_url='url2',
                analysis_date='2024-01-20'
            )

            service.db.create_restaurant(
                name_hebrew='מסעדה 1',
                episode_id=ep1,
                city='תל אביב',
                region='Center',
                cuisine_type='Spanish',
                host_opinion='positive'
            )

            service.db.create_restaurant(
                name_hebrew='מסעדה 2',
                episode_id=ep2,
                city='ירושלים',
                region='Center',
                cuisine_type='Persian',
                host_opinion='neutral'
            )

            yield service

    def test_timeline_analytics(self, service_with_data):
        """Test timeline analytics."""
        result = service_with_data.get_timeline_analytics()

        assert 'timeline' in result
        assert 'analytics' in result
        assert 'summary' in result
        assert result['summary']['total_restaurants'] == 2

    def test_timeline_analytics_with_cuisine_filter(self, service_with_data):
        """Test timeline analytics with cuisine filter."""
        result = service_with_data.get_timeline_analytics(cuisine_filter='Spanish')

        assert result['summary']['total_restaurants'] == 1

    def test_trends_analytics(self, service_with_data):
        """Test trends analytics."""
        result = service_with_data.get_trends_analytics(period='1year')

        assert 'trending_restaurants' in result
        assert 'regional_patterns' in result
        assert 'period_summary' in result


class TestJobManagement:
    """Test job management functionality."""

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    def test_create_job(self, service):
        """Test creating a job."""
        job_id = service.create_job(
            job_type='channel',
            channel_url='https://youtube.com/@channel'
        )

        assert job_id is not None

    def test_get_job_status(self, service):
        """Test getting job status."""
        job_id = service.create_job(job_type='video')

        status = service.get_job_status(job_id)

        assert status is not None
        assert status['status'] == 'pending'
        assert status['job_id'] == job_id

    def test_update_job_progress(self, service):
        """Test updating job progress."""
        job_id = service.create_job(job_type='channel')

        success = service.update_job_progress(
            job_id,
            videos_completed=5,
            videos_total=20,
            restaurants_found=15
        )

        assert success is True

        status = service.get_job_status(job_id)
        assert status['progress']['videos_completed'] == 5

    def test_cancel_job(self, service):
        """Test cancelling a job."""
        job_id = service.create_job(job_type='video')

        success = service.cancel_job(job_id)

        assert success is True

        status = service.get_job_status(job_id)
        assert status['status'] == 'cancelled'

    def test_list_jobs(self, service):
        """Test listing jobs."""
        service.create_job(job_type='video')
        service.create_job(job_type='channel')

        jobs = service.list_jobs()

        assert len(jobs) == 2


class TestHealthCheck:
    """Test health check functionality."""

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    def test_health_check_basic(self, service):
        """Test basic health check."""
        health = service.health_check()

        assert 'status' in health
        assert 'checks' in health
        assert 'timestamp' in health
        assert health['checks']['database'] is True


class TestStats:
    """Test statistics functionality."""

    @pytest.fixture
    def service_with_data(self):
        """Create service with sample data."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            service = BackendService(db_path=db_path)

            service.create_restaurant({
                'name_hebrew': 'מסעדה',
                'city': 'תל אביב'
            })

            yield service

    def test_get_stats(self, service_with_data):
        """Test getting statistics."""
        stats = service_with_data.get_stats()

        assert stats['restaurants'] == 1
        assert 'episodes' in stats
        assert 'unique_cities' in stats


class TestAnalyzeTranscriptCallConvention:
    """Test that BackendService.analyze_transcript passes correct args to UnifiedRestaurantAnalyzer.

    Regression tests for a bug where analyze_transcript was called with keyword
    arguments (transcript_text=, video_id=, ...) instead of a single dict, causing:
        TypeError: analyze_transcript() got an unexpected keyword argument 'transcript_text'
    """

    @pytest.fixture
    def service(self):
        """Create service with temp database."""
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = os.path.join(temp_dir, 'test.db')
            yield BackendService(db_path=db_path)

    @pytest.fixture
    def valid_transcript_data(self):
        """Valid transcript data as returned by fetch_transcript."""
        return {
            'success': True,
            'video_id': 'testVid1234',
            'video_url': 'https://www.youtube.com/watch?v=testVid1234',
            'language': 'he',
            'transcript': 'היום נדבר על מסעדת צ\'קולי בתל אביב',
            'segments': []
        }

    @patch('backend_service.BackendService._get_analyzer')
    def test_analyze_transcript_passes_dict_not_kwargs(self, mock_get_analyzer, service, valid_transcript_data):
        """Verify analyzer.analyze_transcript receives a single dict argument, not keyword args."""
        mock_analyzer = Mock()
        mock_analyzer.analyze_transcript.return_value = {
            'restaurants': [{'name_hebrew': 'צ\'קולי', 'name_english': 'Chakoli'}],
            'food_trends': [],
            'episode_summary': 'test'
        }
        mock_get_analyzer.return_value = mock_analyzer

        service.analyze_transcript(valid_transcript_data)

        # Must have been called exactly once
        mock_analyzer.analyze_transcript.assert_called_once()

        # Must have been called with a single positional dict arg, not keyword args
        args, kwargs = mock_analyzer.analyze_transcript.call_args
        assert len(args) == 1, "analyze_transcript should receive exactly one positional argument"
        assert isinstance(args[0], dict), "The argument should be a dictionary"
        assert len(kwargs) == 0, "analyze_transcript should not receive keyword arguments"

    @patch('backend_service.BackendService._get_analyzer')
    def test_analyze_transcript_dict_contains_required_keys(self, mock_get_analyzer, service, valid_transcript_data):
        """Verify the dict passed to analyzer contains the keys it expects."""
        mock_analyzer = Mock()
        mock_analyzer.analyze_transcript.return_value = {
            'restaurants': [],
            'food_trends': [],
            'episode_summary': ''
        }
        mock_get_analyzer.return_value = mock_analyzer

        service.analyze_transcript(valid_transcript_data)

        args, _ = mock_analyzer.analyze_transcript.call_args
        passed_dict = args[0]

        # UnifiedRestaurantAnalyzer.analyze_transcript expects these keys
        assert 'transcript' in passed_dict, "Dict must contain 'transcript' key"
        assert 'video_id' in passed_dict, "Dict must contain 'video_id' key"
        assert 'video_url' in passed_dict, "Dict must contain 'video_url' key"
        assert 'language' in passed_dict, "Dict must contain 'language' key"

        # Verify values are forwarded correctly
        assert passed_dict['transcript'] == valid_transcript_data['transcript']
        assert passed_dict['video_id'] == valid_transcript_data['video_id']
        assert passed_dict['video_url'] == valid_transcript_data['video_url']
        assert passed_dict['language'] == valid_transcript_data['language']

    @patch('backend_service.BackendService._get_analyzer')
    @patch('backend_service.BackendService._get_transcript_collector')
    def test_process_video_analyze_step_receives_dict(
        self, mock_collector, mock_get_analyzer, service
    ):
        """End-to-end: process_video calls analyzer.analyze_transcript with a dict."""
        # Mock transcript collector
        mock_transcript_instance = Mock()
        mock_transcript_instance.get_transcript.return_value = {
            'video_id': 'e2eTest1234',
            'video_url': 'https://www.youtube.com/watch?v=e2eTest1234',
            'language': 'he',
            'transcript': 'מסעדת גורמי סבזי בירושלים מומלצת מאוד',
            'segments': []
        }
        mock_collector.return_value = mock_transcript_instance

        # Mock analyzer
        mock_analyzer = Mock()
        mock_analyzer.analyze_transcript.return_value = {
            'restaurants': [
                {
                    'name_hebrew': 'גורמי סבזי',
                    'name_english': 'Gormi Sabzi',
                    'location': {'city': 'ירושלים', 'region': 'Center'},
                    'cuisine_type': 'Persian'
                }
            ],
            'food_trends': ['פרסי פופולרי'],
            'episode_summary': 'סקירת מסעדה פרסית'
        }
        mock_get_analyzer.return_value = mock_analyzer

        result = service.process_video(
            video_url='https://www.youtube.com/watch?v=e2eTest1234'
        )

        # Pipeline should succeed (not crash with TypeError)
        assert result['success'] is True
        assert result['restaurants_found'] == 1

        # Verify the analyzer was called with a dict, not kwargs
        args, kwargs = mock_analyzer.analyze_transcript.call_args
        assert len(args) == 1 and isinstance(args[0], dict)
        assert args[0]['transcript'] == 'מסעדת גורמי סבזי בירושלים מומלצת מאוד'
        assert args[0]['video_id'] == 'e2eTest1234'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

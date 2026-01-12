"""
Test suite for YouTube transcript extraction functionality
Tests the youtube_transcript_collector.py module
"""

import os
import sys
import pytest
import json
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from youtube_transcript_collector import YouTubeTranscriptCollector


class TestYouTubeTranscriptCollector:
    """Test cases for YouTube transcript collection"""
    
    @pytest.fixture
    def collector(self):
        """Create a YouTubeTranscriptCollector instance"""
        return YouTubeTranscriptCollector()
    
    @pytest.fixture
    def sample_transcript_data(self):
        """Sample transcript data for testing"""
        return [
            {'text': 'שלום וברוכים הבאים', 'start': 0.0, 'duration': 3.0},
            {'text': 'היום נדבר על מסעדות', 'start': 3.0, 'duration': 4.0},
            {'text': 'המסעדה הראשונה היא צ\'קולי', 'start': 7.0, 'duration': 5.0},
            {'text': 'שנמצאת בתל אביב', 'start': 12.0, 'duration': 3.0}
        ]
    
    def test_extract_video_id_from_url(self, collector):
        """Test video ID extraction from various YouTube URL formats"""
        test_cases = [
            ("https://www.youtube.com/watch?v=6jvskRWvQkg", "6jvskRWvQkg"),
            ("https://youtu.be/6jvskRWvQkg", "6jvskRWvQkg"),
            ("https://www.youtube.com/watch?v=6jvskRWvQkg&t=100s", "6jvskRWvQkg"),
            ("https://m.youtube.com/watch?v=6jvskRWvQkg", "6jvskRWvQkg"),
        ]

        for url, expected_id in test_cases:
            video_id = collector.extract_video_id(url)
            assert video_id == expected_id, f"Failed for URL: {url}"
    
    def test_extract_video_id_invalid_url(self, collector):
        """Test video ID extraction with invalid URLs"""
        invalid_urls = [
            "not_a_url",
            "https://google.com",
            "https://youtube.com/invalid",
            "",
            None
        ]

        for url in invalid_urls:
            video_id = collector.extract_video_id(url)
            assert video_id is None, f"Should return None for invalid URL: {url}"
    
    @patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript')
    def test_get_transcript_success(self, mock_get_transcript, collector, sample_transcript_data):
        """Test successful transcript retrieval"""
        mock_get_transcript.return_value = sample_transcript_data
        
        video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
        result = collector.get_transcript(video_url, languages=['he'])
        
        assert result is not None
        assert result['video_id'] == '6jvskRWvQkg'
        assert result['video_url'] == video_url
        assert result['language'] == 'he'
        assert result['segment_count'] == 4
        assert 'שלום וברוכים הבאים' in result['transcript']
        assert 'המסעדה הראשונה היא צ\'קולי' in result['transcript']
        
        mock_get_transcript.assert_called_once_with('6jvskRWvQkg', languages=['he'])
    
    @patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript')
    def test_get_transcript_api_error(self, mock_get_transcript, collector):
        """Test transcript retrieval when API throws exception"""
        from youtube_transcript_api._errors import TranscriptsDisabled
        mock_get_transcript.side_effect = TranscriptsDisabled('6jvskRWvQkg')
        
        video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
        result = collector.get_transcript(video_url, languages=['he'])
        
        assert result is None
        mock_get_transcript.assert_called_once()
    
    @patch('youtube_transcript_api.YouTubeTranscriptApi.list_transcripts')
    @patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript')
    def test_get_transcript_auto_success(self, mock_get_transcript, mock_list_transcripts, collector, sample_transcript_data):
        """Test auto transcript detection"""
        # Mock transcript list
        mock_transcript = Mock()
        mock_transcript.language_code = 'he'
        mock_transcript.fetch.return_value = sample_transcript_data
        
        mock_transcript_list = Mock()
        mock_transcript_list.find_transcript.return_value = mock_transcript
        
        mock_list_transcripts.return_value = mock_transcript_list
        
        video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
        result = collector.get_transcript_auto(video_url)
        
        assert result is not None
        assert result['video_id'] == '6jvskRWvQkg'
        assert result['language'] == 'he'
        assert len(result['segments']) == 4
        
        mock_list_transcripts.assert_called_once_with('6jvskRWvQkg')
    
    # Commented out - these methods are not part of the current implementation
    # def test_format_transcript_segments(self, collector, sample_transcript_data):
    #     """Test transcript formatting functionality"""
    #     formatted = collector._format_transcript(sample_transcript_data)
    #
    #     expected_content = [
    #         'שלום וברוכים הבאים',
    #         'היום נדבר על מסעדות',
    #         'המסעדה הראשונה היא צ\'קולי',
    #         'שנמצאת בתל אביב'
    #     ]
    #
    #     for expected_text in expected_content:
    #         assert expected_text in formatted
    #
    #     # Check that transcript flows naturally
    #     lines = formatted.strip().split('\n')
    #     assert len(lines) >= 4

    # def test_segment_parsing(self, collector):
    #     """Test individual segment parsing"""
    #     segment = {'text': 'היום נדבר על מסעדות טובות', 'start': 5.5, 'duration': 3.2}
    #
    #     parsed = collector._parse_segment(segment)
    #
    #     assert parsed['text'] == 'היום נדבר על מסעדות טובות'
    #     assert parsed['start_time'] == 5.5
    #     assert parsed['duration'] == 3.2
    #     assert parsed['end_time'] == 8.7
    
    @patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript')
    def test_multiple_language_fallback(self, mock_get_transcript, collector, sample_transcript_data):
        """Test language fallback when primary language fails"""
        def side_effect(video_id, languages):
            if languages == ['he']:
                from youtube_transcript_api._errors import NoTranscriptFound
                raise NoTranscriptFound(video_id, ['he'], [])
            elif languages == ['en']:
                return sample_transcript_data
            
        mock_get_transcript.side_effect = side_effect
        
        video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
        result = collector.get_transcript(video_url, languages=['he', 'en'])
        
        assert result is not None
        assert result['language'] == 'en'
        assert mock_get_transcript.call_count == 2


class TestTranscriptIntegration:
    """Integration tests for the transcript system"""

    @pytest.mark.integration
    def test_real_video_processing_with_caching(self, tmp_path):
        """Test with real YouTube video URLs including caching"""
        import random

        # Use one of the provided test URLs
        test_urls = [
            "https://www.youtube.com/watch?v=8fKi1aA24-w",
            "https://www.youtube.com/watch?v=f9L1k9RctpM"
        ]
        video_url = random.choice(test_urls)
        video_id = YouTubeTranscriptCollector.extract_video_id(video_url)

        # Test with database caching
        db_path = tmp_path / "integration_test.db"
        from database import Database
        db = Database(str(db_path))
        collector = YouTubeTranscriptCollector(database=db, rate_limit_seconds=5)

        # First call - should fetch from API and cache
        print(f"\nTesting with URL: {video_url}")
        result1 = collector.get_transcript(video_url, languages=['he', 'iw', 'en'])

        if result1:  # Only test if transcript is available
            print(f"✓ Successfully fetched transcript for video: {video_id}")
            assert result1['video_id'] == video_id
            assert result1['video_url'] == f'https://www.youtube.com/watch?v={video_id}'
            assert result1['segment_count'] > 0
            assert len(result1['transcript']) > 100  # Should have substantial content
            assert isinstance(result1['segments'], list)
            assert result1['cached'] is False

            # Second call - should use cache
            result2 = collector.get_transcript(video_url, languages=['he', 'iw', 'en'])
            assert result2 is not None
            assert result2['cached'] is True
            assert result2['transcript'] == result1['transcript']
            print(f"✓ Successfully retrieved from cache")
        else:
            pytest.skip("Real video transcript not available - testing offline functionality only")

    @pytest.mark.integration
    def test_health_check_with_real_api(self):
        """Test health check with real YouTube API connection"""
        collector = YouTubeTranscriptCollector()

        health = collector.health_check()

        print(f"\nHealth check status: {health['status']}")
        print(f"API connectivity: {health['api_connectivity']}")

        assert 'status' in health
        assert 'timestamp' in health
        assert 'api_connectivity' in health
        assert health['status'] in ['healthy', 'degraded', 'unhealthy']

        # API connectivity might be True or False depending on network/quota
        assert isinstance(health['api_connectivity'], bool)

    def test_real_video_processing(self):
        """Test with the actual video URL provided by user"""
        # Note: This test requires internet connection and may fail if video becomes unavailable
        video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
        collector = YouTubeTranscriptCollector()

        # Try to get transcript (may fail if video unavailable or no transcript)
        result = collector.get_transcript(video_url, languages=['he', 'iw'])

        if result:  # Only test if transcript is available
            assert result['video_id'] == '6jvskRWvQkg'
            assert result['video_url'] == video_url
            assert result['language'] in ['he', 'iw', 'en']  # Common languages
            assert result['segment_count'] > 0
            assert len(result['transcript']) > 100  # Should have substantial content
            assert isinstance(result['segments'], list)
        else:
            pytest.skip("Real video transcript not available - testing offline functionality only")
    
    def test_transcript_data_structure(self):
        """Test the structure of returned transcript data"""
        collector = YouTubeTranscriptCollector()

        # Mock a successful response
        with patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript') as mock_get:
            mock_get.return_value = [
                {'text': 'מילים בעברית', 'start': 0.0, 'duration': 2.0},
                {'text': 'עוד מילים', 'start': 2.0, 'duration': 1.5}
            ]

            result = collector.get_transcript("https://www.youtube.com/watch?v=test1234567")

            # Verify required fields
            required_fields = [
                'video_id', 'video_url', 'language', 'transcript',
                'segments', 'segment_count'
            ]

            for field in required_fields:
                assert field in result, f"Missing required field: {field}"

            assert isinstance(result['segments'], list)
            assert result['segment_count'] == 2
            assert result['video_id'] == 'test1234567'


def test_error_handling():
    """Test error handling scenarios"""
    collector = YouTubeTranscriptCollector()

    # Test with None input
    result = collector.get_transcript(None)
    assert result is None

    # Test with empty string
    result = collector.get_transcript("")
    assert result is None

    # Test with invalid URL format
    result = collector.get_transcript("not_a_youtube_url")
    assert result is None


class TestTranscriptCaching:
    """Test cases for transcript caching functionality"""

    @pytest.fixture
    def collector_with_db(self, tmp_path):
        """Create collector with temporary database"""
        db_path = tmp_path / "test_cache.db"
        from database import Database
        db = Database(str(db_path))
        collector = YouTubeTranscriptCollector(database=db)
        return collector, db

    def test_get_transcript_checks_cache_first(self, collector_with_db):
        """Test that get_transcript checks cache before API call"""
        collector, db = collector_with_db
        video_id = "test1234567"  # 11 characters for valid YouTube ID
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        # Pre-populate cache
        db.create_episode(
            video_id=video_id,
            video_url=video_url,
            transcript="Cached transcript text"
        )

        # Should return cached transcript without API call
        with patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript') as mock_get:
            result = collector.get_transcript(video_url)

            # API should not be called
            mock_get.assert_not_called()

            # Should return cached data
            assert result is not None
            assert result['transcript'] == "Cached transcript text"
            assert result['video_id'] == video_id

    def test_get_transcript_caches_new_transcripts(self, collector_with_db):
        """Test that get_transcript stores new transcripts in cache"""
        collector, db = collector_with_db
        video_id = "newvid45678"  # 11 characters
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        # Mock API response (get_transcript returns list of dicts)
        mock_transcript = [
            {'text': "First segment", 'start': 0.0, 'duration': 2.0},
            {'text': "Second segment", 'start': 2.0, 'duration': 3.0}
        ]

        with patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript', return_value=mock_transcript):
            result = collector.get_transcript(video_url)

            assert result is not None

            # Check that transcript was cached in database
            episode = db.get_episode(video_id=video_id)
            assert episode is not None
            assert "First segment" in episode['transcript']
            assert "Second segment" in episode['transcript']

    def test_cache_miss_falls_back_to_api(self, collector_with_db):
        """Test that cache miss triggers API call"""
        collector, db = collector_with_db
        video_id = "notcached01"  # 11 characters
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        mock_transcript = [{'text': "API data", 'start': 0.0, 'duration': 1.0}]

        with patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript', return_value=mock_transcript) as mock_get:
            result = collector.get_transcript(video_url)

            # API should be called since not in cache
            mock_get.assert_called_once()
            assert result is not None
            assert "API data" in result['transcript']


class TestRateLimiting:
    """Test cases for rate limiting functionality"""

    @pytest.fixture
    def rate_limited_collector(self):
        """Create collector with rate limiting enabled"""
        collector = YouTubeTranscriptCollector(rate_limit_seconds=30)
        return collector

    def test_rate_limiter_enforces_delay(self, rate_limited_collector):
        """Test that rate limiter enforces 30 second delay between requests"""
        import time

        mock_transcript = [{'text': "test", 'start': 0.0, 'duration': 1.0}]

        with patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript', return_value=mock_transcript):
            # First request should succeed immediately
            start_time = time.time()
            result1 = rate_limited_collector.get_transcript("https://www.youtube.com/watch?v=test1234567")
            first_request_time = time.time() - start_time

            assert result1 is not None
            assert first_request_time < 1.0  # Should be fast

            # Second request should be delayed
            start_time = time.time()
            result2 = rate_limited_collector.get_transcript("https://www.youtube.com/watch?v=test7654321")
            second_request_time = time.time() - start_time

            assert result2 is not None
            # Should wait close to 30 seconds (allow 1 second tolerance)
            assert second_request_time >= 29.0

    def test_rate_limiter_status_method(self, rate_limited_collector):
        """Test that rate limiter exposes status information"""
        status = rate_limited_collector.get_rate_limit_status()

        assert 'requests_made' in status
        assert 'time_until_next_available' in status
        assert 'rate_limit_seconds' in status
        assert status['rate_limit_seconds'] == 30

    def test_rate_limiter_respects_cache(self, tmp_path):
        """Test that cached requests don't count toward rate limit"""
        db_path = tmp_path / "test_rate_cache.db"
        from database import Database
        db = Database(str(db_path))
        collector = YouTubeTranscriptCollector(database=db, rate_limit_seconds=30)

        video_id = "cached12345"  # 11 characters
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        # Pre-populate cache
        db.create_episode(
            video_id=video_id,
            video_url=video_url,
            transcript="Cached data"
        )

        import time

        # Multiple cached requests should not trigger rate limiting
        start_time = time.time()
        for i in range(5):
            result = collector.get_transcript(video_url)
            assert result is not None

        elapsed = time.time() - start_time
        # Should complete quickly since all are cached
        assert elapsed < 2.0


class TestHealthCheck:
    """Test cases for health check functionality"""

    @pytest.fixture
    def collector(self):
        """Create a collector instance"""
        return YouTubeTranscriptCollector()

    def test_health_check_returns_status(self, collector):
        """Test that health check returns proper status"""
        health = collector.health_check()

        assert 'status' in health
        assert 'timestamp' in health
        assert 'rate_limiter' in health
        assert 'cache' in health
        assert health['status'] in ['healthy', 'degraded', 'unhealthy']

    @patch('youtube_transcript_api.YouTubeTranscriptApi.list_transcripts')
    def test_health_check_with_working_api(self, mock_list, collector):
        """Test health check when YouTube API is working"""
        # Mock successful API response
        mock_list.return_value = []

        health = collector.health_check()

        assert health['status'] == 'healthy'
        assert health['api_connectivity'] is True

    @patch('youtube_transcript_api.YouTubeTranscriptApi.list_transcripts')
    def test_health_check_with_failing_api(self, mock_list, collector):
        """Test health check when YouTube API fails"""
        # Mock API failure
        mock_list.side_effect = Exception("API Error")

        health = collector.health_check()

        assert health['status'] == 'unhealthy'
        assert health['api_connectivity'] is False
        assert 'error' in health


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
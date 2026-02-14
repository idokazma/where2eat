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


class MockSnippet:
    """Mock snippet object for youtube-transcript-api v1.x"""
    def __init__(self, text, start, duration):
        self.text = text
        self.start = start
        self.duration = duration


class MockTranscriptData:
    """Mock transcript data object for youtube-transcript-api v1.x"""
    def __init__(self, snippets):
        self.snippets = [MockSnippet(**s) for s in snippets]


class MockTranscriptInfo:
    """Mock transcript metadata from api.list() — no fetch, just metadata"""
    def __init__(self, language_code, language=None, is_generated=False, is_translatable=True):
        self.language_code = language_code
        self.language = language or language_code
        self.is_generated = is_generated
        self.is_translatable = is_translatable
        self._fetch_data = None
        self._translate_targets = {}

    def set_fetch_data(self, snippets):
        """Configure what fetch() returns"""
        self._fetch_data = MockTranscriptData(snippets)

    def set_translate_target(self, lang_code, snippets):
        """Configure what translate(lang).fetch() returns"""
        self._translate_targets[lang_code] = MockTranscriptData(snippets)

    def fetch(self):
        if self._fetch_data is None:
            raise Exception("No fetch data configured")
        return self._fetch_data

    def translate(self, lang_code):
        if lang_code in self._translate_targets:
            mock_translated = Mock()
            mock_translated.fetch.return_value = self._translate_targets[lang_code]
            return mock_translated
        raise Exception(f"Translation to {lang_code} not available")


def make_mock_api(available_transcripts):
    """Helper: create a mock YouTubeTranscriptApi with pre-configured list() results"""
    mock_api = Mock()
    mock_api.list.return_value = available_transcripts
    return mock_api


class TestYouTubeTranscriptCollector:
    """Test cases for YouTube transcript collection"""

    @pytest.fixture
    def collector(self):
        """Create a YouTubeTranscriptCollector instance"""
        return YouTubeTranscriptCollector(rate_limit_seconds=0)

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

    def test_get_transcript_success(self, collector, sample_transcript_data):
        """Test successful transcript retrieval via list-first approach"""
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew', is_generated=True)
        iw_transcript.set_fetch_data(sample_transcript_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
            result = collector.get_transcript(video_url, languages=['iw', 'he'])

            assert result is not None
            assert result['video_id'] == '6jvskRWvQkg'
            assert result['language'] == 'iw'
            assert result['segment_count'] == 4
            assert 'שלום וברוכים הבאים' in result['transcript']
            assert 'המסעדה הראשונה היא צ\'קולי' in result['transcript']
            mock_instance.list.assert_called_once_with('6jvskRWvQkg')

    def test_get_transcript_api_error(self, collector):
        """Test transcript retrieval when API throws TranscriptsDisabled"""
        from youtube_transcript_api._errors import TranscriptsDisabled

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.side_effect = TranscriptsDisabled('6jvskRWvQkg')

            video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
            result = collector.get_transcript(video_url, languages=['iw'])

            assert result is None

    def test_get_transcript_auto_success(self, collector, sample_transcript_data):
        """Test auto transcript detection picks best available language"""
        # Only 'he' available (not 'iw' or 'en')
        he_transcript = MockTranscriptInfo('he', 'Hebrew', is_generated=True)
        he_transcript.set_fetch_data(sample_transcript_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [he_transcript]

            video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
            result = collector.get_transcript_auto(video_url)

            assert result is not None
            assert result['video_id'] == '6jvskRWvQkg'
            assert result['language'] == 'he'
            assert len(result['segments']) == 4

    def test_multiple_language_fallback(self, collector, sample_transcript_data):
        """Test that second language is chosen when first isn't available"""
        # Only English available, requesting ['iw', 'he', 'en']
        en_transcript = MockTranscriptInfo('en', 'English', is_generated=False)
        en_transcript.set_fetch_data(sample_transcript_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [en_transcript]

            video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
            result = collector.get_transcript(video_url, languages=['iw', 'he', 'en'])

            assert result is not None
            assert result['language'] == 'en'
            assert result['source'] == 'youtube-transcript-api'


class TestTranscriptIntegration:
    """Integration tests for the transcript system"""

    @pytest.mark.integration
    def test_real_video_processing_with_caching(self, tmp_path):
        """Test with real YouTube video URLs including caching"""
        import random

        test_urls = [
            "https://www.youtube.com/watch?v=8fKi1aA24-w",
            "https://www.youtube.com/watch?v=f9L1k9RctpM"
        ]
        video_url = random.choice(test_urls)
        video_id = YouTubeTranscriptCollector.extract_video_id(video_url)

        db_path = tmp_path / "integration_test.db"
        from database import Database
        db = Database(str(db_path))
        collector = YouTubeTranscriptCollector(database=db, rate_limit_seconds=5)

        print(f"\nTesting with URL: {video_url}")
        result1 = collector.get_transcript(video_url, languages=['iw', 'he', 'en'])

        if result1:
            print(f"✓ Successfully fetched transcript for video: {video_id}")
            assert result1['video_id'] == video_id
            assert result1['segment_count'] > 0
            assert len(result1['transcript']) > 100
            assert result1['cached'] is False

            # Second call - should use cache
            result2 = collector.get_transcript(video_url, languages=['iw', 'he', 'en'])
            assert result2 is not None
            assert result2['cached'] is True
            assert result2['transcript'] == result1['transcript']
        else:
            pytest.skip("Real video transcript not available")

    @pytest.mark.integration
    def test_health_check_with_real_api(self):
        """Test health check with real YouTube API connection"""
        collector = YouTubeTranscriptCollector()
        health = collector.health_check()

        assert 'status' in health
        assert 'timestamp' in health
        assert 'api_connectivity' in health
        assert health['status'] in ['healthy', 'degraded', 'unhealthy']
        assert isinstance(health['api_connectivity'], bool)

    def test_real_video_processing(self):
        """Test with the actual video URL provided by user"""
        video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
        collector = YouTubeTranscriptCollector()

        result = collector.get_transcript(video_url, languages=['iw', 'he'])

        if result:
            assert result['video_id'] == '6jvskRWvQkg'
            assert result['language'] in ['he', 'iw', 'en']
            assert result['segment_count'] > 0
            assert len(result['transcript']) > 100
        else:
            pytest.skip("Real video transcript not available")

    def test_transcript_data_structure(self):
        """Test the structure of returned transcript data"""
        collector = YouTubeTranscriptCollector(rate_limit_seconds=0)
        sample_data = [
            {'text': 'מילים בעברית', 'start': 0.0, 'duration': 2.0},
            {'text': 'עוד מילים', 'start': 2.0, 'duration': 1.5}
        ]

        iw_transcript = MockTranscriptInfo('iw', 'Hebrew', is_generated=True)
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            result = collector.get_transcript("https://www.youtube.com/watch?v=test1234567")

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

    result = collector.get_transcript(None)
    assert result is None

    result = collector.get_transcript("")
    assert result is None

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
        collector = YouTubeTranscriptCollector(database=db, rate_limit_seconds=0)
        return collector, db

    def test_get_transcript_checks_cache_first(self, collector_with_db):
        """Test that get_transcript checks cache before API call"""
        collector, db = collector_with_db
        video_id = "test1234567"
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        db.create_episode(
            video_id=video_id,
            video_url=video_url,
            transcript="Cached transcript text"
        )

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            result = collector.get_transcript(video_url)

            # API should not be called
            mock_instance.list.assert_not_called()
            mock_instance.fetch.assert_not_called()

            assert result is not None
            assert result['transcript'] == "Cached transcript text"
            assert result['video_id'] == video_id

    def test_get_transcript_caches_new_transcripts(self, collector_with_db):
        """Test that get_transcript stores new transcripts in cache"""
        collector, db = collector_with_db
        video_id = "newvid45678"
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        sample_data = [
            {'text': "First segment", 'start': 0.0, 'duration': 2.0},
            {'text': "Second segment", 'start': 2.0, 'duration': 3.0}
        ]
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            result = collector.get_transcript(video_url)
            assert result is not None

            episode = db.get_episode(video_id=video_id)
            assert episode is not None
            assert "First segment" in episode['transcript']
            assert "Second segment" in episode['transcript']

    def test_cache_miss_falls_back_to_api(self, collector_with_db):
        """Test that cache miss triggers API call"""
        collector, db = collector_with_db
        video_id = "notcached01"
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        sample_data = [{'text': "API data", 'start': 0.0, 'duration': 1.0}]
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            result = collector.get_transcript(video_url)

            mock_instance.list.assert_called_once()
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
        sample_data = [{'text': "test", 'start': 0.0, 'duration': 1.0}]

        iw_transcript = MockTranscriptInfo('iw', 'Hebrew')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi, \
             patch('youtube_transcript_collector.time.sleep') as mock_sleep:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            result1 = rate_limited_collector.get_transcript("https://www.youtube.com/watch?v=test1234567")
            assert result1 is not None

            # Need a fresh MockTranscriptInfo for second call (fetch can only be called once)
            iw_transcript2 = MockTranscriptInfo('iw', 'Hebrew')
            iw_transcript2.set_fetch_data(sample_data)
            mock_instance.list.return_value = [iw_transcript2]

            result2 = rate_limited_collector.get_transcript("https://www.youtube.com/watch?v=test7654321")
            assert result2 is not None

            assert mock_sleep.called
            sleep_time = mock_sleep.call_args[0][0]
            assert sleep_time >= 28.0

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

        video_id = "cached12345"
        video_url = f"https://www.youtube.com/watch?v={video_id}"

        db.create_episode(
            video_id=video_id,
            video_url=video_url,
            transcript="Cached data"
        )

        import time

        start_time = time.time()
        for i in range(5):
            result = collector.get_transcript(video_url)
            assert result is not None

        elapsed = time.time() - start_time
        assert elapsed < 2.0


class TestHealthCheck:
    """Test cases for health check functionality"""

    @pytest.fixture
    def collector(self):
        return YouTubeTranscriptCollector()

    def test_health_check_returns_status(self, collector):
        health = collector.health_check()
        assert 'status' in health
        assert 'timestamp' in health
        assert 'rate_limiter' in health
        assert 'cache' in health
        assert health['status'] in ['healthy', 'degraded', 'unhealthy']

    def test_health_check_with_working_api(self, collector):
        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = []
            health = collector.health_check()
            assert health['status'] == 'healthy'
            assert health['api_connectivity'] is True

    def test_health_check_with_failing_api(self, collector):
        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.side_effect = Exception("API Error")
            health = collector.health_check()
            assert health['status'] == 'unhealthy'
            assert health['api_connectivity'] is False
            assert 'error' in health


class TestListFirstApproach:
    """Test the list-first transcript fetching strategy"""

    @pytest.fixture
    def collector(self):
        return YouTubeTranscriptCollector(rate_limit_seconds=0)

    def test_list_called_before_fetch(self, collector):
        """Test that list() is called, not fetch() directly"""
        sample_data = [{'text': 'hello', 'start': 0.0, 'duration': 1.0}]
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            result = collector.get_transcript(
                "https://www.youtube.com/watch?v=test1234567",
                languages=['iw']
            )

            # list() should be called, not fetch() directly on the api
            mock_instance.list.assert_called_once_with('test1234567')
            assert result is not None

    def test_picks_preferred_language_from_available(self, collector):
        """Test that the best language match is picked from available transcripts"""
        sample_data = [{'text': 'content', 'start': 0.0, 'duration': 1.0}]

        en_transcript = MockTranscriptInfo('en', 'English')
        en_transcript.set_fetch_data(sample_data)
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [en_transcript, iw_transcript]

            result = collector.get_transcript(
                "https://www.youtube.com/watch?v=test1234567",
                languages=['iw', 'he', 'en']
            )

            # Should pick 'iw' since it's first in preferred list and available
            assert result['language'] == 'iw'

    def test_no_match_falls_to_translation(self, collector):
        """Test that translation is tried when no language match found"""
        en_sample = [{'text': 'english text', 'start': 0.0, 'duration': 1.0}]
        iw_sample = [{'text': 'translated to hebrew', 'start': 0.0, 'duration': 1.0}]

        en_transcript = MockTranscriptInfo('en', 'English', is_translatable=True)
        en_transcript.set_fetch_data(en_sample)
        en_transcript.set_translate_target('iw', iw_sample)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            # Only English available, requesting Hebrew
            mock_instance.list.return_value = [en_transcript]

            result = collector.get_transcript(
                "https://www.youtube.com/watch?v=test1234567",
                languages=['iw']
            )

            assert result is not None
            assert result['language'] == 'iw'
            assert 'translated-from-en' in result['source']
            assert result['transcript'] == 'translated to hebrew'

    def test_no_transcripts_at_all_falls_to_ytdlp(self, collector):
        """Test yt-dlp fallback when list() returns empty"""
        ytdlp_result = {
            'video_id': 'test1234567',
            'video_url': 'https://www.youtube.com/watch?v=test1234567',
            'transcript': 'from yt-dlp',
            'segments': [],
            'language': 'iw',
            'segment_count': 1,
            'cached': False,
            'source': 'yt-dlp-auto'
        }

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = []

            with patch.object(collector, '_get_transcript_via_ytdlp', return_value=ytdlp_result):
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=test1234567",
                    languages=['iw']
                )

                assert result is not None
                assert result['source'] == 'yt-dlp-auto'

    def test_list_error_falls_to_ytdlp(self, collector):
        """Test yt-dlp fallback when list() throws a generic error"""
        ytdlp_result = {
            'video_id': 'test1234567',
            'video_url': 'https://www.youtube.com/watch?v=test1234567',
            'transcript': 'from yt-dlp',
            'segments': [],
            'language': 'iw',
            'segment_count': 1,
            'cached': False,
            'source': 'yt-dlp-auto'
        }

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.side_effect = Exception("Network error")

            with patch.object(collector, '_get_transcript_via_ytdlp', return_value=ytdlp_result):
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=test1234567",
                    languages=['iw']
                )

                assert result is not None
                assert result['source'] == 'yt-dlp-auto'

    def test_auto_uses_single_list_call(self, collector):
        """Test that get_transcript_auto uses a single list() call, not multiple fetch() calls"""
        sample_data = [{'text': 'text', 'start': 0.0, 'duration': 1.0}]
        fr_transcript = MockTranscriptInfo('fr', 'French')
        fr_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [fr_transcript]

            result = collector.get_transcript_auto("https://www.youtube.com/watch?v=test1234567")

            # Should only call list() once, not multiple fetch() calls
            mock_instance.list.assert_called_once_with('test1234567')
            assert result is not None
            assert result['language'] == 'fr'

    def test_generated_vs_manual_source_tag(self, collector):
        """Test that auto-generated transcripts are tagged correctly"""
        sample_data = [{'text': 'auto text', 'start': 0.0, 'duration': 1.0}]
        auto_transcript = MockTranscriptInfo('iw', 'Hebrew', is_generated=True)
        auto_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [auto_transcript]

            result = collector.get_transcript(
                "https://www.youtube.com/watch?v=test1234567",
                languages=['iw']
            )

            assert result['source'] == 'youtube-transcript-api-generated'

    def test_manual_transcript_source_tag(self, collector):
        """Test that manual transcripts are tagged correctly"""
        sample_data = [{'text': 'manual text', 'start': 0.0, 'duration': 1.0}]
        manual_transcript = MockTranscriptInfo('iw', 'Hebrew', is_generated=False)
        manual_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [manual_transcript]

            result = collector.get_transcript(
                "https://www.youtube.com/watch?v=test1234567",
                languages=['iw']
            )

            assert result['source'] == 'youtube-transcript-api'


class TestYtDlpFallback:
    """Test cases for yt-dlp fallback transcript fetching"""

    @pytest.fixture
    def collector(self):
        return YouTubeTranscriptCollector(rate_limit_seconds=0)

    def test_ytdlp_not_called_on_success(self, collector):
        """Test that yt-dlp is not called when primary API succeeds"""
        sample_data = [{'text': 'primary text', 'start': 0.0, 'duration': 1.0}]
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = [iw_transcript]

            with patch.object(collector, '_get_transcript_via_ytdlp') as mock_ytdlp:
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=test1234567",
                    languages=['iw']
                )

                assert result is not None
                mock_ytdlp.assert_not_called()

    def test_ytdlp_not_called_on_transcripts_disabled(self, collector):
        """Test that yt-dlp is NOT tried when transcripts are explicitly disabled"""
        from youtube_transcript_api._errors import TranscriptsDisabled

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.side_effect = TranscriptsDisabled('test1234567')

            with patch.object(collector, '_get_transcript_via_ytdlp') as mock_ytdlp:
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=test1234567",
                    languages=['iw']
                )

                assert result is None
                mock_ytdlp.assert_not_called()

    def test_ytdlp_not_called_on_video_unavailable(self, collector):
        """Test that yt-dlp is NOT tried when video is unavailable"""
        from youtube_transcript_api._errors import VideoUnavailable

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.side_effect = VideoUnavailable('test1234567')

            with patch.object(collector, '_get_transcript_via_ytdlp') as mock_ytdlp:
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=test1234567",
                    languages=['iw']
                )

                assert result is None
                mock_ytdlp.assert_not_called()

    def test_all_methods_fail_returns_none(self, collector):
        """Test that None is returned when everything fails"""
        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = []

            with patch.object(collector, '_get_transcript_via_ytdlp', return_value=None):
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=test1234567",
                    languages=['iw']
                )

                assert result is None

    def test_fallback_result_gets_cached(self, tmp_path):
        """Test that results from yt-dlp fallback are cached in database"""
        from database import Database

        db = Database(str(tmp_path / "test_fallback_cache.db"))
        collector = YouTubeTranscriptCollector(database=db, rate_limit_seconds=0)

        ytdlp_result = {
            'video_id': 'ytdlpcache1',
            'video_url': 'https://www.youtube.com/watch?v=ytdlpcache1',
            'transcript': 'yt-dlp cached text',
            'segments': [],
            'language': 'iw',
            'segment_count': 1,
            'cached': False,
            'source': 'yt-dlp-auto'
        }

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.return_value = []

            with patch.object(collector, '_get_transcript_via_ytdlp', return_value=ytdlp_result):
                result = collector.get_transcript(
                    "https://www.youtube.com/watch?v=ytdlpcache1",
                    languages=['iw']
                )

                assert result is not None

                episode = db.get_episode(video_id='ytdlpcache1')
                assert episode is not None
                assert episode['transcript'] == 'yt-dlp cached text'


class TestYtDlpDirectMethod:
    """Test the _get_transcript_via_ytdlp method directly"""

    @pytest.fixture
    def collector(self):
        return YouTubeTranscriptCollector(rate_limit_seconds=0)

    def test_ytdlp_returns_none_when_not_installed(self, collector):
        """Test graceful handling when yt-dlp is not installed"""
        with patch.dict('sys.modules', {'yt_dlp': None}):
            with patch('builtins.__import__', side_effect=ImportError("No module named 'yt_dlp'")):
                result = collector._get_transcript_via_ytdlp('test1234567', ['iw'])
                assert result is None

    def test_ytdlp_returns_none_on_exception(self, collector):
        """Test graceful handling when yt-dlp throws an exception"""
        with patch('yt_dlp.YoutubeDL') as MockYDL:
            mock_instance = MockYDL.return_value.__enter__ = Mock(side_effect=Exception("yt-dlp error"))
            result = collector._get_transcript_via_ytdlp('test1234567', ['iw'])
            assert result is None


class TestTranslationFallback:
    """Test the translation fallback method"""

    @pytest.fixture
    def collector(self):
        return YouTubeTranscriptCollector(rate_limit_seconds=0)

    def test_translation_returns_none_when_no_translatable_transcript(self, collector):
        """Test that translation returns None when no transcript is translatable"""
        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_transcript = Mock()
            mock_transcript.is_translatable = False
            mock_instance.list.return_value = [mock_transcript]

            result = collector._get_transcript_via_translation('test1234567', ['iw'])
            assert result is None

    def test_translation_returns_translated_transcript(self, collector):
        """Test successful translation from English to Hebrew"""
        sample_data = [
            {'text': 'translated text', 'start': 0.0, 'duration': 2.0}
        ]
        mock_translated_data = MockTranscriptData(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value

            mock_transcript = Mock()
            mock_transcript.is_translatable = True
            mock_transcript.language_code = 'en'
            mock_translated = Mock()
            mock_translated.fetch.return_value = mock_translated_data
            mock_transcript.translate.return_value = mock_translated

            mock_instance.list.return_value = [mock_transcript]

            result = collector._get_transcript_via_translation('test1234567', ['iw'])

            assert result is not None
            assert result['transcript'] == 'translated text'
            assert result['language'] == 'iw'
            assert 'translated-from-en' in result['source']
            mock_transcript.translate.assert_called_with('iw')

    def test_translation_returns_none_on_api_error(self, collector):
        """Test that translation returns None when API list fails"""
        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            mock_instance.list.side_effect = Exception("API Error")

            result = collector._get_transcript_via_translation('test1234567', ['iw'])
            assert result is None


class TestDefaultLanguageOrder:
    """Test that default language order is iw, he, en"""

    def test_get_transcript_default_languages(self):
        """Test that get_transcript defaults to ['iw', 'he', 'en']"""
        import inspect
        sig = inspect.signature(YouTubeTranscriptCollector.get_transcript)
        default_languages = sig.parameters['languages'].default
        assert default_languages == ['iw', 'he', 'en']

    def test_get_transcripts_batch_default_languages(self):
        """Test that get_transcripts_batch defaults to ['iw', 'he', 'en']"""
        import inspect
        sig = inspect.signature(YouTubeTranscriptCollector.get_transcripts_batch)
        default_languages = sig.parameters['languages'].default
        assert default_languages == ['iw', 'he', 'en']

    def test_get_transcript_auto_prefers_iw(self):
        """Test that get_transcript_auto picks 'iw' over 'he' when both available"""
        collector = YouTubeTranscriptCollector(rate_limit_seconds=0)
        sample_data = [{'text': 'test', 'start': 0.0, 'duration': 1.0}]

        he_transcript = MockTranscriptInfo('he', 'Hebrew')
        he_transcript.set_fetch_data(sample_data)
        iw_transcript = MockTranscriptInfo('iw', 'Hebrew (legacy)')
        iw_transcript.set_fetch_data(sample_data)

        with patch('youtube_transcript_collector.YouTubeTranscriptApi') as MockApi:
            mock_instance = MockApi.return_value
            # Both available but iw should be preferred
            mock_instance.list.return_value = [he_transcript, iw_transcript]

            result = collector.get_transcript_auto("https://www.youtube.com/watch?v=test1234567")

            assert result is not None
            assert result['language'] == 'iw'


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])

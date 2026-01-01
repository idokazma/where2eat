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
            video_id = collector._extract_video_id(url)
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
            video_id = collector._extract_video_id(url)
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
    
    def test_format_transcript_segments(self, collector, sample_transcript_data):
        """Test transcript formatting functionality"""
        formatted = collector._format_transcript(sample_transcript_data)
        
        expected_content = [
            'שלום וברוכים הבאים',
            'היום נדבר על מסעדות', 
            'המסעדה הראשונה היא צ\'קולי',
            'שנמצאת בתל אביב'
        ]
        
        for expected_text in expected_content:
            assert expected_text in formatted
        
        # Check that transcript flows naturally
        lines = formatted.strip().split('\n')
        assert len(lines) >= 4
    
    def test_segment_parsing(self, collector):
        """Test individual segment parsing"""
        segment = {'text': 'היום נדבר על מסעדות טובות', 'start': 5.5, 'duration': 3.2}
        
        parsed = collector._parse_segment(segment)
        
        assert parsed['text'] == 'היום נדבר על מסעדות טובות'
        assert parsed['start_time'] == 5.5
        assert parsed['duration'] == 3.2
        assert parsed['end_time'] == 8.7
    
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
            assert result['formatted_timestamp']
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
            
            result = collector.get_transcript("https://www.youtube.com/watch?v=test123")
            
            # Verify required fields
            required_fields = [
                'video_id', 'video_url', 'language', 'transcript', 
                'segments', 'segment_count', 'formatted_timestamp'
            ]
            
            for field in required_fields:
                assert field in result, f"Missing required field: {field}"
            
            assert isinstance(result['segments'], list)
            assert result['segment_count'] == 2
            assert result['video_id'] == 'test123'


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


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
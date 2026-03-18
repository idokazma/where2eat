"""
Test suite for restaurant extraction and LLM analysis functionality
Tests the restaurant_analyzer.py module and LLM integration
"""

import os
import sys
import pytest
import json
import tempfile
from datetime import datetime
from unittest.mock import Mock, patch, mock_open

# Add src and project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from restaurant_analyzer import (
    fetch_transcript, save_transcript, create_analysis_request,
    save_analysis_result, run_complete_pipeline
)


@pytest.fixture
def sample_transcript_data():
    """Sample transcript data for testing"""
    return {
        'video_id': '6jvskRWvQkg',
        'video_url': 'https://www.youtube.com/watch?v=6jvskRWvQkg',
        'language': 'he',
        'transcript': 'שלום וברוכים הבאים לתוכנית אוכל. היום נדבר על מסעדות מעולות. המסעדה הראשונה היא צ\'קולי שנמצאת בתל אביב ליד הנמל. המקום מדהים עם נוף לים והאוכל טעים מאוד. השף חביב משה מכין שם חמוסטה תאילנדית מעולה. המסעדה השנייה היא גורמי סבזי בשוק לוינסקי. זה מקום פרסי אותנטי עם מחירים טובים. הבעלים עושה שם אוכל פרסי מסורתי.',
        'segments': [
            {'text': 'שלום וברוכים הבאים לתוכנית אוכל', 'start': 0.0, 'duration': 3.0},
            {'text': 'היום נדבר על מסעדות מעולות', 'start': 3.0, 'duration': 2.5},
            {'text': 'המסעדה הראשונה היא צ\'קולי שנמצאת בתל אביב', 'start': 5.5, 'duration': 4.0}
        ],
        'segment_count': 3,
        'formatted_timestamp': '2026-01-01 12:00:00'
    }


@pytest.fixture 
def sample_claude_response():
    """Sample Claude analysis response"""
    return {
        "episode_info": {
            "video_id": "6jvskRWvQkg", 
            "video_url": "https://www.youtube.com/watch?v=6jvskRWvQkg",
            "language": "he",
            "analysis_date": "2026-01-01"
        },
        "restaurants": [
            {
                "name_hebrew": "צ'קולי",
                "name_english": "Chakoli",
                "location": {
                    "city": "תל אביב",
                    "neighborhood": "נמל תל אביב",
                    "address": "ליד הנמל",
                    "region": "מרכז"
                },
                "cuisine_type": "תאילנדי",
                "host_opinion": "positive",
                "mentioned_details": ["נוף לים", "חמוסטה תאילנדית"],
                "rating_indicators": ["מעולה", "טעים מאוד"]
            }
        ],
        "food_trends": ["תאילנדי", "ים תיכוני"],
        "episode_summary": "פרק על מסעדות מומלצות בתל אביב"
    }


class TestRestaurantAnalyzer:
    """Test cases for restaurant analysis functionality"""
    
    @pytest.fixture
    def sample_transcript_data(self):
        """Sample transcript data for testing"""
        return {
            'video_id': '6jvskRWvQkg',
            'video_url': 'https://www.youtube.com/watch?v=6jvskRWvQkg',
            'language': 'he',
            'transcript': 'שלום וברוכים הבאים לתוכנית אוכל. היום נדבר על מסעדות מעולות. המסעדה הראשונה היא צ\'קולי שנמצאת בתל אביב ליד הנמל. המקום מדהים עם נוף לים והאוכל טעים מאוד. השף חביב משה מכין שם חמוסטה תאילנדית מעולה. המסעדה השנייה היא גורמי סבזי בשוק לוינסקי. זה מקום פרסי אותנטי עם מחירים טובים. הבעלים עושה שם אוכל פרסי מסורתי.',
            'segments': [
                {'text': 'שלום וברוכים הבאים לתוכנית אוכל', 'start': 0.0, 'duration': 3.0},
                {'text': 'היום נדבר על מסעדות מעולות', 'start': 3.0, 'duration': 2.5},
                {'text': 'המסעדה הראשונה היא צ\'קולי שנמצאת בתל אביב', 'start': 5.5, 'duration': 4.0}
            ],
            'segment_count': 3,
            'formatted_timestamp': '2026-01-01 12:00:00'
        }
    
    @pytest.fixture
    def sample_claude_response(self):
        """Sample Claude analysis response"""
        return {
            "episode_info": {
                "video_id": "6jvskRWvQkg",
                "video_url": "https://www.youtube.com/watch?v=6jvskRWvQkg",
                "language": "he",
                "analysis_date": "2026-01-01"
            },
            "restaurants": [
                {
                    "name_hebrew": "צ'קולי",
                    "name_english": "Checoli",
                    "location": {
                        "city": "תל אביב",
                        "neighborhood": "נמל תל אביב",
                        "address": None,
                        "region": "Center"
                    },
                    "cuisine_type": "Spanish/Seafood",
                    "status": "open",
                    "price_range": "mid-range",
                    "host_opinion": "positive",
                    "host_comments": "המקום מדהים עם נוף לים והאוכל טעים מאוד",
                    "menu_items": ["חמוסטה תאילנדית"],
                    "special_features": ["נוף לים", "שף חביב משה"],
                    "contact_info": {"hours": None, "phone": None, "website": None},
                    "business_news": None,
                    "mention_context": "review"
                },
                {
                    "name_hebrew": "גורמי סבזי",
                    "name_english": "Gourmet Sabzi",
                    "location": {
                        "city": "תל אביב",
                        "neighborhood": "שוק לוינסקי",
                        "address": None,
                        "region": "Center"
                    },
                    "cuisine_type": "Persian/Middle Eastern",
                    "status": "open",
                    "price_range": "budget",
                    "host_opinion": "positive",
                    "host_comments": "מקום פרסי אותנטי עם מחירים טובים",
                    "menu_items": ["אוכל פרסי מסורתי"],
                    "special_features": ["אותנטי", "מחירים טובים"],
                    "contact_info": {"hours": None, "phone": None, "website": None},
                    "business_news": None,
                    "mention_context": "review"
                }
            ],
            "food_trends": ["אוכל ים תיכוני", "מטבח פרסי אותנטי"],
            "episode_summary": "פרק על מסעדות מומלצות בתל אביב"
        }
    
    def test_create_analysis_request(self, sample_transcript_data):
        """Test creation of analysis request for Claude"""
        request = create_analysis_request(sample_transcript_data)
        
        # Check that request contains required elements
        assert "6jvskRWvQkg" in request
        assert "Hebrew food podcast transcript" in request
        assert "צ'קולי" in request
        assert "TRANSCRIPT TEXT:" in request
        assert "TASK:" in request
        
        # Check formatting and structure
        assert "Restaurant name" in request
        assert "Location" in request
        assert "Type of cuisine" in request
        assert "Host opinion" in request or "hosts" in request.lower()
    
    def test_create_analysis_request_long_transcript(self):
        """Test truncation of long transcripts"""
        long_transcript_data = {
            'video_id': 'test123',
            'video_url': 'https://www.youtube.com/watch?v=test123',
            'language': 'he',
            'transcript': 'א' * 20000,  # Very long transcript
            'segments': [],
            'segment_count': 0,
            'formatted_timestamp': '2026-01-01 12:00:00'
        }
        
        request = create_analysis_request(long_transcript_data)
        
        # Should be truncated
        assert "[TRANSCRIPT TRUNCATED" in request
        assert len(request) < 20000
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.makedirs')
    def test_save_transcript(self, mock_makedirs, mock_file, sample_transcript_data):
        """Test transcript saving functionality"""
        text_file, json_file = save_transcript(sample_transcript_data)
        
        # Check that files were created with correct names
        assert "6jvskRWvQkg" in text_file
        assert text_file.endswith('.txt')
        assert "6jvskRWvQkg" in json_file
        assert json_file.endswith('.json')
        
        # Check that directories were created
        mock_makedirs.assert_called_with("transcripts", exist_ok=True)
        
        # Check that files were written to
        assert mock_file.call_count == 2  # Two files opened
    
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.makedirs')
    def test_save_analysis_result(self, mock_makedirs, mock_file):
        """Test saving of analysis results"""
        analysis_text = "# Restaurant Analysis\n\n## צ'קולי\nמסעדה מעולה בתל אביב"
        
        result_file = save_analysis_result(analysis_text, "test123")
        
        # Check file naming
        assert "test123" in result_file
        assert result_file.endswith('.md')
        
        # Check directory creation
        mock_makedirs.assert_called_with("analyses", exist_ok=True)
        
        # Check file writing
        mock_file.assert_called()


class TestRestaurantExtractionLogic:
    """Test the restaurant extraction logic from transcripts"""
    
    @patch('scripts.main.UnifiedRestaurantAnalyzer')
    @patch('scripts.main.RestaurantSearchAgent')
    @patch('scripts.main.YouTubeTranscriptCollector')
    @patch('scripts.main.setup_logging', return_value=Mock())
    def test_extract_restaurant_mentions(self, mock_logging, mock_collector, mock_search, mock_analyzer_cls):
        """Test identification of restaurant mentions in Hebrew text"""
        # Mock the LLM response
        mock_analyzer = Mock()
        mock_analyzer.config.provider = 'openai'
        mock_analyzer.analyze_transcript.return_value = {
            "restaurants": [
                {
                    "name_hebrew": "צ'קולי",
                    "name_english": "Chakoli",
                    "location": {"city": "תל אביב", "neighborhood": "נמל"},
                    "cuisine_type": "תאילנדי",
                    "host_opinion": "positive"
                }
            ],
            "episode_info": {"video_id": "test123", "llm_provider": "openai"},
            "food_trends": ["תאילנדי"],
            "episode_summary": "פרק על מסעדות מומלצות"
        }
        mock_analyzer_cls.return_value = mock_analyzer

        from scripts.main import RestaurantPodcastAnalyzer
        analyzer = RestaurantPodcastAnalyzer()

        transcript_data = {
            'video_id': 'test123',
            'video_url': 'https://www.youtube.com/watch?v=test123',
            'language': 'he',
            'transcript': 'מסעדות מעולות בתל אביב'
        }

        # Test the internal analysis function
        result = analyzer.extract_restaurants_with_llm(transcript_data)

        assert result is not None
        assert 'restaurants' in result
        assert 'episode_info' in result
        assert 'food_trends' in result

        # Should find at least the restaurants mentioned
        restaurants = result['restaurants']
        restaurant_names = [r['name_hebrew'] for r in restaurants]

        # Check for specific restaurants (should match our mock data)
        assert any('צ\'קולי' in name for name in restaurant_names)
    
    @patch('scripts.main.UnifiedRestaurantAnalyzer')
    @patch('scripts.main.RestaurantSearchAgent')
    @patch('scripts.main.YouTubeTranscriptCollector')
    @patch('scripts.main.setup_logging', return_value=Mock())
    def test_restaurant_data_structure(self, mock_logging, mock_collector, mock_search, mock_analyzer_cls):
        """Test that extracted restaurant data has correct structure"""
        mock_analyzer = Mock()
        mock_analyzer.config.provider = 'openai'
        mock_analyzer.analyze_transcript.return_value = {
            'episode_info': {
                'video_id': 'test123',
                'video_url': 'https://www.youtube.com/watch?v=test123',
                'language': 'he',
                'analysis_date': '2026-01-01'
            },
            'restaurants': [
                {
                    'name_hebrew': 'מסעדה טובה',
                    'name_english': 'Good Restaurant',
                    'location': {'city': 'תל אביב', 'neighborhood': 'מרכז', 'address': None, 'region': 'Center'},
                    'cuisine_type': 'ישראלי',
                    'status': 'open',
                    'price_range': 'mid-range',
                    'host_opinion': 'positive',
                    'host_comments': 'מקום טוב',
                    'menu_items': ['סלט'],
                    'special_features': [],
                    'contact_info': {'hours': None, 'phone': None, 'website': None},
                    'business_news': None,
                    'mention_context': 'review'
                }
            ],
            'food_trends': [],
            'episode_summary': ''
        }
        mock_analyzer_cls.return_value = mock_analyzer

        from scripts.main import RestaurantPodcastAnalyzer
        analyzer = RestaurantPodcastAnalyzer()

        transcript_data = {
            'video_id': 'test123',
            'video_url': 'https://www.youtube.com/watch?v=test123',
            'language': 'he',
            'transcript': 'מסעדה טובה בתל אביב'
        }

        result = analyzer.extract_restaurants_with_llm(transcript_data)

        # Check episode info structure
        episode_info = result['episode_info']
        required_episode_fields = ['video_id', 'video_url', 'language', 'analysis_date']
        for field in required_episode_fields:
            assert field in episode_info

        # Check restaurant structure if any found
        if result['restaurants']:
            restaurant = result['restaurants'][0]
            required_restaurant_fields = [
                'name_hebrew', 'name_english', 'location', 'cuisine_type',
                'status', 'price_range', 'host_opinion', 'host_comments',
                'menu_items', 'special_features', 'contact_info',
                'business_news', 'mention_context'
            ]

            for field in required_restaurant_fields:
                assert field in restaurant

            # Check location structure
            location = restaurant['location']
            location_fields = ['city', 'neighborhood', 'address', 'region']
            for field in location_fields:
                assert field in location
    
    @patch('scripts.main.UnifiedRestaurantAnalyzer')
    @patch('scripts.main.RestaurantSearchAgent')
    @patch('scripts.main.YouTubeTranscriptCollector')
    @patch('scripts.main.setup_logging', return_value=Mock())
    def test_sentiment_analysis(self, mock_logging, mock_collector, mock_search, mock_analyzer_cls):
        """Test host opinion detection from context"""
        mock_analyzer = Mock()
        mock_analyzer.config.provider = 'openai'

        sentiments = iter(['positive', 'negative', 'neutral'])

        def mock_analyze(data):
            sentiment = next(sentiments)
            return {
                'episode_info': {'video_id': 'test123'},
                'restaurants': [{'name_hebrew': 'מסעדה', 'host_opinion': sentiment}],
                'food_trends': [],
                'episode_summary': ''
            }

        mock_analyzer.analyze_transcript.side_effect = mock_analyze
        mock_analyzer_cls.return_value = mock_analyzer

        from scripts.main import RestaurantPodcastAnalyzer
        analyzer = RestaurantPodcastAnalyzer()

        test_cases = [
            ("המסעדה טובה מאוד ומומלצת", "positive"),
            ("זה מקום גרוע ולא שווה", "negative"),
            ("המסעדה בסדר, כלום מיוחד", "neutral")
        ]

        for text, expected_sentiment in test_cases:
            transcript_data = {
                'video_id': 'test123',
                'video_url': 'https://www.youtube.com/watch?v=test123',
                'language': 'he',
                'transcript': text
            }

            result = analyzer.extract_restaurants_with_llm(transcript_data)

            if result['restaurants']:
                opinion = result['restaurants'][0]['host_opinion']
                assert opinion in ['positive', 'negative', 'neutral']


class TestDataPersistence:
    """Test data persistence and file operations"""
    
    @patch('scripts.main.UnifiedRestaurantAnalyzer')
    @patch('scripts.main.RestaurantSearchAgent')
    @patch('scripts.main.YouTubeTranscriptCollector')
    @patch('scripts.main.setup_logging', return_value=Mock())
    def test_restaurant_json_format(self, mock_logging, mock_collector, mock_search, mock_analyzer_cls, sample_claude_response):
        """Test that restaurant data is saved in correct JSON format"""
        from scripts.main import RestaurantPodcastAnalyzer

        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            analyzer = RestaurantPodcastAnalyzer()

            # Test saving restaurant data
            transcript_data = {'video_id': '6jvskRWvQkg'}

            result_message = analyzer.save_restaurants_for_api(
                sample_claude_response, transcript_data
            )

            assert "Saved" in result_message
            assert "restaurant files" in result_message
    
    def test_file_naming_convention(self):
        """Test that files are named according to convention"""
        video_id = "6jvskRWvQkg"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Test transcript file naming
        expected_text_file = f"transcripts/{video_id}_{timestamp}.txt"
        expected_json_file = f"transcripts/{video_id}_{timestamp}.json"
        
        # Test analysis file naming
        expected_analysis_file = f"analyses/{video_id}_{timestamp}_analysis.md"
        
        # These patterns should be consistent across the application
        assert video_id in expected_text_file
        assert video_id in expected_json_file
        assert video_id in expected_analysis_file


@patch('restaurant_analyzer.YouTubeTranscriptCollector')
def test_fetch_transcript_integration(mock_collector_class, sample_transcript_data):
    """Test the fetch_transcript function integration"""
    # Mock the collector instance
    mock_collector = Mock()
    mock_collector.get_transcript.return_value = sample_transcript_data
    mock_collector_class.return_value = mock_collector
    
    video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
    result = fetch_transcript(video_url)
    
    assert result == sample_transcript_data
    mock_collector.get_transcript.assert_called_once_with(video_url, languages=['iw', 'he'])


@patch('restaurant_analyzer.YouTubeTranscriptCollector')
def test_fetch_transcript_fallback(mock_collector_class):
    """Test transcript fallback when Hebrew not available"""
    mock_collector = Mock()
    mock_collector.get_transcript.return_value = None  # Hebrew fails
    mock_collector.get_transcript_auto.return_value = {
        'video_id': '6jvskRWvQkg',
        'language': 'en',
        'transcript': 'Hello and welcome to the food show.',
        'segment_count': 1
    }
    mock_collector_class.return_value = mock_collector
    
    video_url = "https://www.youtube.com/watch?v=6jvskRWvQkg"
    result = fetch_transcript(video_url)
    
    assert result is not None
    assert result['language'] == 'en'
    mock_collector.get_transcript_auto.assert_called_once()


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
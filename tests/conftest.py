"""
Pytest configuration and shared fixtures for Where2Eat test suite
"""

import os
import sys
import pytest
import tempfile
import shutil
from datetime import datetime
from unittest.mock import Mock, patch

# Add project directories to path
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'src'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'scripts'))


@pytest.fixture(autouse=True)
def _restore_cwd():
    """Automatically save and restore cwd for every test."""
    original_cwd = os.getcwd()
    yield
    os.chdir(original_cwd)


@pytest.fixture(scope="session")
def project_root():
    """Get the project root directory"""
    return PROJECT_ROOT


@pytest.fixture
def temp_workspace():
    """Create a temporary workspace for tests"""
    with tempfile.TemporaryDirectory() as temp_dir:
        original_cwd = os.getcwd()
        os.chdir(temp_dir)
        try:
            yield temp_dir
        finally:
            os.chdir(original_cwd)


@pytest.fixture
def sample_video_url():
    """Standard test video URL"""
    return "https://www.youtube.com/watch?v=6jvskRWvQkg"


@pytest.fixture
def sample_video_id():
    """Standard test video ID"""
    return "6jvskRWvQkg"


@pytest.fixture
def sample_transcript_segments():
    """Sample transcript segments for testing"""
    return [
        {'text': 'שלום וברוכים הבאים לתוכנית אוכל', 'start': 0.0, 'duration': 3.0},
        {'text': 'היום נדבר על מסעדות מעולות בתל אביב', 'start': 3.0, 'duration': 4.0},
        {'text': 'המסעדה הראשונה היא צ\'קולי שנמצאת ליד הנמל', 'start': 7.0, 'duration': 5.0},
        {'text': 'המקום מדהים עם נוף לים והאוכל טעים מאוד', 'start': 12.0, 'duration': 4.0},
        {'text': 'המסעדה השנייה היא גורמי סבזי בשוק לוינסקי', 'start': 16.0, 'duration': 5.0},
        {'text': 'זה מקום פרסי אותנטי עם מחירים טובים', 'start': 21.0, 'duration': 4.0}
    ]


@pytest.fixture
def sample_transcript_text(sample_transcript_segments):
    """Sample transcript text from segments"""
    return ' '.join(segment['text'] for segment in sample_transcript_segments)


@pytest.fixture
def full_transcript_data(sample_video_id, sample_video_url, sample_transcript_segments, sample_transcript_text):
    """Complete transcript data structure for testing"""
    return {
        'video_id': sample_video_id,
        'video_url': sample_video_url,
        'language': 'he',
        'transcript': sample_transcript_text,
        'segments': sample_transcript_segments,
        'segment_count': len(sample_transcript_segments),
        'formatted_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }


@pytest.fixture
def sample_restaurant_data():
    """Sample restaurant data structure"""
    return {
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
        "host_comments": "מקום מדהים עם נוף לים והאוכל טעים מאוד",
        "menu_items": ["דגים טריים", "פירות ים"],
        "special_features": ["נוף לים", "טיילת"],
        "contact_info": {
            "hours": "12:00-24:00",
            "phone": "03-1234567",
            "website": "https://checoli.co.il"
        },
        "business_news": None,
        "mention_context": "review"
    }


@pytest.fixture
def sample_restaurants_analysis(sample_video_id, sample_video_url):
    """Sample complete restaurant analysis result"""
    return {
        "episode_info": {
            "video_id": sample_video_id,
            "video_url": sample_video_url,
            "language": "he",
            "analysis_date": datetime.now().strftime('%Y-%m-%d')
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
                "host_comments": "מקום מדהים עם נוף לים",
                "menu_items": ["דגים טריים"],
                "special_features": ["נוף לים"],
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
                "cuisine_type": "Persian",
                "status": "open",
                "price_range": "budget",
                "host_opinion": "positive",
                "host_comments": "מקום פרסי אותנטי עם מחירים טובים",
                "menu_items": ["אוכל פרסי"],
                "special_features": ["אותנטי"],
                "contact_info": {"hours": None, "phone": None, "website": None},
                "business_news": None,
                "mention_context": "review"
            }
        ],
        "food_trends": ["מטבח ים תיכוני", "אוכל אותנטי"],
        "episode_summary": "פרק על מסעדות מומלצות בתל אביב"
    }


@pytest.fixture
def mock_youtube_transcript_collector():
    """Mock YouTube transcript collector for testing"""
    with patch('src.youtube_transcript_collector.YouTubeTranscriptCollector') as mock:
        yield mock


@pytest.fixture
def mock_restaurant_analyzer():
    """Mock restaurant analyzer for testing"""
    with patch('scripts.main.RestaurantPodcastAnalyzer') as mock:
        yield mock


@pytest.fixture
def create_test_directories(temp_workspace):
    """Create required test directories"""
    directories = [
        "transcripts",
        "analyses", 
        "data/restaurants",
        "logs",
        "demo_results"
    ]
    
    for dir_path in directories:
        os.makedirs(dir_path, exist_ok=True)
    
    return directories


def pytest_configure(config):
    """Configure pytest with custom markers"""
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )
    config.addinivalue_line(
        "markers", "slow: mark test as slow running"
    )
    config.addinivalue_line(
        "markers", "network: mark test as requiring network access"
    )
    config.addinivalue_line(
        "markers", "api: mark test as API server test"
    )


def pytest_collection_modifyitems(config, items):
    """Automatically mark tests based on their names"""
    for item in items:
        # Mark integration tests
        if "integration" in item.name.lower() or "test_pipeline" in str(item.fspath):
            item.add_marker(pytest.mark.integration)

        # Mark slow tests
        if "large" in item.name.lower() or "batch" in item.name.lower():
            item.add_marker(pytest.mark.slow)

        # Mark network tests
        if "real_video" in item.name.lower() or "network" in item.name.lower():
            item.add_marker(pytest.mark.network)

        # Mark API server tests
        if "test_api_server" in str(item.fspath):
            item.add_marker(pytest.mark.api)
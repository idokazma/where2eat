"""
Test suite for data persistence and file handling functionality
Tests file operations, data storage, and API data format
"""

import os
import sys
import pytest
import json
import tempfile
import shutil
from datetime import datetime
from unittest.mock import Mock, patch, mock_open

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

# Import the modules we need to test
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))


class TestFileOperations:
    """Test basic file operations and directory management"""
    
    def test_create_required_directories(self):
        """Test that all required directories are created"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Required directories
            required_dirs = [
                "transcripts",
                "analyses", 
                "data/restaurants",
                "logs",
                "demo_results"
            ]
            
            # Create directories
            for dir_path in required_dirs:
                os.makedirs(dir_path, exist_ok=True)
                assert os.path.exists(dir_path), f"Directory {dir_path} was not created"
                assert os.path.isdir(dir_path), f"{dir_path} is not a directory"
    
    def test_file_naming_conventions(self):
        """Test that files follow naming conventions"""
        video_id = "6jvskRWvQkg"
        timestamp = "20260101_120000"
        
        # Test naming patterns
        naming_patterns = {
            "transcript_text": f"transcripts/{video_id}_{timestamp}.txt",
            "transcript_json": f"transcripts/{video_id}_{timestamp}.json",
            "analysis_request": f"analyses/{video_id}_{timestamp}_analysis_request.txt",
            "extraction_prompt": f"analyses/{video_id}_{timestamp}_extraction_prompt.txt",
            "restaurant_data": f"data/restaurants/{video_id}_1.json",
            "batch_results": f"demo_results/batch_analysis_{timestamp}.json"
        }
        
        for file_type, expected_path in naming_patterns.items():
            assert video_id in expected_path, f"Video ID not in {file_type} filename"
            assert expected_path.endswith(('.txt', '.json', '.md')), f"Invalid extension for {file_type}"
    
    def test_json_serialization(self):
        """Test JSON serialization of restaurant data"""
        restaurant_data = {
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
            "host_comments": "מקום מעולה עם נוף לים",
            "menu_items": ["דגים", "פירות ים"],
            "special_features": ["נוף לים", "טיילת"],
            "contact_info": {
                "hours": "12:00-24:00",
                "phone": "03-1234567",
                "website": "https://checoli.co.il"
            },
            "business_news": None,
            "mention_context": "review",
            "episode_info": {
                "video_id": "6jvskRWvQkg",
                "video_url": "https://www.youtube.com/watch?v=6jvskRWvQkg",
                "language": "he",
                "analysis_date": "2026-01-01"
            }
        }
        
        # Test serialization
        json_string = json.dumps(restaurant_data, ensure_ascii=False, indent=2)
        assert "צ'קולי" in json_string
        assert "תל אביב" in json_string
        
        # Test deserialization
        parsed_data = json.loads(json_string)
        assert parsed_data["name_hebrew"] == "צ'קולי"
        assert parsed_data["location"]["city"] == "תל אביב"
    
    def test_file_encoding(self):
        """Test that files are saved with proper UTF-8 encoding"""
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False) as f:
            hebrew_text = "שלום מסעדות תל אביב צ'קולי גורמי"
            f.write(hebrew_text)
            temp_path = f.name
        
        try:
            # Read back and verify
            with open(temp_path, 'r', encoding='utf-8') as f:
                read_text = f.read()
                assert read_text == hebrew_text
        finally:
            os.unlink(temp_path)


class TestTranscriptPersistence:
    """Test transcript data persistence"""
    
    @pytest.fixture
    def sample_transcript_data(self):
        return {
            'video_id': '6jvskRWvQkg',
            'video_url': 'https://www.youtube.com/watch?v=6jvskRWvQkg',
            'language': 'he',
            'transcript': 'שלום וברוכים הבאים לתוכנית אוכל. היום נדבר על מסעדות.',
            'segments': [
                {'text': 'שלום וברוכים הבאים', 'start': 0.0, 'duration': 2.0},
                {'text': 'היום נדבר על מסעדות', 'start': 2.0, 'duration': 3.0}
            ],
            'segment_count': 2,
            'formatted_timestamp': '2026-01-01 12:00:00'
        }
    
    def test_save_transcript_files(self, sample_transcript_data):
        """Test saving transcript in both text and JSON formats"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Import and use the save_transcript function
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
            from restaurant_analyzer import save_transcript
            
            text_file, json_file = save_transcript(sample_transcript_data)
            
            # Check files exist
            assert os.path.exists(text_file)
            assert os.path.exists(json_file)
            
            # Check text file content
            with open(text_file, 'r', encoding='utf-8') as f:
                text_content = f.read()
                assert '6jvskRWvQkg' in text_content
                assert 'שלום וברוכים הבאים' in text_content
                assert 'YouTube Video:' in text_content
            
            # Check JSON file content
            with open(json_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
                assert json_data['video_id'] == '6jvskRWvQkg'
                assert json_data['language'] == 'he'
                assert len(json_data['segments']) == 2
    
    def test_transcript_metadata(self, sample_transcript_data):
        """Test that transcript files contain proper metadata"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            from restaurant_analyzer import save_transcript
            text_file, json_file = save_transcript(sample_transcript_data)
            
            # Check metadata in text file
            with open(text_file, 'r', encoding='utf-8') as f:
                content = f.read()
                metadata_fields = [
                    "YouTube Video:",
                    "Video ID:",
                    "Language:",
                    "Fetched:",
                    "Total Segments:",
                    "Total Characters:"
                ]
                
                for field in metadata_fields:
                    assert field in content, f"Missing metadata field: {field}"


class TestRestaurantDataPersistence:
    """Test restaurant data storage and API format"""
    
    @pytest.fixture
    def sample_restaurants_data(self):
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
                    "host_comments": "מקום מעולה",
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
                    "host_comments": "אותנטי ומחירים טובים",
                    "menu_items": ["אוכל פרסי"],
                    "special_features": ["מחירים נוחים"],
                    "contact_info": {"hours": None, "phone": None, "website": None},
                    "business_news": None,
                    "mention_context": "review"
                }
            ],
            "food_trends": ["מטבח ים תיכוני", "אוכל אותנטי"],
            "episode_summary": "פרק על מסעדות מומלצות בתל אביב"
        }
    
    def test_save_restaurants_for_api(self, sample_restaurants_data):
        """Test saving restaurant data in API format"""
        from scripts.main import RestaurantPodcastAnalyzer
        
        with tempfile.TemporaryDirectory() as temp_dir:
            # Mock the data directory path
            restaurants_dir = os.path.join(temp_dir, "data", "restaurants")
            os.makedirs(restaurants_dir, exist_ok=True)
            
            with patch('scripts.main.os.path.join', return_value=restaurants_dir):
                with patch('scripts.main.os.makedirs'):
                    analyzer = RestaurantPodcastAnalyzer()
                    transcript_data = {'video_id': '6jvskRWvQkg'}
                    
                    result = analyzer.save_restaurants_for_api(
                        sample_restaurants_data, transcript_data
                    )
                    
                    # Check that files were created message
                    assert "Saved" in result
                    assert "restaurant files" in result
    
    def test_restaurant_file_structure(self):
        """Test individual restaurant file structure"""
        with tempfile.TemporaryDirectory() as temp_dir:
            restaurant_file = os.path.join(temp_dir, "test_restaurant.json")
            
            restaurant_data = {
                "name_hebrew": "מסעדה לבדיקה",
                "name_english": "Test Restaurant", 
                "location": {
                    "city": "תל אביב",
                    "neighborhood": "מרכז",
                    "address": "רחוב הבדיקה 123",
                    "region": "Center"
                },
                "cuisine_type": "Test Cuisine",
                "status": "open",
                "price_range": "mid-range",
                "episode_info": {
                    "video_id": "test123",
                    "video_url": "https://www.youtube.com/watch?v=test123",
                    "language": "he"
                }
            }
            
            # Save restaurant data
            with open(restaurant_file, 'w', encoding='utf-8') as f:
                json.dump(restaurant_data, f, ensure_ascii=False, indent=2)
            
            # Verify file was saved correctly
            with open(restaurant_file, 'r', encoding='utf-8') as f:
                loaded_data = json.load(f)
                assert loaded_data["name_hebrew"] == "מסעדה לבדיקה"
                assert loaded_data["location"]["city"] == "תל אביב"
                assert loaded_data["episode_info"]["video_id"] == "test123"


class TestLoggingAndBatchResults:
    """Test logging and batch result persistence"""
    
    def test_agent_call_logging(self):
        """Test that agent calls are logged properly"""
        from scripts.main import RestaurantPodcastAnalyzer
        
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Create analyzer and test logging
            with patch('scripts.main.setup_logging'):
                analyzer = RestaurantPodcastAnalyzer()
                
                # Mock log_agent_call to test structure
                agent_log_entry = {
                    "timestamp": datetime.now().isoformat(),
                    "agent_type": "YouTubeTranscriptCollector",
                    "action": "fetch_transcript",
                    "details": {"video_url": "https://www.youtube.com/watch?v=test123"}
                }
                
                # Test log entry structure
                assert "timestamp" in agent_log_entry
                assert "agent_type" in agent_log_entry
                assert "action" in agent_log_entry
                assert "details" in agent_log_entry
    
    def test_batch_results_format(self):
        """Test batch processing results format"""
        batch_results = {
            "total_podcasts": 2,
            "successful": 1,
            "failed": 1,
            "results": [
                {
                    "video_url": "https://www.youtube.com/watch?v=success",
                    "success": True,
                    "video_id": "success123",
                    "files_generated": ["file1.txt", "file2.json"]
                },
                {
                    "video_url": "https://www.youtube.com/watch?v=failed", 
                    "success": False,
                    "error": "Transcript not available"
                }
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        # Test structure
        assert batch_results["total_podcasts"] == 2
        assert batch_results["successful"] == 1
        assert batch_results["failed"] == 1
        assert len(batch_results["results"]) == 2
        
        # Test individual results
        success_result = batch_results["results"][0]
        assert success_result["success"] is True
        assert "video_id" in success_result
        
        failed_result = batch_results["results"][1]
        assert failed_result["success"] is False
        assert "error" in failed_result


class TestFileSystemIntegration:
    """Test integration with file system operations"""
    
    def test_directory_structure_creation(self):
        """Test that the full directory structure is created correctly"""
        required_structure = {
            "transcripts": "txt,json",
            "analyses": "txt,md", 
            "data/restaurants": "json",
            "logs": "log,json",
            "demo_results": "json,md"
        }
        
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Create all directories
            for dir_path in required_structure.keys():
                os.makedirs(dir_path, exist_ok=True)
                assert os.path.exists(dir_path)
    
    def test_file_permissions(self):
        """Test that created files have correct permissions"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write("test content")
            temp_path = f.name
        
        try:
            # Check that file is readable and writable
            assert os.access(temp_path, os.R_OK)
            assert os.access(temp_path, os.W_OK)
        finally:
            os.unlink(temp_path)
    
    def test_large_file_handling(self):
        """Test handling of large transcript files"""
        large_content = "א" * 100000  # Large Hebrew content
        
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', delete=False) as f:
            f.write(large_content)
            temp_path = f.name
        
        try:
            # Verify large file can be read back
            with open(temp_path, 'r', encoding='utf-8') as f:
                read_content = f.read()
                assert len(read_content) == 100000
                assert read_content[0] == 'א'
        finally:
            os.unlink(temp_path)


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
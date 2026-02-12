"""
End-to-end integration tests for the complete YouTube restaurant analysis pipeline
Tests the full workflow from URL to restaurant data extraction
"""

import os
import sys
import pytest
import json
import tempfile
import shutil
from datetime import datetime
from unittest.mock import Mock, patch, MagicMock

# Add project paths — scripts must come first so `main` resolves to scripts/main.py
# (not api/main.py which is the FastAPI app)
SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'scripts')
SRC_DIR = os.path.join(os.path.dirname(__file__), '..', 'src')
sys.path.insert(0, SCRIPTS_DIR)
sys.path.insert(0, SRC_DIR)

# Import modules to test
from restaurant_analyzer import run_complete_pipeline, fetch_transcript, create_analysis_request
from scripts.main import RestaurantPodcastAnalyzer


class TestFullPipelineIntegration:
    """Test the complete pipeline from YouTube URL to restaurant data"""
    
    @pytest.fixture
    def test_video_url(self):
        """Test video URL"""
        return "https://www.youtube.com/watch?v=6jvskRWvQkg"
    
    @pytest.fixture
    def mock_transcript_data(self):
        """Mock transcript data for testing"""
        return {
            'video_id': '6jvskRWvQkg',
            'video_url': 'https://www.youtube.com/watch?v=6jvskRWvQkg',
            'language': 'he',
            'transcript': '''
            שלום וברוכים הבאים לתוכנית אוכל חדשה. היום אני רוצה לדבר איתכם על כמה מסעדות מעולות שגיליתי השבוע.
            
            המסעדה הראשונה היא צ'קולי שנמצאת בתל אביב ליד הנמל. זה מקום ספרדי מעולה עם נוף לים.
            האוכל שם פשוט מדהים - יש להם דגים טריים ופירות ים מעולים. השף שם עושה חמוסטה תאילנדית 
            שזה פשוט משהו אחר. המחירים בסביבות 80-120 שקל למנה עיקרית.
            
            המסעדה השנייה שאני רוצה להמליץ עליה היא גורמי סבזי בשוק לוינסקי בתל אביב. 
            זה מקום פרסי אותנטי עם בעלים שבאמת יודע מה הוא עושה. האוכל שם פרסי מסורתי
            במחירים מצוינים - בין 25-40 שקל למנה. הם מכינים שם קבבים וכל מיני תבשילי אורז מדהימים.
            
            המסעדה השלישית היא מרי פוסה בקיסריה. זה מקום תאילנדי מעולה עם השף חביב משה.
            המקום יקר יותר - בסביבות 150-200 שקל למנה, אבל החוויה שווה את זה.
            יש שם חמוסטה תאילנדית מעולה ועוד המון מנות תאילנדיות אותנטיות.
            
            בקיצור, שלוש המלצות חמות לסוף השבוע. אם אתם אוהבים אוכל טוב, תלכו לאחד מהמקומות האלה.
            ''',
            'segments': [
                {'text': 'שלום וברוכים הבאים לתוכנית אוכל חדשה', 'start': 0.0, 'duration': 3.0},
                {'text': 'היום אני רוצה לדבר איתכם על כמה מסעדות מעולות', 'start': 3.0, 'duration': 4.0},
                {'text': 'המסעדה הראשונה היא צ\'קולי', 'start': 7.0, 'duration': 3.0}
            ],
            'segment_count': 3,
            'formatted_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    
    @pytest.fixture
    def expected_restaurants(self):
        """Expected restaurants to be extracted from the mock transcript"""
        return [
            {
                'name_hebrew': 'צ\'קולי',
                'name_english': 'Checoli',
                'location': {'city': 'תל אביב', 'neighborhood': 'נמל תל אביב'},
                'cuisine_type': 'Spanish/Seafood',
                'price_range': 'mid-range'
            },
            {
                'name_hebrew': 'גורמי סבזי', 
                'name_english': 'Gourmet Sabzi',
                'location': {'city': 'תל אביב', 'neighborhood': 'שוק לוינסקי'},
                'cuisine_type': 'Persian',
                'price_range': 'budget'
            },
            {
                'name_hebrew': 'מרי פוסה',
                'name_english': 'Mary Posa', 
                'location': {'city': 'קיסריה'},
                'cuisine_type': 'Thai',
                'price_range': 'expensive'
            }
        ]
    
    def test_pipeline_step_by_step(self, test_video_url, mock_transcript_data):
        """Test each step of the pipeline individually"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Step 1: Mock transcript fetching
            with patch('src.youtube_transcript_collector.YouTubeTranscriptCollector') as mock_collector:
                mock_instance = Mock()
                mock_instance.get_transcript.return_value = mock_transcript_data
                mock_collector.return_value = mock_instance
                
                # Test transcript fetching
                transcript_result = fetch_transcript(test_video_url)
                assert transcript_result is not None
                assert transcript_result['video_id'] == '6jvskRWvQkg'
                assert 'צ\'קולי' in transcript_result['transcript']
            
            # Step 2: Test analysis request creation
            analysis_request = create_analysis_request(mock_transcript_data)
            assert 'Hebrew food podcast transcript' in analysis_request
            assert 'צ\'קולי' in analysis_request
            assert 'גורמי סבזי' in analysis_request
            assert 'מרי פוסה' in analysis_request
            
            # Step 3: Test file creation structure
            required_dirs = ['transcripts', 'analyses']
            for dir_name in required_dirs:
                os.makedirs(dir_name, exist_ok=True)
                assert os.path.exists(dir_name)
    
    @patch('src.youtube_transcript_collector.YouTubeTranscriptCollector')
    def test_complete_pipeline_execution(self, mock_collector, test_video_url, mock_transcript_data):
        """Test the complete pipeline execution"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Mock the transcript collector
            mock_instance = Mock()
            mock_instance.get_transcript.return_value = mock_transcript_data
            mock_collector.return_value = mock_instance
            
            # Run the complete pipeline
            result = run_complete_pipeline(test_video_url)
            
            # Verify pipeline success
            assert result['success'] is True
            assert result['video_id'] == '6jvskRWvQkg'
            assert result['language'] == 'he'
            
            # Verify files were created
            assert 'transcript_files' in result
            assert 'analysis_request_file' in result
            
            # Check that transcript files exist
            transcript_files = result['transcript_files']
            assert os.path.exists(transcript_files['text'])
            assert os.path.exists(transcript_files['json'])
            
            # Check analysis request file exists
            assert os.path.exists(result['analysis_request_file'])
    
    def test_restaurant_podcast_analyzer_integration(self, test_video_url, mock_transcript_data):
        """Test the RestaurantPodcastAnalyzer class end-to-end"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)

            # Mock the transcript collector and other dependencies
            with patch('scripts.main.YouTubeTranscriptCollector') as mock_collector, \
                 patch('scripts.main.RestaurantSearchAgent'), \
                 patch('scripts.main.UnifiedRestaurantAnalyzer'), \
                 patch('scripts.main.setup_logging', return_value=Mock()):
                mock_instance = Mock()
                mock_instance.get_transcript.return_value = mock_transcript_data
                mock_instance.get_transcript_auto.return_value = None
                mock_collector.return_value = mock_instance

                # Create analyzer
                analyzer = RestaurantPodcastAnalyzer()

                # Process single podcast
                result = analyzer.process_single_podcast(test_video_url)

                # Verify result structure
                assert result['success'] is True
                assert result['video_id'] == '6jvskRWvQkg'
                assert result['language'] == 'he'
                assert 'files_generated' in result
                assert 'analysis_request_file' in result
    
    def test_restaurant_extraction_integration(self, mock_transcript_data, expected_restaurants):
        """Test restaurant extraction from transcript"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)

            with patch('scripts.main.setup_logging', return_value=Mock()), \
                 patch('scripts.main.YouTubeTranscriptCollector'), \
                 patch('scripts.main.RestaurantSearchAgent'), \
                 patch('scripts.main.UnifiedRestaurantAnalyzer') as mock_analyzer_cls:
                # Setup mock analyzer to return expected data
                mock_analyzer_instance = Mock()
                mock_analyzer_instance.config.provider = 'openai'
                mock_analyzer_instance.analyze_transcript.return_value = {
                    'episode_info': {
                        'video_id': mock_transcript_data['video_id'],
                        'video_url': mock_transcript_data['video_url'],
                        'language': mock_transcript_data['language'],
                        'analysis_date': datetime.now().isoformat()
                    },
                    'restaurants': [
                        {'name_hebrew': "צ'קולי", 'name_english': 'Checoli'},
                        {'name_hebrew': 'גורמי סבזי', 'name_english': 'Gourmet Sabzi'},
                        {'name_hebrew': 'מרי פוסה', 'name_english': 'Mary Posa'}
                    ],
                    'food_trends': ['ים תיכוני'],
                    'episode_summary': 'פרק על מסעדות'
                }
                mock_analyzer_cls.return_value = mock_analyzer_instance

                analyzer = RestaurantPodcastAnalyzer()

                # Test restaurant extraction
                restaurants_data = analyzer.extract_restaurants_with_llm(mock_transcript_data)
                
                # Verify structure
                assert 'episode_info' in restaurants_data
                assert 'restaurants' in restaurants_data
                assert 'food_trends' in restaurants_data
                assert 'episode_summary' in restaurants_data
                
                # Verify episode info
                episode_info = restaurants_data['episode_info']
                assert episode_info['video_id'] == '6jvskRWvQkg'
                assert episode_info['language'] == 'he'
                
                # Verify restaurants found
                restaurants = restaurants_data['restaurants']
                assert len(restaurants) >= 2  # Should find at least 2 restaurants
                
                # Check that expected restaurants are found
                restaurant_names = [r['name_hebrew'] for r in restaurants]
                expected_names = ['צ\'קולי', 'מרי פוסה', 'גורמי סבזי']
                
                found_restaurants = [name for name in expected_names
                                   if any(name in restaurant_name
                                         for restaurant_name in restaurant_names)]
                assert len(found_restaurants) >= 2
    
    def test_batch_processing_integration(self, mock_transcript_data):
        """Test batch processing of multiple videos"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)

            video_urls = [
                "https://www.youtube.com/watch?v=6jvskRWvQkg",
                "https://www.youtube.com/watch?v=test123456"
            ]

            # Mock transcript collector for all videos
            with patch('scripts.main.YouTubeTranscriptCollector') as mock_collector, \
                 patch('scripts.main.RestaurantSearchAgent'), \
                 patch('scripts.main.UnifiedRestaurantAnalyzer'), \
                 patch('scripts.main.setup_logging', return_value=Mock()):
                mock_instance = Mock()

                def mock_get_transcript(url, **kwargs):
                    if '6jvskRWvQkg' in url:
                        return mock_transcript_data
                    else:
                        return None  # Simulate failed transcript for second video

                mock_instance.get_transcript.side_effect = mock_get_transcript
                mock_instance.get_transcript_auto.return_value = None
                mock_collector.return_value = mock_instance

                analyzer = RestaurantPodcastAnalyzer()

                # Process multiple podcasts
                batch_results = analyzer.process_multiple_podcasts(video_urls)

                # Verify batch results structure
                assert batch_results['total_podcasts'] == 2
                assert batch_results['successful'] >= 1
                assert batch_results['failed'] >= 1
                assert len(batch_results['results']) == 2

                # Verify individual results
                results = batch_results['results']
                success_result = next(r for r in results if r['success'])
                assert success_result['video_id'] == '6jvskRWvQkg'
    
    def test_error_handling_integration(self):
        """Test error handling throughout the pipeline"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)

            # Test with invalid URL
            invalid_url = "not_a_youtube_url"

            with patch('scripts.main.setup_logging', return_value=Mock()), \
                 patch('scripts.main.YouTubeTranscriptCollector') as mock_collector, \
                 patch('scripts.main.RestaurantSearchAgent'), \
                 patch('scripts.main.UnifiedRestaurantAnalyzer'):
                mock_instance = Mock()
                mock_instance.get_transcript.return_value = None
                mock_instance.get_transcript_auto.return_value = None
                mock_collector.return_value = mock_instance

                analyzer = RestaurantPodcastAnalyzer()
                result = analyzer.process_single_podcast(invalid_url)

                assert result['success'] is False
                assert 'error' in result

            # Test with unavailable transcript
            with patch('scripts.main.YouTubeTranscriptCollector') as mock_collector, \
                 patch('scripts.main.RestaurantSearchAgent'), \
                 patch('scripts.main.UnifiedRestaurantAnalyzer'), \
                 patch('scripts.main.setup_logging', return_value=Mock()):
                mock_instance = Mock()
                mock_instance.get_transcript.return_value = None
                mock_instance.get_transcript_auto.return_value = None
                mock_collector.return_value = mock_instance

                analyzer = RestaurantPodcastAnalyzer()

                result = analyzer.process_single_podcast("https://www.youtube.com/watch?v=unavailable")
                assert result['success'] is False
                assert result['error'] == "Failed to fetch transcript"
    
    def test_data_persistence_integration(self, mock_transcript_data):
        """Test that data is properly persisted throughout the pipeline"""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)

            with patch('scripts.main.YouTubeTranscriptCollector') as mock_collector, \
                 patch('scripts.main.RestaurantSearchAgent'), \
                 patch('scripts.main.UnifiedRestaurantAnalyzer'), \
                 patch('scripts.main.setup_logging', return_value=Mock()):
                mock_instance = Mock()
                mock_instance.get_transcript.return_value = mock_transcript_data
                mock_collector.return_value = mock_instance

                analyzer = RestaurantPodcastAnalyzer()

                # Process podcast
                result = analyzer.process_single_podcast("https://www.youtube.com/watch?v=6jvskRWvQkg")

                # Verify files were created
                assert result['success'] is True
                files_generated = result['files_generated']

                # Check that all generated files exist
                for file_path in files_generated:
                    if os.path.isabs(file_path):
                        # Absolute path - check if file exists
                        assert os.path.exists(file_path), f"Generated file not found: {file_path}"
                    else:
                        # Relative path - check in current directory
                        assert os.path.exists(file_path), f"Generated file not found: {file_path}"

                # Verify transcript files contain expected content
                transcript_files = [f for f in files_generated if 'transcript' in f]
                if transcript_files:
                    text_file = next((f for f in transcript_files if f.endswith('.txt')), None)
                    if text_file and os.path.exists(text_file):
                        with open(text_file, 'r', encoding='utf-8') as f:
                            content = f.read()
                            assert '6jvskRWvQkg' in content
                            assert 'צ\'קולי' in content


class TestPipelinePerformance:
    """Test pipeline performance and scalability"""
    
    def test_large_transcript_handling(self):
        """Test handling of large transcripts"""
        large_transcript_data = {
            'video_id': 'large_test',
            'video_url': 'https://www.youtube.com/watch?v=large_test',
            'language': 'he',
            'transcript': 'מסעדה טובה ' * 10000,  # Large transcript
            'segments': [{'text': f'מסגמנט {i}', 'start': i*1.0, 'duration': 1.0} 
                        for i in range(1000)],  # Many segments
            'segment_count': 1000,
            'formatted_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Test analysis request creation with large transcript
        analysis_request = create_analysis_request(large_transcript_data)
        
        # Should be truncated but still functional
        assert 'TRANSCRIPT TRUNCATED' in analysis_request
        assert len(analysis_request) < 50000  # Should be reasonable size
    
    def test_multiple_restaurants_extraction(self):
        """Test extraction when many restaurants are mentioned"""
        complex_transcript = {
            'video_id': 'complex_test',
            'video_url': 'https://www.youtube.com/watch?v=complex_test',
            'language': 'he',
            'transcript': '''
            היום נדבר על 10 מסעדות: צ'קולי, מרי פוסה, גורמי סבזי, הסתקיה,
            משיה, ביסטרו 44, אונה, פופינה, מנטה ועוד מסעדה אחת שכתחתי.
            כל מסעדה יש לה סיפור מיוחד ואוכל מעולה.
            ''',
            'segments': [],
            'segment_count': 0,
            'formatted_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        with patch('scripts.main.setup_logging', return_value=Mock()), \
             patch('scripts.main.YouTubeTranscriptCollector'), \
             patch('scripts.main.RestaurantSearchAgent'), \
             patch('scripts.main.UnifiedRestaurantAnalyzer') as mock_analyzer_cls:
            mock_analyzer = Mock()
            mock_analyzer.config.provider = 'openai'
            mock_analyzer.analyze_transcript.return_value = {
                'episode_info': {'video_id': 'complex_test'},
                'restaurants': [
                    {'name_hebrew': "צ'קולי"},
                    {'name_hebrew': 'מרי פוסה'},
                    {'name_hebrew': 'גורמי סבזי'},
                ],
                'food_trends': [],
                'episode_summary': ''
            }
            mock_analyzer_cls.return_value = mock_analyzer

            analyzer = RestaurantPodcastAnalyzer()

            # Test extraction with many mentions
            restaurants_data = analyzer.extract_restaurants_with_llm(complex_transcript)

            # Should handle multiple restaurants
            assert len(restaurants_data['restaurants']) >= 2
            assert 'episode_info' in restaurants_data


class TestPipelineRobustness:
    """Test pipeline robustness and edge cases"""
    
    def test_empty_transcript(self):
        """Test handling of empty transcripts"""
        empty_transcript_data = {
            'video_id': 'empty_test',
            'video_url': 'https://www.youtube.com/watch?v=empty_test',
            'language': 'he',
            'transcript': '',
            'segments': [],
            'segment_count': 0,
            'formatted_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Should still create valid analysis request
        analysis_request = create_analysis_request(empty_transcript_data)
        assert 'empty_test' in analysis_request
        assert 'TASK:' in analysis_request
    
    def test_non_hebrew_transcript(self):
        """Test handling of non-Hebrew transcripts"""
        english_transcript_data = {
            'video_id': 'english_test',
            'video_url': 'https://www.youtube.com/watch?v=english_test',
            'language': 'en',
            'transcript': 'Today we talk about great restaurants in Tel Aviv. First restaurant is Checoli.',
            'segments': [],
            'segment_count': 0,
            'formatted_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Should handle English transcripts
        analysis_request = create_analysis_request(english_transcript_data)
        assert 'english_test' in analysis_request
        assert 'Checoli' in analysis_request
    
    def test_malformed_video_urls(self):
        """Test handling of malformed video URLs"""
        malformed_urls = [
            "",
            "not_a_url",
            "https://www.youtube.com/",
            "https://www.youtube.com/watch",
            "https://vimeo.com/123456"
        ]

        with patch('scripts.main.setup_logging', return_value=Mock()), \
             patch('scripts.main.YouTubeTranscriptCollector') as mock_collector, \
             patch('scripts.main.RestaurantSearchAgent'), \
             patch('scripts.main.UnifiedRestaurantAnalyzer'):
            mock_instance = Mock()
            mock_instance.get_transcript.return_value = None
            mock_instance.get_transcript_auto.return_value = None
            mock_collector.return_value = mock_instance

            analyzer = RestaurantPodcastAnalyzer()

            for url in malformed_urls:
                result = analyzer.process_single_podcast(url)
                assert result['success'] is False
                assert 'error' in result


if __name__ == "__main__":
    # Run tests if script is executed directly
    pytest.main([__file__, "-v"])
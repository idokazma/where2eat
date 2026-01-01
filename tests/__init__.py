"""
Test suite for the Where2Eat YouTube restaurant analysis pipeline.

This test package contains comprehensive tests for:
1. YouTube transcript extraction
2. Restaurant extraction via LLM analysis  
3. Data persistence and file handling
4. End-to-end pipeline integration

Test modules:
- test_youtube_transcript.py: Tests YouTube transcript collection functionality
- test_restaurant_extraction.py: Tests restaurant analysis and LLM integration
- test_data_persistence.py: Tests file operations and data storage
- test_pipeline_integration.py: End-to-end integration tests

To run all tests:
    pytest tests/

To run specific test modules:
    pytest tests/test_youtube_transcript.py -v
    pytest tests/test_restaurant_extraction.py -v
    pytest tests/test_data_persistence.py -v
    pytest tests/test_pipeline_integration.py -v

To run with coverage:
    pytest tests/ --cov=src --cov=scripts --cov-report=html
"""

__version__ = "1.0.0"
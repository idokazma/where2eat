"""
Where2Eat - Restaurant Discovery System
Intelligent system for discovering trending restaurants from YouTube podcasts.
"""

__version__ = "1.0.0"
__author__ = "Where2Eat Team"
__email__ = "team@where2eat.com"

from .youtube_transcript_collector import YouTubeTranscriptCollector
from .restaurant_analyzer import create_analysis_request, save_transcript
from .restaurant_search_agent import RestaurantSearchAgent
from .restaurant_location_collector import RestaurantLocationCollector
from .restaurant_image_collector import RestaurantImageCollector
from .map_integration import MapIntegration

__all__ = [
    "YouTubeTranscriptCollector",
    "create_analysis_request",
    "save_transcript", 
    "RestaurantSearchAgent",
    "RestaurantLocationCollector",
    "RestaurantImageCollector",
    "MapIntegration",
]
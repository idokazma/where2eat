"""
Gemini Video Analyzer
Analyzes YouTube videos directly using Google's Gemini API with video understanding.
Extracts restaurant mentions, transcripts, and food-related content.
"""

import os
import json
import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class VideoAnalysisResult:
    """Result of analyzing a YouTube video."""
    video_id: str
    video_url: str
    title: Optional[str]
    transcript: Optional[str]
    restaurants: List[Dict[str, Any]]
    food_trends: List[str]
    episode_summary: str
    language: str
    success: bool
    error: Optional[str] = None


class GeminiVideoAnalyzer:
    """
    Analyzes YouTube videos using Gemini's native video understanding.
    Can extract transcripts, restaurant mentions, and food trends directly from videos.
    """

    RESTAURANT_EXTRACTION_PROMPT = """You are an expert at analyzing food and restaurant content from videos.

Analyze this YouTube video and extract ALL restaurant mentions. For each restaurant, provide:

1. **Restaurant Name** (in Hebrew and English if mentioned)
2. **Location** (city, neighborhood, address if mentioned)
3. **Cuisine Type** (e.g., Italian, Asian, Israeli, Mediterranean)
4. **Host Opinion** (positive, negative, mixed, neutral)
5. **Key Comments** (what was said about the restaurant)
6. **Menu Items** (any dishes or items mentioned)
7. **Price Range** (budget, mid-range, expensive, or not mentioned)
8. **Special Features** (outdoor seating, delivery, etc.)

Also extract:
- **Food Trends** mentioned in the video
- **Episode Summary** (2-3 sentences about what the video covers)
- **Full Transcript** of the spoken content

Return your response as valid JSON with this structure:
{
    "video_title": "...",
    "language": "Hebrew" or "English" or other,
    "transcript": "full transcript text here...",
    "restaurants": [
        {
            "name_hebrew": "שם המסעדה",
            "name_english": "Restaurant Name",
            "location": {
                "city": "תל אביב",
                "neighborhood": "נווה צדק",
                "address": "רחוב שבזי 12"
            },
            "cuisine_type": "Italian",
            "host_opinion": "positive",
            "host_comments": "מסעדה מעולה עם פסטה מדהימה",
            "menu_items": [
                {"item_name": "פסטה קרבונרה", "price": "78 ש\"ח"}
            ],
            "price_range": "mid-range",
            "special_features": ["outdoor seating", "delivery"]
        }
    ],
    "food_trends": ["Mediterranean cuisine", "Farm to table"],
    "episode_summary": "In this episode, the host visits three new restaurants in Tel Aviv..."
}

Important:
- Extract ALL restaurants mentioned, even briefly
- Keep Hebrew names in Hebrew
- Include timestamps if you can identify when restaurants are discussed
- Be thorough - don't miss any restaurant mentions"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini Video Analyzer.

        Args:
            api_key: Google Gemini API key. If None, reads from GEMINI_API_KEY env var.
        """
        if not GEMINI_AVAILABLE:
            raise ImportError(
                "google-generativeai package not installed. "
                "Install with: pip install google-generativeai"
            )

        self.api_key = api_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError(
                "Gemini API key not found. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable."
            )

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-pro')
        self.logger = logging.getLogger(__name__)

    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract video ID from various YouTube URL formats."""
        patterns = [
            r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
            r'(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    def analyze_video(self, video_url: str) -> VideoAnalysisResult:
        """
        Analyze a YouTube video for restaurant content.

        Args:
            video_url: YouTube video URL

        Returns:
            VideoAnalysisResult with extracted data
        """
        video_id = self.extract_video_id(video_url)
        if not video_id:
            return VideoAnalysisResult(
                video_id="unknown",
                video_url=video_url,
                title=None,
                transcript=None,
                restaurants=[],
                food_trends=[],
                episode_summary="",
                language="unknown",
                success=False,
                error="Invalid YouTube URL"
            )

        try:
            self.logger.info(f"Analyzing video: {video_id}")

            # Use Gemini to analyze the video directly
            response = self.model.generate_content([
                self.RESTAURANT_EXTRACTION_PROMPT,
                {"video_url": video_url}
            ])

            # Parse the response
            result_text = response.text

            # Extract JSON from response (handle markdown code blocks)
            json_match = re.search(r'```json\s*(.*?)\s*```', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group(1)
            else:
                # Try to find JSON object directly
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result_text = json_match.group(0)

            data = json.loads(result_text)

            return VideoAnalysisResult(
                video_id=video_id,
                video_url=video_url,
                title=data.get('video_title'),
                transcript=data.get('transcript'),
                restaurants=data.get('restaurants', []),
                food_trends=data.get('food_trends', []),
                episode_summary=data.get('episode_summary', ''),
                language=data.get('language', 'unknown'),
                success=True
            )

        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse Gemini response as JSON: {e}")
            return VideoAnalysisResult(
                video_id=video_id,
                video_url=video_url,
                title=None,
                transcript=None,
                restaurants=[],
                food_trends=[],
                episode_summary="",
                language="unknown",
                success=False,
                error=f"Failed to parse response: {str(e)}"
            )
        except Exception as e:
            self.logger.error(f"Error analyzing video {video_id}: {e}")
            return VideoAnalysisResult(
                video_id=video_id,
                video_url=video_url,
                title=None,
                transcript=None,
                restaurants=[],
                food_trends=[],
                episode_summary="",
                language="unknown",
                success=False,
                error=str(e)
            )

    def analyze_playlist(
        self,
        video_urls: List[str],
        max_videos: int = 10
    ) -> List[VideoAnalysisResult]:
        """
        Analyze multiple videos from a playlist.

        Args:
            video_urls: List of YouTube video URLs
            max_videos: Maximum number of videos to analyze

        Returns:
            List of VideoAnalysisResult objects
        """
        results = []
        for i, url in enumerate(video_urls[:max_videos]):
            self.logger.info(f"Processing video {i+1}/{min(len(video_urls), max_videos)}")
            result = self.analyze_video(url)
            results.append(result)
        return results

    def get_video_transcript(self, video_url: str) -> Optional[str]:
        """
        Get just the transcript from a video.

        Args:
            video_url: YouTube video URL

        Returns:
            Transcript text or None
        """
        try:
            response = self.model.generate_content([
                "Please provide the complete transcript of this video. "
                "Return only the spoken text, nothing else.",
                {"video_url": video_url}
            ])
            return response.text
        except Exception as e:
            self.logger.error(f"Error getting transcript: {e}")
            return None

    def list_playlist_videos(self, playlist_url: str) -> List[Dict[str, str]]:
        """
        Get list of videos from a playlist using Gemini.

        Args:
            playlist_url: YouTube playlist URL

        Returns:
            List of video info dicts with 'video_id', 'title', 'url'
        """
        try:
            response = self.model.generate_content([
                """Analyze this YouTube playlist and list all videos in it.
                Return as JSON array with format:
                [
                    {"video_id": "xxx", "title": "Video Title", "url": "https://youtube.com/watch?v=xxx"},
                    ...
                ]
                Return ONLY the JSON array, no other text.""",
                {"video_url": playlist_url}
            ])

            result_text = response.text

            # Extract JSON
            json_match = re.search(r'\[.*\]', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))

            return []
        except Exception as e:
            self.logger.error(f"Error listing playlist videos: {e}")
            return []


def analyze_playlist_with_gemini(
    playlist_url: str,
    api_key: Optional[str] = None,
    max_videos: int = 10
) -> Dict[str, Any]:
    """
    Convenience function to analyze a playlist with Gemini.

    Args:
        playlist_url: YouTube playlist URL
        api_key: Gemini API key (optional, uses env var if not provided)
        max_videos: Maximum videos to analyze

    Returns:
        Dictionary with analysis results
    """
    analyzer = GeminiVideoAnalyzer(api_key=api_key)

    # Get playlist videos
    videos = analyzer.list_playlist_videos(playlist_url)

    if not videos:
        return {
            "success": False,
            "error": "Could not fetch playlist videos",
            "videos": []
        }

    # Analyze each video
    results = []
    all_restaurants = []

    for i, video in enumerate(videos[:max_videos]):
        print(f"\n[{i+1}/{min(len(videos), max_videos)}] Analyzing: {video.get('title', video.get('url'))}")

        result = analyzer.analyze_video(video['url'])
        results.append({
            "video_id": result.video_id,
            "title": result.title or video.get('title'),
            "success": result.success,
            "restaurants": result.restaurants,
            "food_trends": result.food_trends,
            "episode_summary": result.episode_summary,
            "error": result.error
        })

        if result.success:
            for restaurant in result.restaurants:
                restaurant['source_video'] = result.video_id
                restaurant['source_title'] = result.title or video.get('title')
                all_restaurants.append(restaurant)

    return {
        "success": True,
        "playlist_url": playlist_url,
        "videos_analyzed": len(results),
        "total_restaurants_found": len(all_restaurants),
        "videos": results,
        "all_restaurants": all_restaurants
    }

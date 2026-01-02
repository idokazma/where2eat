"""
Gemini Video Analyzer
Analyzes YouTube videos directly using Google's Gemini API with video understanding.
Extracts restaurant mentions, transcripts, and food-related content.
"""

import os
import json
import re
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging

try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    try:
        import google.generativeai as genai_old
        GEMINI_AVAILABLE = False  # Old package, not fully supported
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
                {"item_name": "פסטה קרבונרה", "price": "78 ש״ח"}
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
                "google-genai package not installed. "
                "Install with: pip install google-genai"
            )

        self.api_key = api_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError(
                "Gemini API key not found. Set GEMINI_API_KEY or GOOGLE_API_KEY environment variable."
            )

        # Initialize the new genai client
        self.client = genai.Client(api_key=self.api_key)
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

            # Ensure URL is properly formatted
            if not video_url.startswith('http'):
                video_url = f"https://www.youtube.com/watch?v={video_id}"

            # Use Gemini to analyze the video directly with the new API
            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_uri(
                                file_uri=video_url,
                                mime_type="video/*"
                            ),
                            types.Part.from_text(text=self.RESTAURANT_EXTRACTION_PROMPT)
                        ]
                    )
                ]
            )

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

    def analyze_videos_from_list(
        self,
        video_urls: List[str],
        max_videos: int = 10,
        delay_between: float = 2.0
    ) -> List[VideoAnalysisResult]:
        """
        Analyze multiple videos.

        Args:
            video_urls: List of YouTube video URLs
            max_videos: Maximum number of videos to analyze
            delay_between: Delay between API calls in seconds

        Returns:
            List of VideoAnalysisResult objects
        """
        results = []
        for i, url in enumerate(video_urls[:max_videos]):
            self.logger.info(f"Processing video {i+1}/{min(len(video_urls), max_videos)}")
            result = self.analyze_video(url)
            results.append(result)
            if i < len(video_urls) - 1:
                time.sleep(delay_between)  # Rate limiting
        return results

    def get_playlist_videos_via_gemini(self, playlist_url: str) -> List[Dict[str, str]]:
        """
        Get list of videos from a playlist by asking Gemini to analyze the playlist page.

        Args:
            playlist_url: YouTube playlist URL

        Returns:
            List of video info dicts with 'video_id', 'title', 'url'
        """
        try:
            # Extract playlist ID
            playlist_match = re.search(r'list=([a-zA-Z0-9_-]+)', playlist_url)
            if not playlist_match:
                return []

            playlist_id = playlist_match.group(1)
            playlist_page_url = f"https://www.youtube.com/playlist?list={playlist_id}"

            response = self.client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_uri(
                                file_uri=playlist_page_url,
                                mime_type="text/html"
                            ),
                            types.Part.from_text(
                                text="""Analyze this YouTube playlist page and list the first 15 videos in it.
                                Return as a JSON array with format:
                                [
                                    {"video_id": "xxxxxxxxxxx", "title": "Video Title"},
                                    ...
                                ]
                                Return ONLY the JSON array, no other text. Each video_id should be exactly 11 characters."""
                            )
                        ]
                    )
                ]
            )

            result_text = response.text

            # Extract JSON
            json_match = re.search(r'\[.*\]', result_text, re.DOTALL)
            if json_match:
                videos = json.loads(json_match.group(0))
                # Add full URLs
                for v in videos:
                    v['url'] = f"https://www.youtube.com/watch?v={v['video_id']}"
                return videos

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

    # Try to get playlist videos
    print("Fetching playlist videos...")
    videos = analyzer.get_playlist_videos_via_gemini(playlist_url)

    # If that fails, try to extract video ID from the URL and analyze just that video
    if not videos:
        print("Could not fetch playlist. Trying to analyze the video in URL...")
        video_id = analyzer.extract_video_id(playlist_url)
        if video_id:
            videos = [{'video_id': video_id, 'title': 'Unknown', 'url': f"https://www.youtube.com/watch?v={video_id}"}]
        else:
            return {
                "success": False,
                "error": "Could not fetch playlist videos or extract video ID",
                "videos": []
            }

    print(f"Found {len(videos)} videos. Analyzing up to {max_videos}...")

    # Analyze each video
    results = []
    all_restaurants = []

    for i, video in enumerate(videos[:max_videos]):
        video_url = video.get('url', f"https://www.youtube.com/watch?v={video['video_id']}")
        print(f"\n[{i+1}/{min(len(videos), max_videos)}] Analyzing: {video.get('title', video_url)}")

        result = analyzer.analyze_video(video_url)
        results.append({
            "video_id": result.video_id,
            "title": result.title or video.get('title'),
            "success": result.success,
            "restaurants": result.restaurants,
            "restaurant_count": len(result.restaurants),
            "food_trends": result.food_trends,
            "episode_summary": result.episode_summary,
            "error": result.error
        })

        if result.success:
            print(f"    Found {len(result.restaurants)} restaurants")
            for restaurant in result.restaurants:
                restaurant['source_video'] = result.video_id
                restaurant['source_title'] = result.title or video.get('title')
                all_restaurants.append(restaurant)
        else:
            print(f"    Error: {result.error}")

        # Rate limiting
        if i < min(len(videos), max_videos) - 1:
            time.sleep(2)

    return {
        "success": True,
        "playlist_url": playlist_url,
        "videos_analyzed": len(results),
        "total_restaurants_found": len(all_restaurants),
        "videos": results,
        "all_restaurants": all_restaurants
    }

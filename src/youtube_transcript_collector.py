"""
YouTube Transcript Collector
Collects transcripts from YouTube videos for restaurant trend analysis.
"""

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable
)
from youtube_transcript_api import TranscriptList
from typing import List, Dict, Optional
import re
import time
import threading
from datetime import datetime
from queue import Queue

try:
    from config import YOUTUBE_TRANSCRIPT_RATE_LIMIT_SECONDS
except ImportError:
    YOUTUBE_TRANSCRIPT_RATE_LIMIT_SECONDS = 30


class YouTubeTranscriptCollector:
    """Collects and processes YouTube video transcripts with caching and rate limiting."""

    def __init__(self, database=None, rate_limit_seconds: int = None):
        """
        Initialize the transcript collector.

        Args:
            database: Optional Database instance for caching transcripts
            rate_limit_seconds: Minimum seconds between API requests (default: from config.py)
        """
        self.database = database
        self.rate_limit_seconds = rate_limit_seconds if rate_limit_seconds is not None else YOUTUBE_TRANSCRIPT_RATE_LIMIT_SECONDS
        self._last_request_time = 0
        self._request_lock = threading.Lock()
        self._requests_made = 0

    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extract video ID from various YouTube URL formats.

        Args:
            url: YouTube URL or video ID

        Returns:
            Video ID or None if not found
        """
        # Handle None or empty input
        if not url:
            return None

        # If it's already a video ID (11 characters, alphanumeric and dashes/underscores)
        if re.match(r'^[a-zA-Z0-9_-]{11}$', url):
            return url

        # Extract from various URL formats
        patterns = [
            r'(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})',
            r'(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
            r'(?:youtu\.be\/)([a-zA-Z0-9_-]{11})',
            r'(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        return None

    def list_available_transcripts(self, video_url: str) -> Optional[List[Dict]]:
        """
        List all available transcript languages for a video.

        Args:
            video_url: YouTube URL or video ID

        Returns:
            List of available transcript info or None if unavailable
        """
        video_id = self.extract_video_id(video_url)

        if not video_id:
            print(f"Error: Could not extract video ID from: {video_url}")
            return None

        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            available = []

            for transcript in transcript_list:
                available.append({
                    'language': transcript.language,
                    'language_code': transcript.language_code,
                    'is_generated': transcript.is_generated,
                    'is_translatable': transcript.is_translatable
                })

            return available

        except Exception as e:
            print(f"Error listing transcripts for {video_id}: {str(e)}")
            return None

    def get_transcript_auto(self, video_url: str) -> Optional[Dict]:
        """
        Automatically fetch transcript in any available language.
        Tries common languages first, then falls back to any available.

        Args:
            video_url: YouTube URL or video ID

        Returns:
            Dictionary containing transcript data or None
        """
        video_id = self.extract_video_id(video_url)

        if not video_id:
            print(f"Error: Could not extract video ID from: {video_url}")
            return None

        # Try common languages in order of preference
        common_languages = ['en', 'he', 'iw', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar']

        for lang in common_languages:
            result = self.get_transcript(video_url, languages=[lang])
            if result:
                return result

        # If no common language works, try to get any available transcript
        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)
            for transcript in transcript_list:
                try:
                    data = transcript.fetch()
                    full_text = ' '.join([snippet.text for snippet in data.snippets])

                    return {
                        'video_id': video_id,
                        'video_url': f'https://www.youtube.com/watch?v={video_id}',
                        'transcript': full_text,
                        'segments': [{'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration} for snippet in data.snippets],
                        'language': transcript.language_code,
                        'segment_count': len(data.snippets)
                    }
                except Exception:
                    continue

        except Exception as e:
            print(f"Error: Could not fetch any transcript for {video_id}: {str(e)}")

        return None

    def _wait_for_rate_limit(self):
        """Wait if necessary to respect rate limit."""
        with self._request_lock:
            current_time = time.time()
            time_since_last_request = current_time - self._last_request_time

            if time_since_last_request < self.rate_limit_seconds:
                wait_time = self.rate_limit_seconds - time_since_last_request
                print(f"Rate limit: waiting {wait_time:.1f} seconds before next request...")
                time.sleep(wait_time)

            self._last_request_time = time.time()
            self._requests_made += 1

    def get_rate_limit_status(self) -> Dict:
        """Get current rate limiter status."""
        with self._request_lock:
            current_time = time.time()
            time_since_last = current_time - self._last_request_time
            time_until_next = max(0, self.rate_limit_seconds - time_since_last)

            return {
                'requests_made': self._requests_made,
                'time_until_next_available': time_until_next,
                'rate_limit_seconds': self.rate_limit_seconds,
                'last_request_timestamp': self._last_request_time
            }

    def get_transcript(
        self,
        video_url: str,
        languages: List[str] = ['en']
    ) -> Optional[Dict]:
        """
        Fetch transcript for a YouTube video with caching and rate limiting.

        Args:
            video_url: YouTube URL or video ID
            languages: List of preferred language codes (default: ['en'])

        Returns:
            Dictionary containing video_id, transcript text, and metadata
            or None if transcript unavailable
        """
        video_id = self.extract_video_id(video_url)

        if not video_id:
            print(f"Error: Could not extract video ID from: {video_url}")
            return None

        # Check cache first if database is available
        if self.database:
            cached_episode = self.database.get_episode(video_id=video_id)
            if cached_episode and cached_episode.get('transcript'):
                print(f"✓ Using cached transcript for video: {video_id}")
                # Return cached data in the same format
                return {
                    'video_id': video_id,
                    'video_url': f'https://www.youtube.com/watch?v={video_id}',
                    'transcript': cached_episode['transcript'],
                    'segments': [],  # Segments not stored in cache for now
                    'language': cached_episode.get('language', 'unknown'),
                    'segment_count': len(cached_episode['transcript'].split()),
                    'cached': True
                }

        # Apply rate limiting before API call
        self._wait_for_rate_limit()

        try:
            # Fetch transcript from API
            transcript_list = YouTubeTranscriptApi.get_transcript(
                video_id,
                languages=languages
            )

            # Combine all transcript segments into full text
            full_text = ' '.join([segment['text'] for segment in transcript_list])
            segments = [{'text': segment['text'], 'start': segment['start'], 'duration': segment['duration']} for segment in transcript_list]

            result = {
                'video_id': video_id,
                'video_url': f'https://www.youtube.com/watch?v={video_id}',
                'transcript': full_text,
                'segments': segments,
                'language': languages[0] if languages else 'en',
                'segment_count': len(transcript_list),
                'cached': False
            }

            # Cache the result if database is available
            if self.database:
                try:
                    self.database.create_episode(
                        video_id=video_id,
                        video_url=result['video_url'],
                        transcript=full_text,
                        language=result['language'],
                        analysis_date=datetime.now().isoformat()
                    )
                    print(f"✓ Cached transcript for video: {video_id}")
                except Exception as cache_error:
                    print(f"Warning: Failed to cache transcript: {cache_error}")

            return result

        except TranscriptsDisabled:
            print(f"Error: Transcripts are disabled for video: {video_id}")
            return None
        except NoTranscriptFound:
            print(f"Error: No transcript found for video: {video_id} in languages: {languages}")
            return None
        except VideoUnavailable:
            print(f"Error: Video unavailable: {video_id}")
            return None
        except Exception as e:
            print(f"Error fetching transcript for {video_id}: {str(e)}")
            return None

    def get_transcripts_batch(
        self,
        video_urls: List[str],
        languages: List[str] = ['en']
    ) -> List[Dict]:
        """
        Fetch transcripts for multiple videos.

        Args:
            video_urls: List of YouTube URLs or video IDs
            languages: List of preferred language codes

        Returns:
            List of transcript dictionaries (skips failed videos)
        """
        results = []

        for url in video_urls:
            result = self.get_transcript(url, languages)
            if result:
                results.append(result)

        return results

    def search_transcript(self, video_url: str, keyword: str) -> List[Dict]:
        """
        Search for a keyword in a video's transcript.

        Args:
            video_url: YouTube URL or video ID
            keyword: Keyword to search for

        Returns:
            List of segments containing the keyword with timestamps
        """
        result = self.get_transcript(video_url)

        if not result:
            return []

        keyword_lower = keyword.lower()
        matching_segments = [
            segment for segment in result['segments']
            if keyword_lower in segment['text'].lower()
        ]

        return matching_segments

    def health_check(self) -> Dict:
        """
        Perform a health check on the transcript collector.

        Returns:
            Dictionary with health status information
        """
        health_info = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'rate_limiter': self.get_rate_limit_status(),
            'cache': {
                'enabled': self.database is not None,
                'type': 'database' if self.database else None
            },
            'api_connectivity': False
        }

        # Test API connectivity with a known video (using YouTube's test video)
        test_video_id = 'jNQXAC9IVRw'  # "Me at the zoo" - first YouTube video
        try:
            # Try to list available transcripts without fetching full content
            YouTubeTranscriptApi.list_transcripts(test_video_id)
            health_info['api_connectivity'] = True
        except Exception as e:
            health_info['status'] = 'unhealthy'
            health_info['api_connectivity'] = False
            health_info['error'] = str(e)

        return health_info

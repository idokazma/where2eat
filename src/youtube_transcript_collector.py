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


class YouTubeTranscriptCollector:
    """Collects and processes YouTube video transcripts."""

    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extract video ID from various YouTube URL formats.

        Args:
            url: YouTube URL or video ID

        Returns:
            Video ID or None if not found
        """
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

    def get_transcript(
        self,
        video_url: str,
        languages: List[str] = ['en']
    ) -> Optional[Dict]:
        """
        Fetch transcript for a YouTube video.

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

        try:
            # Fetch transcript
            api = YouTubeTranscriptApi()
            transcript_data = api.fetch(
                video_id,
                languages=languages
            )

            # Combine all transcript segments into full text
            full_text = ' '.join([snippet.text for snippet in transcript_data.snippets])

            return {
                'video_id': video_id,
                'video_url': f'https://www.youtube.com/watch?v={video_id}',
                'transcript': full_text,
                'segments': [{'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration} for snippet in transcript_data.snippets],
                'language': languages[0] if languages else 'en',
                'segment_count': len(transcript_data.snippets)
            }

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

"""
YouTube Transcript Collector
Collects transcripts from YouTube videos for restaurant trend analysis.

Supports multiple fetching strategies:
1. youtube-transcript-api (primary, fast)
2. yt-dlp subtitle extraction (fallback for auto-generated captions)
3. YouTube translation API (fallback when target language is unavailable)
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
import json
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
        Uses a single list() call to discover available transcripts, then fetches the best one.

        Args:
            video_url: YouTube URL or video ID

        Returns:
            Dictionary containing transcript data or None
        """
        video_id = self.extract_video_id(video_url)

        if not video_id:
            print(f"Error: Could not extract video ID from: {video_url}")
            return None

        # Check cache first
        if self.database:
            cached_episode = self.database.get_episode(video_id=video_id)
            if cached_episode and cached_episode.get('transcript'):
                print(f"✓ Using cached transcript for video: {video_id}")
                return {
                    'video_id': video_id,
                    'video_url': f'https://www.youtube.com/watch?v={video_id}',
                    'transcript': cached_episode['transcript'],
                    'segments': [],
                    'language': cached_episode.get('language', 'unknown'),
                    'segment_count': len(cached_episode['transcript'].split()),
                    'cached': True
                }

        self._wait_for_rate_limit()

        # Preferred languages in priority order
        preferred_languages = ['iw', 'he', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar']

        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)

            # Collect available transcripts
            available = list(transcript_list)
            available_codes = [t.language_code for t in available]
            print(f"[list] Available transcripts for {video_id}: {available_codes}")

            # Pick the best transcript by preference order
            chosen = None
            for lang in preferred_languages:
                for t in available:
                    if t.language_code == lang:
                        chosen = t
                        break
                if chosen:
                    break

            # If no preferred language matched, take the first available
            if not chosen and available:
                chosen = available[0]

            if chosen:
                data = chosen.fetch()
                full_text = ' '.join([snippet.text for snippet in data.snippets])
                source = 'youtube-transcript-api'
                if chosen.is_generated:
                    source = 'youtube-transcript-api-generated'

                result = {
                    'video_id': video_id,
                    'video_url': f'https://www.youtube.com/watch?v={video_id}',
                    'transcript': full_text,
                    'segments': [{'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration} for snippet in data.snippets],
                    'language': chosen.language_code,
                    'segment_count': len(data.snippets),
                    'cached': False,
                    'source': source
                }

                if self.database:
                    try:
                        self.database.create_episode(
                            video_id=video_id,
                            video_url=result['video_url'],
                            transcript=full_text,
                            language=result['language'],
                            analysis_date=datetime.now().isoformat()
                        )
                    except Exception:
                        pass

                return result

        except (TranscriptsDisabled, VideoUnavailable) as e:
            print(f"Error: {type(e).__name__} for video: {video_id}")
            return None
        except Exception as e:
            print(f"[list] Failed for {video_id}: {str(e)}, trying yt-dlp...")

        # Fallback to yt-dlp if list() itself failed
        result = self._get_transcript_via_ytdlp(video_id, preferred_languages[:3])
        if result and self.database:
            try:
                self.database.create_episode(
                    video_id=video_id,
                    video_url=result['video_url'],
                    transcript=result['transcript'],
                    language=result['language'],
                    analysis_date=datetime.now().isoformat()
                )
            except Exception:
                pass

        if result is None:
            print(f"Error: Could not fetch any transcript for {video_id}")

        return result

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

    def _get_transcript_via_ytdlp(self, video_id: str, languages: List[str]) -> Optional[Dict]:
        """
        Fallback: fetch transcript using yt-dlp when youtube-transcript-api fails.

        yt-dlp uses a separate extraction mechanism and can often retrieve
        auto-generated captions that youtube-transcript-api misses.

        Args:
            video_id: YouTube video ID
            languages: List of preferred language codes

        Returns:
            Dictionary containing transcript data, or None
        """
        try:
            import yt_dlp
        except ImportError:
            print(f"[yt-dlp] Not installed, skipping fallback for {video_id}")
            return None

        video_url = f'https://www.youtube.com/watch?v={video_id}'

        ydl_opts = {
            'writeautomaticsub': True,
            'writesubtitles': True,
            'subtitleslangs': languages,
            'subtitlesformat': 'json3',
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)

                auto_captions = info.get('automatic_captions', {})
                manual_subs = info.get('subtitles', {})

                # Try each language, preferring manual subs over auto-generated
                for lang in languages:
                    for source_name, source in [('manual', manual_subs), ('auto', auto_captions)]:
                        if lang not in source:
                            continue

                        # Find json3 format for structured data
                        formats = source[lang]
                        json3_url = None
                        for fmt in formats:
                            if fmt.get('ext') == 'json3':
                                json3_url = fmt.get('url')
                                break

                        if not json3_url:
                            continue

                        # Fetch and parse the subtitle content
                        import urllib.request
                        with urllib.request.urlopen(json3_url, timeout=15) as resp:
                            data = json.loads(resp.read())

                        events = data.get('events', [])
                        segments = []
                        texts = []

                        for event in events:
                            segs = event.get('segs', [])
                            text = ''.join(seg.get('utf8', '') for seg in segs).strip()
                            if text and text != '\n':
                                start = event.get('tStartMs', 0) / 1000.0
                                duration = event.get('dDurationMs', 0) / 1000.0
                                segments.append({
                                    'text': text,
                                    'start': start,
                                    'duration': duration
                                })
                                texts.append(text)

                        if texts:
                            full_text = ' '.join(texts)
                            print(f"[yt-dlp] Got {source_name} {lang} transcript for {video_id} ({len(segments)} segments)")
                            return {
                                'video_id': video_id,
                                'video_url': video_url,
                                'transcript': full_text,
                                'segments': segments,
                                'language': lang,
                                'segment_count': len(segments),
                                'cached': False,
                                'source': f'yt-dlp-{source_name}'
                            }

        except Exception as e:
            print(f"[yt-dlp] Failed for {video_id}: {str(e)}")

        return None

    def _get_transcript_via_translation(self, video_id: str, target_languages: List[str]) -> Optional[Dict]:
        """
        Fallback: use YouTube's built-in translation to get transcript in target language.

        If a video has captions in any language, YouTube can auto-translate them.
        This is useful when e.g. only English captions exist but we need Hebrew.

        Args:
            video_id: YouTube video ID
            target_languages: List of preferred target language codes

        Returns:
            Dictionary containing translated transcript data, or None
        """
        try:
            api = YouTubeTranscriptApi()
            transcript_list = api.list(video_id)

            # Find any available transcript
            source_transcript = None
            for transcript in transcript_list:
                if transcript.is_translatable:
                    source_transcript = transcript
                    break

            if not source_transcript:
                return None

            # Try translating to each target language
            for lang in target_languages:
                try:
                    translated = source_transcript.translate(lang)
                    data = translated.fetch()

                    full_text = ' '.join([snippet.text for snippet in data.snippets])
                    segments = [
                        {'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration}
                        for snippet in data.snippets
                    ]

                    print(f"[translate] Got {source_transcript.language_code}->{lang} transcript for {video_id} ({len(segments)} segments)")
                    return {
                        'video_id': video_id,
                        'video_url': f'https://www.youtube.com/watch?v={video_id}',
                        'transcript': full_text,
                        'segments': segments,
                        'language': lang,
                        'segment_count': len(data.snippets),
                        'cached': False,
                        'source': f'translated-from-{source_transcript.language_code}'
                    }
                except Exception:
                    continue

        except Exception as e:
            print(f"[translate] Failed for {video_id}: {str(e)}")

        return None

    def get_transcript(
        self,
        video_url: str,
        languages: List[str] = ['iw', 'he', 'en']
    ) -> Optional[Dict]:
        """
        Fetch transcript for a YouTube video with caching, rate limiting, and smart fallback.

        Strategy (list-first, no trial-and-error):
        1. Database cache (instant, no API call)
        2. list() to discover available transcripts (single API call)
        3. find_transcript() to pick the best language match (no API call)
        4. fetch() only the chosen transcript (single API call)
        5. If no match: translate from any available transcript
        6. If list() itself fails: yt-dlp fallback

        Args:
            video_url: YouTube URL or video ID
            languages: List of preferred language codes (default: ['iw', 'he', 'en'])

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
                return {
                    'video_id': video_id,
                    'video_url': f'https://www.youtube.com/watch?v={video_id}',
                    'transcript': cached_episode['transcript'],
                    'segments': [],
                    'language': cached_episode.get('language', 'unknown'),
                    'segment_count': len(cached_episode['transcript'].split()),
                    'cached': True
                }

        # Apply rate limiting before API call
        self._wait_for_rate_limit()

        result = None

        try:
            api = YouTubeTranscriptApi()

            # Step 1: List all available transcripts (single API call)
            transcript_list = api.list(video_id)
            available = list(transcript_list)
            available_codes = [t.language_code for t in available]

            if available_codes:
                print(f"[list] Available transcripts for {video_id}: {available_codes}")

            # Step 2: Find the best match from requested languages
            chosen = None
            for lang in languages:
                for t in available:
                    if t.language_code == lang:
                        chosen = t
                        break
                if chosen:
                    break

            # Step 3: Fetch the chosen transcript
            if chosen:
                data = chosen.fetch()
                full_text = ' '.join([snippet.text for snippet in data.snippets])
                segments = [{'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration} for snippet in data.snippets]

                source = 'youtube-transcript-api'
                if chosen.is_generated:
                    source = 'youtube-transcript-api-generated'

                result = {
                    'video_id': video_id,
                    'video_url': f'https://www.youtube.com/watch?v={video_id}',
                    'transcript': full_text,
                    'segments': segments,
                    'language': chosen.language_code,
                    'segment_count': len(data.snippets),
                    'cached': False,
                    'source': source
                }
            else:
                # Step 4: No match — try translation from any available transcript
                print(f"No transcript for {video_id} in {languages} (available: {available_codes}), trying translation...")
                for t in available:
                    if t.is_translatable:
                        for lang in languages:
                            try:
                                translated = t.translate(lang)
                                data = translated.fetch()
                                full_text = ' '.join([snippet.text for snippet in data.snippets])
                                segments = [{'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration} for snippet in data.snippets]

                                print(f"[translate] Got {t.language_code}->{lang} transcript for {video_id}")
                                result = {
                                    'video_id': video_id,
                                    'video_url': f'https://www.youtube.com/watch?v={video_id}',
                                    'transcript': full_text,
                                    'segments': segments,
                                    'language': lang,
                                    'segment_count': len(data.snippets),
                                    'cached': False,
                                    'source': f'translated-from-{t.language_code}'
                                }
                                break
                            except Exception:
                                continue
                    if result:
                        break

                if result is None and available:
                    # Last resort: fetch whatever is available even if not in preferred languages
                    first = available[0]
                    try:
                        data = first.fetch()
                        full_text = ' '.join([snippet.text for snippet in data.snippets])
                        segments = [{'text': snippet.text, 'start': snippet.start, 'duration': snippet.duration} for snippet in data.snippets]
                        result = {
                            'video_id': video_id,
                            'video_url': f'https://www.youtube.com/watch?v={video_id}',
                            'transcript': full_text,
                            'segments': segments,
                            'language': first.language_code,
                            'segment_count': len(data.snippets),
                            'cached': False,
                            'source': 'youtube-transcript-api'
                        }
                    except Exception:
                        pass

        except TranscriptsDisabled:
            print(f"Error: Transcripts are disabled for video: {video_id}")
            return None
        except VideoUnavailable:
            print(f"Error: Video unavailable: {video_id}")
            return None
        except Exception as e:
            # list() itself failed (e.g. network error, blocked IP)
            print(f"[list] Failed for {video_id}: {str(e)}, trying yt-dlp...")
            result = self._get_transcript_via_ytdlp(video_id, languages)

        if result is None:
            # yt-dlp as final fallback if nothing worked above
            if not isinstance(result, dict):
                result = self._get_transcript_via_ytdlp(video_id, languages)

        if result is None:
            print(f"Error: All transcript methods failed for video: {video_id}")
            return None

        # Cache the result if database is available
        if self.database:
            try:
                self.database.create_episode(
                    video_id=video_id,
                    video_url=result['video_url'],
                    transcript=result['transcript'],
                    language=result['language'],
                    analysis_date=datetime.now().isoformat()
                )
                print(f"✓ Cached transcript for video: {video_id}")
            except Exception as cache_error:
                print(f"Warning: Failed to cache transcript: {cache_error}")

        return result

    def get_transcripts_batch(
        self,
        video_urls: List[str],
        languages: List[str] = ['iw', 'he', 'en']
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
            # Try to list available transcripts without fetching full content (v1.x API)
            api = YouTubeTranscriptApi()
            api.list(test_video_id)
            health_info['api_connectivity'] = True
        except Exception as e:
            health_info['status'] = 'unhealthy'
            health_info['api_connectivity'] = False
            health_info['error'] = str(e)

        return health_info

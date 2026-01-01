"""
YouTube Channel Collector
Fetches all videos from YouTube channels using YouTube Data API v3 for restaurant analysis.
"""

import re
import os
import time
from typing import List, Dict, Optional, Union
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import logging


class ChannelNotFoundError(Exception):
    """Raised when a YouTube channel is not found."""
    pass


class APIQuotaExceededError(Exception):
    """Raised when YouTube API quota is exceeded."""
    pass


class YouTubeChannelCollector:
    """Collects videos from YouTube channels using YouTube Data API v3."""

    def __init__(self, api_key: Optional[str] = None, quota_limit: int = 10000):
        """
        Initialize YouTube Channel Collector.

        Args:
            api_key: YouTube Data API v3 key. If None, reads from YOUTUBE_DATA_API_KEY env var
            quota_limit: Daily API quota limit (default: 10000)

        Raises:
            ValueError: If API key is not provided or found in environment
        """
        self.api_key = api_key or os.getenv('YOUTUBE_DATA_API_KEY')
        if not self.api_key:
            raise ValueError("YouTube Data API key is required. Set YOUTUBE_DATA_API_KEY environment variable or provide api_key parameter.")
        
        self.quota_limit = quota_limit
        self.requests_made = 0
        self.logger = logging.getLogger(__name__)

    def extract_channel_id(self, url: str) -> Optional[str]:
        """
        Extract channel ID from various YouTube URL formats.

        Args:
            url: YouTube URL or channel ID

        Returns:
            Channel ID or None if not found

        Supported formats:
        - https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxxx
        - https://www.youtube.com/c/channelname
        - https://www.youtube.com/user/username
        - https://www.youtube.com/@channelname
        - UCxxxxxxxxxxxxxxxxxxxxxxx (direct channel ID)
        """
        if not url or not isinstance(url, str):
            return None

        # If it's already a channel ID (starts with UC and is variable length for testing)
        if re.match(r'^UC[a-zA-Z0-9_-]+$', url):
            return url

        # Extract from various URL formats
        patterns = [
            r'(?:youtube\.com\/channel\/)([UC][a-zA-Z0-9_-]+)',
            r'(?:m\.youtube\.com\/channel\/)([UC][a-zA-Z0-9_-]+)',
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        # Handle c/, user/, and @ URLs - these need API resolution
        if '/c/' in url or '/user/' in url or '/@' in url:
            handle = self._extract_handle_from_url(url)
            if handle:
                try:
                    return self._resolve_channel_handle(handle)
                except Exception as e:
                    self.logger.error(f"Failed to resolve channel handle '{handle}': {str(e)}")
                    return None

        return None

    def _extract_handle_from_url(self, url: str) -> Optional[str]:
        """Extract channel handle from c/, user/, or @ URLs."""
        patterns = [
            r'youtube\.com\/c\/([^/?]+)',
            r'youtube\.com\/user\/([^/?]+)',
            r'youtube\.com\/@([^/?]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                handle = match.group(1)
                if url.startswith('/@') or '/@' in url:
                    return f"@{handle}"
                return handle
        
        return None

    def _resolve_channel_handle(self, handle: str) -> str:
        """
        Resolve channel handle (c/, user/, @) to channel ID using YouTube API.

        Args:
            handle: Channel handle to resolve

        Returns:
            Channel ID

        Raises:
            ChannelNotFoundError: If channel is not found
        """
        try:
            youtube = build('youtube', 'v3', developerKey=self.api_key)
            self._check_quota_limit(1)

            # For @ handles, use the channels.list with forHandle parameter
            if handle.startswith('@'):
                request = youtube.channels().list(
                    part='id',
                    forHandle=handle
                )
            else:
                # For c/ and user/ handles, use forUsername parameter
                request = youtube.channels().list(
                    part='id',
                    forUsername=handle
                )

            response = request.execute()

            if not response.get('items'):
                raise ChannelNotFoundError(f"Channel not found for handle: {handle}")

            return response['items'][0]['id']

        except HttpError as e:
            if e.resp.status == 403:
                raise APIQuotaExceededError("YouTube API quota exceeded")
            raise ChannelNotFoundError(f"Error resolving channel handle: {str(e)}")

    def get_channel_info(self, channel_id: str) -> Dict:
        """
        Get detailed information about a YouTube channel.

        Args:
            channel_id: YouTube channel ID

        Returns:
            Dictionary containing channel information

        Raises:
            ChannelNotFoundError: If channel is not found
            APIQuotaExceededError: If API quota is exceeded
        """
        try:
            youtube = build('youtube', 'v3', developerKey=self.api_key)
            self._check_quota_limit(1)

            request = youtube.channels().list(
                part='snippet,statistics,contentDetails',
                id=channel_id
            )

            response = request.execute()

            if not response.get('items'):
                raise ChannelNotFoundError(f"Channel not found: {channel_id}")

            channel_data = response['items'][0]
            snippet = channel_data['snippet']
            statistics = channel_data['statistics']

            return {
                'channel_id': channel_id,
                'title': snippet['title'],
                'description': snippet['description'],
                'published_at': snippet['publishedAt'],
                'thumbnail_url': snippet.get('thumbnails', {}).get('default', {}).get('url'),
                'video_count': int(statistics.get('videoCount', 0)),
                'subscriber_count': int(statistics.get('subscriberCount', 0)),
                'view_count': int(statistics.get('viewCount', 0)),
                'uploads_playlist_id': channel_data.get('contentDetails', {}).get('relatedPlaylists', {}).get('uploads')
            }

        except HttpError as e:
            if e.resp.status == 403:
                raise APIQuotaExceededError("YouTube API quota exceeded")
            raise ChannelNotFoundError(f"Error getting channel info: {str(e)}")

    def get_channel_videos(
        self,
        channel_id: str,
        max_results: int = 50,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_views: Optional[int] = None,
        min_duration_seconds: Optional[int] = None
    ) -> List[Dict]:
        """
        Get all videos from a YouTube channel with optional filtering.

        Args:
            channel_id: YouTube channel ID
            max_results: Maximum number of videos to return (pagination handled automatically)
            date_from: Minimum publish date filter
            date_to: Maximum publish date filter
            min_views: Minimum view count filter
            min_duration_seconds: Minimum duration filter

        Returns:
            List of video dictionaries with metadata

        Raises:
            ChannelNotFoundError: If channel is not found
            APIQuotaExceededError: If API quota is exceeded
        """
        try:
            # First get channel info to find uploads playlist
            channel_info = self.get_channel_info(channel_id)
            uploads_playlist_id = channel_info.get('uploads_playlist_id')

            if not uploads_playlist_id:
                # Generate uploads playlist ID from channel ID
                uploads_playlist_id = 'UU' + channel_id[2:]

            # Get all videos from uploads playlist
            youtube = build('youtube', 'v3', developerKey=self.api_key)
            videos = []
            next_page_token = None
            
            while len(videos) < max_results:
                self._check_quota_limit(1)

                request = youtube.playlistItems().list(
                    part='snippet',
                    playlistId=uploads_playlist_id,
                    maxResults=min(50, max_results - len(videos)),
                    pageToken=next_page_token
                )

                response = request.execute()

                for item in response.get('items', []):
                    video_data = {
                        'video_id': item['snippet']['resourceId']['videoId'],
                        'title': item['snippet']['title'],
                        'published_at': item['snippet']['publishedAt'],
                        'thumbnail_url': item['snippet'].get('thumbnails', {}).get('default', {}).get('url')
                    }
                    videos.append(video_data)

                next_page_token = response.get('nextPageToken')
                if not next_page_token:
                    break

            # Get additional video details if filters are needed
            if min_views or min_duration_seconds:
                videos = self._enrich_video_details(videos)

            # Apply filters
            if date_from or date_to:
                videos = self._filter_videos_by_date(videos, date_from, date_to)

            if min_views:
                videos = self._filter_videos_by_views(videos, min_views)

            if min_duration_seconds:
                videos = self._filter_videos_by_duration(videos, min_duration_seconds)

            return videos[:max_results]

        except HttpError as e:
            if e.resp.status == 403:
                raise APIQuotaExceededError("YouTube API quota exceeded")
            raise ChannelNotFoundError(f"Error getting channel videos: {str(e)}")

    def _enrich_video_details(self, videos: List[Dict]) -> List[Dict]:
        """
        Enrich video data with statistics and content details.

        Args:
            videos: List of basic video dictionaries

        Returns:
            List of enriched video dictionaries
        """
        if not videos:
            return videos

        youtube = build('youtube', 'v3', developerKey=self.api_key)
        enriched_videos = []

        # Process videos in batches of 50 (API limit)
        for i in range(0, len(videos), 50):
            batch = videos[i:i + 50]
            video_ids = [video['video_id'] for video in batch]

            self._check_quota_limit(1)

            request = youtube.videos().list(
                part='statistics,contentDetails',
                id=','.join(video_ids)
            )

            response = request.execute()

            # Create lookup dict for efficiency
            details_lookup = {item['id']: item for item in response.get('items', [])}

            for video in batch:
                video_id = video['video_id']
                details = details_lookup.get(video_id, {})

                enriched_video = video.copy()
                
                # Add statistics
                statistics = details.get('statistics', {})
                enriched_video['view_count'] = int(statistics.get('viewCount', 0))
                enriched_video['like_count'] = int(statistics.get('likeCount', 0))
                enriched_video['comment_count'] = int(statistics.get('commentCount', 0))

                # Add duration
                content_details = details.get('contentDetails', {})
                duration_iso = content_details.get('duration', '')
                enriched_video['duration_seconds'] = self._parse_duration_iso8601(duration_iso)

                enriched_videos.append(enriched_video)

        return enriched_videos

    def _filter_videos_by_date(
        self, 
        videos: List[Dict], 
        date_from: Optional[datetime] = None, 
        date_to: Optional[datetime] = None
    ) -> List[Dict]:
        """Filter videos by publish date range."""
        if not date_from and not date_to:
            return videos

        filtered = []
        for video in videos:
            published_at_str = video['published_at']
            if published_at_str.endswith('Z'):
                published_at = datetime.fromisoformat(published_at_str.replace('Z', '+00:00'))
            else:
                published_at = datetime.fromisoformat(published_at_str)
            
            # Make date_from and date_to timezone-aware if they aren't already
            if date_from and date_from.tzinfo is None:
                date_from = date_from.replace(tzinfo=published_at.tzinfo)
            if date_to and date_to.tzinfo is None:
                date_to = date_to.replace(tzinfo=published_at.tzinfo)
            
            if date_from and published_at < date_from:
                continue
            if date_to and published_at > date_to:
                continue
                
            filtered.append(video)

        return filtered

    def _filter_videos_by_views(self, videos: List[Dict], min_views: int) -> List[Dict]:
        """Filter videos by minimum view count."""
        return [video for video in videos if video.get('view_count', 0) >= min_views]

    def _filter_videos_by_duration(self, videos: List[Dict], min_duration_seconds: int) -> List[Dict]:
        """Filter videos by minimum duration."""
        return [video for video in videos if video.get('duration_seconds', 0) >= min_duration_seconds]

    def _parse_duration_iso8601(self, iso_duration: str) -> int:
        """
        Parse ISO 8601 duration format (PT4M13S) to total seconds.

        Args:
            iso_duration: Duration in ISO 8601 format

        Returns:
            Duration in seconds
        """
        if not iso_duration or not iso_duration.startswith('PT'):
            return 0

        duration_part = iso_duration[2:]  # Remove 'PT'

        hours_match = re.search(r'(\d+)H', duration_part)
        minutes_match = re.search(r'(\d+)M', duration_part)
        seconds_match = re.search(r'(\d+)S', duration_part)

        hours = int(hours_match.group(1)) if hours_match else 0
        minutes = int(minutes_match.group(1)) if minutes_match else 0
        seconds = int(seconds_match.group(1)) if seconds_match else 0

        return hours * 3600 + minutes * 60 + seconds

    def _check_quota_limit(self, cost: int):
        """
        Check if API request would exceed quota limit.

        Args:
            cost: API cost of the request

        Raises:
            APIQuotaExceededError: If quota would be exceeded
        """
        if self.requests_made + cost > self.quota_limit:
            raise APIQuotaExceededError(
                f"YouTube API quota exceeded. Used: {self.requests_made}, Limit: {self.quota_limit}, Request cost: {cost}"
            )
        
        self.requests_made += cost

    def get_channel_video_count(self, channel_id: str) -> int:
        """
        Get total video count for a channel (quick check).

        Args:
            channel_id: YouTube channel ID

        Returns:
            Number of videos in the channel
        """
        try:
            channel_info = self.get_channel_info(channel_id)
            return channel_info['video_count']
        except (ChannelNotFoundError, APIQuotaExceededError):
            return 0

    def reset_quota_counter(self):
        """Reset the quota counter (useful for testing or daily reset)."""
        self.requests_made = 0
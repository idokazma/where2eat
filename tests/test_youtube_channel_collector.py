"""
Tests for YouTubeChannelCollector - YouTube Data API integration for channel processing.
Following TDD principles - tests written first before implementation.
"""

import pytest
import unittest.mock as mock
from datetime import datetime, timedelta
from src.youtube_channel_collector import YouTubeChannelCollector, ChannelNotFoundError, APIQuotaExceededError


class TestYouTubeChannelCollector:
    """Test suite for YouTube Channel Collector following TDD methodology."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        self.api_key = "test_api_key_123"
        self.collector = YouTubeChannelCollector(api_key=self.api_key)

    def test_init_with_api_key(self):
        """Test initialization with API key."""
        collector = YouTubeChannelCollector(api_key="test_key")
        assert collector.api_key == "test_key"
        assert collector.quota_limit == 10000  # Default quota
        assert collector.requests_made == 0

    def test_init_without_api_key_raises_error(self):
        """Test initialization without API key raises ValueError."""
        with pytest.raises(ValueError, match="YouTube Data API key is required"):
            YouTubeChannelCollector()

    def test_extract_channel_id_from_channel_url(self):
        """Test extracting channel ID from youtube.com/channel/ URL."""
        url = "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxxx"
        channel_id = self.collector.extract_channel_id(url)
        assert channel_id == "UCxxxxxxxxxxxxxxxxxxxxxxx"

    def test_extract_channel_id_from_c_url(self):
        """Test extracting channel ID from youtube.com/c/ URL."""
        url = "https://www.youtube.com/c/channelname"
        # For c/ URLs, we need to resolve via API call
        with mock.patch.object(self.collector, '_resolve_channel_handle') as mock_resolve:
            mock_resolve.return_value = "UCxxxxxxxxxxxxxxxxxxxxxxx"
            channel_id = self.collector.extract_channel_id(url)
            assert channel_id == "UCxxxxxxxxxxxxxxxxxxxxxxx"
            mock_resolve.assert_called_once_with("channelname")

    def test_extract_channel_id_from_user_url(self):
        """Test extracting channel ID from youtube.com/user/ URL."""
        url = "https://www.youtube.com/user/username"
        with mock.patch.object(self.collector, '_resolve_channel_handle') as mock_resolve:
            mock_resolve.return_value = "UCxxxxxxxxxxxxxxxxxxxxxxx"
            channel_id = self.collector.extract_channel_id(url)
            assert channel_id == "UCxxxxxxxxxxxxxxxxxxxxxxx"
            mock_resolve.assert_called_once_with("username")

    def test_extract_channel_id_from_handle_url(self):
        """Test extracting channel ID from youtube.com/@handle URL."""
        url = "https://www.youtube.com/@channelhandle"
        with mock.patch.object(self.collector, '_resolve_channel_handle') as mock_resolve:
            mock_resolve.return_value = "UCxxxxxxxxxxxxxxxxxxxxxxx"
            channel_id = self.collector.extract_channel_id(url)
            assert channel_id == "UCxxxxxxxxxxxxxxxxxxxxxxx"
            mock_resolve.assert_called_once_with("@channelhandle")

    def test_extract_channel_id_from_direct_id(self):
        """Test extracting channel ID when input is already a channel ID."""
        channel_id = "UCxxxxxxxxxxxxxxxxxxxxxxx"
        result = self.collector.extract_channel_id(channel_id)
        assert result == channel_id

    def test_extract_channel_id_invalid_url_returns_none(self):
        """Test extracting channel ID from invalid URL returns None."""
        invalid_urls = [
            "https://www.google.com",
            "not_a_url",
            "",
            None
        ]
        for url in invalid_urls:
            result = self.collector.extract_channel_id(url)
            assert result is None

    @mock.patch('src.youtube_channel_collector.build')
    def test_get_channel_info_success(self, mock_build):
        """Test successful channel information retrieval."""
        # Mock YouTube API response
        mock_youtube = mock.MagicMock()
        mock_build.return_value = mock_youtube
        
        mock_response = {
            'items': [{
                'id': 'UCxxxxxxxxxxxxxxxxxxxxxxx',
                'snippet': {
                    'title': 'Test Channel',
                    'description': 'Test channel description',
                    'publishedAt': '2020-01-01T00:00:00Z',
                    'thumbnails': {
                        'default': {'url': 'http://example.com/thumb.jpg'}
                    }
                },
                'statistics': {
                    'subscriberCount': '100000',
                    'videoCount': '500',
                    'viewCount': '10000000'
                }
            }]
        }
        
        mock_youtube.channels().list().execute.return_value = mock_response
        
        channel_info = self.collector.get_channel_info("UCxxxxxxxxxxxxxxxxxxxxxxx")
        
        assert channel_info['channel_id'] == 'UCxxxxxxxxxxxxxxxxxxxxxxx'
        assert channel_info['title'] == 'Test Channel'
        assert channel_info['description'] == 'Test channel description'
        assert channel_info['video_count'] == 500
        assert channel_info['subscriber_count'] == 100000

    @mock.patch('src.youtube_channel_collector.build')
    def test_get_channel_info_not_found(self, mock_build):
        """Test channel not found raises appropriate error."""
        mock_youtube = mock.MagicMock()
        mock_build.return_value = mock_youtube
        
        mock_response = {'items': []}
        mock_youtube.channels().list().execute.return_value = mock_response
        
        with pytest.raises(ChannelNotFoundError, match="Channel not found"):
            self.collector.get_channel_info("UCinvalid")

    @mock.patch('src.youtube_channel_collector.build')
    def test_get_channel_videos_success(self, mock_build):
        """Test successful channel videos retrieval."""
        mock_youtube = mock.MagicMock()
        mock_build.return_value = mock_youtube
        
        # Mock channel info response
        mock_channel_response = {
            'items': [{
                'id': 'UCxxxxxxxxxxxxxxxxxxxxxxx',
                'snippet': {
                    'title': 'Test Channel',
                    'description': 'Test channel description',
                    'publishedAt': '2020-01-01T00:00:00Z',
                    'thumbnails': {
                        'default': {'url': 'http://example.com/thumb.jpg'}
                    }
                },
                'statistics': {
                    'subscriberCount': '100000',
                    'videoCount': '500',
                    'viewCount': '10000000'
                },
                'contentDetails': {
                    'relatedPlaylists': {
                        'uploads': 'UUxxxxxxxxxxxxxxxxxxxxxxx'
                    }
                }
            }]
        }
        
        # Mock playlist items response
        mock_videos_response = {
            'items': [
                {
                    'snippet': {
                        'resourceId': {'videoId': 'video123'},
                        'title': 'Test Video 1',
                        'publishedAt': '2024-01-01T00:00:00Z'
                    }
                },
                {
                    'snippet': {
                        'resourceId': {'videoId': 'video456'},
                        'title': 'Test Video 2',
                        'publishedAt': '2024-01-02T00:00:00Z'
                    }
                }
            ],
            'nextPageToken': None
        }
        
        mock_youtube.channels().list().execute.return_value = mock_channel_response
        mock_youtube.playlistItems().list().execute.return_value = mock_videos_response
        
        videos = self.collector.get_channel_videos("UCxxxxxxxxxxxxxxxxxxxxxxx")
        
        assert len(videos) == 2
        assert videos[0]['video_id'] == 'video123'
        assert videos[0]['title'] == 'Test Video 1'
        assert videos[1]['video_id'] == 'video456'
        assert videos[1]['title'] == 'Test Video 2'

    @mock.patch('src.youtube_channel_collector.build')
    def test_get_channel_videos_with_filters(self, mock_build):
        """Test channel videos retrieval with date and view filters."""
        mock_youtube = mock.MagicMock()
        mock_build.return_value = mock_youtube
        
        # Mock channel info response similar to above but with additional video details
        mock_channel_response = {
            'items': [{
                'id': 'UCxxxxxxxxxxxxxxxxxxxxxxx',
                'snippet': {
                    'title': 'Test Channel',
                    'description': 'Test channel description',
                    'publishedAt': '2020-01-01T00:00:00Z',
                    'thumbnails': {'default': {'url': 'http://example.com/thumb.jpg'}}
                },
                'statistics': {
                    'subscriberCount': '100000',
                    'videoCount': '500',
                    'viewCount': '10000000'
                },
                'contentDetails': {
                    'relatedPlaylists': {
                        'uploads': 'UUxxxxxxxxxxxxxxxxxxxxxxx'
                    }
                }
            }]
        }
        
        # Use a recent date for the video (within 30 days)
        from datetime import datetime, timedelta
        recent_date = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        mock_videos_response = {
            'items': [
                {
                    'snippet': {
                        'resourceId': {'videoId': 'video123'},
                        'title': 'Test Video 1',
                        'publishedAt': recent_date
                    }
                }
            ],
            'nextPageToken': None
        }
        
        mock_video_details = {
            'items': [{
                'id': 'video123',
                'statistics': {'viewCount': '50000'},
                'contentDetails': {'duration': 'PT10M30S'}
            }]
        }
        
        mock_youtube.channels().list().execute.return_value = mock_channel_response
        mock_youtube.playlistItems().list().execute.return_value = mock_videos_response
        mock_youtube.videos().list().execute.return_value = mock_video_details
        
        # Test with filters
        date_from = datetime.now() - timedelta(days=30)
        videos = self.collector.get_channel_videos(
            "UCxxxxxxxxxxxxxxxxxxxxxxx",
            date_from=date_from,
            min_views=10000,
            min_duration_seconds=300
        )
        
        assert len(videos) == 1
        assert videos[0]['view_count'] == 50000
        assert videos[0]['duration_seconds'] == 630  # 10m 30s

    def test_filter_videos_by_date(self):
        """Test filtering videos by date range."""
        videos = [
            {'published_at': '2024-01-01T00:00:00Z', 'video_id': 'v1'},
            {'published_at': '2024-01-15T00:00:00Z', 'video_id': 'v2'},
            {'published_at': '2024-02-01T00:00:00Z', 'video_id': 'v3'},
        ]
        
        date_from = datetime(2024, 1, 10)
        date_to = datetime(2024, 1, 20)
        
        filtered = self.collector._filter_videos_by_date(videos, date_from, date_to)
        
        assert len(filtered) == 1
        assert filtered[0]['video_id'] == 'v2'

    def test_filter_videos_by_views(self):
        """Test filtering videos by minimum view count."""
        videos = [
            {'view_count': 5000, 'video_id': 'v1'},
            {'view_count': 15000, 'video_id': 'v2'},
            {'view_count': 25000, 'video_id': 'v3'},
        ]
        
        filtered = self.collector._filter_videos_by_views(videos, min_views=10000)
        
        assert len(filtered) == 2
        assert filtered[0]['video_id'] == 'v2'
        assert filtered[1]['video_id'] == 'v3'

    def test_filter_videos_by_duration(self):
        """Test filtering videos by minimum duration."""
        videos = [
            {'duration_seconds': 180, 'video_id': 'v1'},  # 3 minutes
            {'duration_seconds': 600, 'video_id': 'v2'},  # 10 minutes
            {'duration_seconds': 1200, 'video_id': 'v3'}, # 20 minutes
        ]
        
        filtered = self.collector._filter_videos_by_duration(videos, min_duration_seconds=300)
        
        assert len(filtered) == 2
        assert filtered[0]['video_id'] == 'v2'
        assert filtered[1]['video_id'] == 'v3'

    def test_check_quota_limit_not_exceeded(self):
        """Test quota check when limit is not exceeded."""
        self.collector.requests_made = 5000
        self.collector.quota_limit = 10000
        
        # Should not raise exception
        self.collector._check_quota_limit(100)
        assert self.collector.requests_made == 5100

    def test_check_quota_limit_exceeded(self):
        """Test quota check when limit would be exceeded."""
        self.collector.requests_made = 9950
        self.collector.quota_limit = 10000
        
        with pytest.raises(APIQuotaExceededError, match="YouTube API quota exceeded"):
            self.collector._check_quota_limit(100)

    def test_parse_duration_iso8601(self):
        """Test parsing ISO 8601 duration strings."""
        test_cases = [
            ('PT4M13S', 253),      # 4 minutes 13 seconds
            ('PT1H30M', 5400),     # 1 hour 30 minutes
            ('PT15S', 15),         # 15 seconds
            ('PT2H15M30S', 8130),  # 2 hours 15 minutes 30 seconds
            ('PT0S', 0),           # 0 seconds
            ('', 0),               # Empty string
        ]
        
        for iso_duration, expected_seconds in test_cases:
            result = self.collector._parse_duration_iso8601(iso_duration)
            assert result == expected_seconds

    def test_get_channel_videos_pagination(self):
        """Test handling of paginated results when fetching channel videos."""
        with mock.patch('src.youtube_channel_collector.build') as mock_build:
            mock_youtube = mock.MagicMock()
            mock_build.return_value = mock_youtube
            
            # Mock channel response
            mock_channel_response = {
                'items': [{
                    'id': 'UCxxxxxxxxxxxxxxxxxxxxxxx',
                    'snippet': {
                        'title': 'Test Channel',
                        'description': 'Test channel description',
                        'publishedAt': '2020-01-01T00:00:00Z',
                        'thumbnails': {'default': {'url': 'http://example.com/thumb.jpg'}}
                    },
                    'statistics': {
                        'subscriberCount': '100000',
                        'videoCount': '500',
                        'viewCount': '10000000'
                    },
                    'contentDetails': {
                        'relatedPlaylists': {
                            'uploads': 'UUxxxxxxxxxxxxxxxxxxxxxxx'
                        }
                    }
                }]
            }
            
            # Mock paginated playlist responses
            page1_response = {
                'items': [
                    {
                        'snippet': {
                            'resourceId': {'videoId': 'video1'},
                            'title': 'Video 1',
                            'publishedAt': '2024-01-01T00:00:00Z'
                        }
                    }
                ],
                'nextPageToken': 'token123'
            }
            
            page2_response = {
                'items': [
                    {
                        'snippet': {
                            'resourceId': {'videoId': 'video2'},
                            'title': 'Video 2',
                            'publishedAt': '2024-01-02T00:00:00Z'
                        }
                    }
                ],
                'nextPageToken': None
            }
            
            mock_youtube.channels().list().execute.return_value = mock_channel_response
            mock_youtube.playlistItems().list().execute.side_effect = [page1_response, page2_response]
            
            videos = self.collector.get_channel_videos("UCxxxxxxxxxxxxxxxxxxxxxxx", max_results=100)
            
            assert len(videos) == 2
            assert videos[0]['video_id'] == 'video1'
            assert videos[1]['video_id'] == 'video2'
            # Verify pagination was handled (2 playlist API calls)
            assert mock_youtube.playlistItems().list().execute.call_count == 2

    def test_error_handling_api_failure(self):
        """Test error handling when YouTube API fails."""
        with mock.patch('src.youtube_channel_collector.build') as mock_build:
            mock_youtube = mock.MagicMock()
            mock_build.return_value = mock_youtube
            
            # Mock API error
            from googleapiclient.errors import HttpError
            mock_youtube.channels().list().execute.side_effect = HttpError(
                resp=mock.MagicMock(status=403), 
                content=b'{"error": {"message": "API key quota exceeded"}}'
            )
            
            with pytest.raises(APIQuotaExceededError):
                self.collector.get_channel_info("UCxxxxxxxxxxxxxxxxxxxxxxx")

    def test_extract_channel_id_edge_cases(self):
        """Test edge cases for channel ID extraction."""
        edge_cases = [
            ("https://www.youtube.com/channel/UC123", "UC123"),  # Short ID
            ("youtube.com/channel/UCxxxxx", "UCxxxxx"),  # No protocol
            ("https://m.youtube.com/channel/UCxxxxx", "UCxxxxx"),  # Mobile URL
            ("https://www.youtube.com/channel/UCxxxxx?tab=videos", "UCxxxxx"),  # With query params
            ("UCxxxxx", "UCxxxxx"),  # Direct ID
            ("invalid_id", None),  # Invalid format
            ("", None),  # Empty string
        ]
        
        for url, expected in edge_cases:
            result = self.collector.extract_channel_id(url)
            assert result == expected

    @pytest.mark.integration
    def test_integration_with_real_api_key(self):
        """Integration test with real YouTube Data API (requires API key)."""
        import os
        
        api_key = os.getenv('YOUTUBE_DATA_API_KEY')
        if not api_key:
            pytest.skip("YOUTUBE_DATA_API_KEY environment variable not set")
        
        collector = YouTubeChannelCollector(api_key=api_key)
        
        # Test with a known public channel (YouTube's own channel)
        channel_id = "UC_x5XG1OV2P6uZZ5FSM9Ttw"  # YouTube channel
        
        try:
            channel_info = collector.get_channel_info(channel_id)
            assert channel_info['channel_id'] == channel_id
            assert 'title' in channel_info
            assert 'video_count' in channel_info
            
            # Test getting a few videos
            videos = collector.get_channel_videos(channel_id, max_results=5)
            assert len(videos) > 0
            assert all('video_id' in video for video in videos)
            
        except APIQuotaExceededError:
            pytest.skip("API quota exceeded during integration test")
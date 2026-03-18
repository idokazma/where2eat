"""
Tests for the yt-dlp-based video fetcher in PipelineScheduler.

Verifies that _fetch_videos_with_ytdlp, _fetch_playlist_videos, and
_fetch_channel_videos correctly use yt-dlp (no YouTube Data API key needed).
"""

import os
import sys
import pytest
import tempfile
from unittest.mock import patch, MagicMock

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database


@pytest.fixture
def db():
    """Create a temporary test database."""
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, 'test.db')
        yield Database(db_path)


@pytest.fixture
def scheduler(db):
    """Create a PipelineScheduler with a test database."""
    from pipeline_scheduler import PipelineScheduler
    return PipelineScheduler(db=db)


def _mock_ytdlp_info(entries):
    """Build a mock yt-dlp extract_info return value."""
    return {
        'entries': entries,
        '_type': 'playlist',
        'title': 'Test Playlist',
    }


def _make_entry(video_id, title='Test Video', upload_date='20240115'):
    """Build a single yt-dlp flat entry."""
    return {
        'id': video_id,
        'title': title,
        'url': f'https://www.youtube.com/watch?v={video_id}',
        'upload_date': upload_date,
        'duration': 600,
    }


# ---------------------------------------------------------------------------
# Test _fetch_videos_with_ytdlp
# ---------------------------------------------------------------------------
class TestFetchVideosWithYtdlp:
    """Test the core yt-dlp fetcher method."""

    def test_returns_video_list(self, scheduler):
        """Parses yt-dlp flat entries into standard video dicts."""
        entries = [
            _make_entry('vid_1', 'Video One', '20240110'),
            _make_entry('vid_2', 'Video Two', '20240215'),
        ]
        mock_info = _mock_ytdlp_info(entries)

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp(
                'https://www.youtube.com/playlist?list=PLtest'
            )

        assert len(result) == 2
        assert result[0]['video_id'] == 'vid_1'
        assert result[0]['video_title'] == 'Video One'
        assert result[0]['video_url'] == 'https://www.youtube.com/watch?v=vid_1'
        assert result[1]['video_id'] == 'vid_2'

    def test_converts_upload_date_to_iso(self, scheduler):
        """YYYYMMDD upload_date is converted to YYYY-MM-DD."""
        entries = [_make_entry('vid_date', 'Date Test', '20231225')]
        mock_info = _mock_ytdlp_info(entries)

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result[0]['published_at'] == '2023-12-25'

    def test_handles_missing_upload_date(self, scheduler):
        """Entries without upload_date get empty string."""
        entry = _make_entry('vid_nodate')
        entry['upload_date'] = None
        mock_info = _mock_ytdlp_info([entry])

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result[0]['published_at'] == ''

    def test_skips_entries_without_id(self, scheduler):
        """Entries with no video ID are filtered out."""
        entries = [
            _make_entry('vid_ok'),
            {'id': None, 'title': 'No ID'},
            _make_entry('vid_also_ok'),
        ]
        mock_info = _mock_ytdlp_info(entries)

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert len(result) == 2
        assert result[0]['video_id'] == 'vid_ok'
        assert result[1]['video_id'] == 'vid_also_ok'

    def test_handles_empty_playlist(self, scheduler):
        """Empty playlists return empty list."""
        mock_info = _mock_ytdlp_info([])

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result == []

    def test_handles_none_entries(self, scheduler):
        """If entries is None, returns empty list."""
        mock_info = {'entries': None}

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result == []

    def test_handles_none_info_result(self, scheduler):
        """Returns empty list when extract_info returns None."""
        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = None

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result == []

    def test_returns_empty_on_import_error(self, scheduler):
        """Returns empty list if yt-dlp is not installed."""
        with patch.dict('sys.modules', {'yt_dlp': None}):
            with patch('builtins.__import__', side_effect=ImportError('No module named yt_dlp')):
                result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result == []

    def test_returns_empty_on_ytdlp_error(self, scheduler):
        """Returns empty list on yt-dlp extraction error."""
        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.side_effect = Exception('Download error')

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result == []

    def test_passes_correct_options(self, scheduler):
        """Verifies yt-dlp options include extract_flat; playlistend is optional."""
        mock_info = _mock_ytdlp_info([])

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl) as mock_cls:
            scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        opts = mock_cls.call_args[0][0]
        assert opts['extract_flat'] is True
        assert opts['quiet'] is True
        # playlistend is only set when max_videos is explicitly passed
        assert 'playlistend' not in opts

    def test_passes_playlistend_when_max_videos_set(self, scheduler):
        """Verifies playlistend is set when max_videos is passed."""
        mock_info = _mock_ytdlp_info([])

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl) as mock_cls:
            scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest', max_videos=25)

        opts = mock_cls.call_args[0][0]
        assert opts['playlistend'] == 25

    def test_fallback_url_when_entry_url_missing(self, scheduler):
        """If entry has no url field, builds it from video_id."""
        entry = {'id': 'vid_nourl', 'title': 'No URL', 'upload_date': '20240101'}
        mock_info = _mock_ytdlp_info([entry])

        mock_ydl = MagicMock()
        mock_ydl.__enter__ = MagicMock(return_value=mock_ydl)
        mock_ydl.__exit__ = MagicMock(return_value=False)
        mock_ydl.extract_info.return_value = mock_info

        with patch('yt_dlp.YoutubeDL', return_value=mock_ydl):
            result = scheduler._fetch_videos_with_ytdlp('https://www.youtube.com/playlist?list=PLtest')

        assert result[0]['video_url'] == 'https://www.youtube.com/watch?v=vid_nourl'


# ---------------------------------------------------------------------------
# Test _fetch_playlist_videos (delegates to _fetch_videos_with_ytdlp)
# ---------------------------------------------------------------------------
class TestFetchPlaylistVideos:
    """Test the playlist-specific wrapper."""

    def test_builds_correct_playlist_url(self, scheduler):
        """Constructs playlist URL from source_id and delegates to yt-dlp."""
        subscription = {'source_id': 'PLabc123', 'source_type': 'playlist'}

        with patch.object(scheduler, '_fetch_videos_with_ytdlp', return_value=[]) as mock_fetch:
            scheduler._fetch_playlist_videos(subscription)

        mock_fetch.assert_called_once_with(
            'https://www.youtube.com/playlist?list=PLabc123'
        )

    def test_returns_videos_from_ytdlp(self, scheduler):
        """Returns whatever _fetch_videos_with_ytdlp returns."""
        subscription = {'source_id': 'PLtest', 'source_type': 'playlist'}
        expected = [{'video_id': 'v1', 'video_url': 'url', 'video_title': 't', 'published_at': ''}]

        with patch.object(scheduler, '_fetch_videos_with_ytdlp', return_value=expected):
            result = scheduler._fetch_playlist_videos(subscription)

        assert result == expected


# ---------------------------------------------------------------------------
# Test _fetch_channel_videos dispatch
# ---------------------------------------------------------------------------
class TestFetchChannelVideosDispatch:
    """Test that _fetch_channel_videos dispatches correctly."""

    def test_playlist_dispatches_to_fetch_playlist(self, scheduler):
        """Playlist subscriptions call _fetch_playlist_videos."""
        subscription = {
            'source_type': 'playlist',
            'source_id': 'PLxyz',
            'source_url': 'https://www.youtube.com/playlist?list=PLxyz',
        }

        with patch.object(scheduler, '_fetch_playlist_videos', return_value=[]) as mock_pl:
            scheduler._fetch_channel_videos(subscription)

        mock_pl.assert_called_once_with(subscription)

    def test_channel_uses_ytdlp_directly(self, scheduler):
        """Channel subscriptions call _fetch_videos_with_ytdlp with source_url."""
        subscription = {
            'source_type': 'channel',
            'source_id': 'UCtest',
            'source_url': 'https://www.youtube.com/channel/UCtest',
        }

        with patch.object(scheduler, '_fetch_videos_with_ytdlp', return_value=[]) as mock_fetch:
            scheduler._fetch_channel_videos(subscription)

        mock_fetch.assert_called_once_with('https://www.youtube.com/channel/UCtest')

    def test_no_api_key_needed(self, scheduler):
        """Verify no YOUTUBE_DATA_API_KEY usage in the fetch path."""
        subscription = {
            'source_type': 'playlist',
            'source_id': 'PLtest',
            'source_url': 'https://www.youtube.com/playlist?list=PLtest',
        }

        # Clear any API key env var
        env = os.environ.copy()
        env.pop('YOUTUBE_DATA_API_KEY', None)

        with patch.dict(os.environ, env, clear=True):
            with patch.object(scheduler, '_fetch_videos_with_ytdlp', return_value=[]):
                result = scheduler._fetch_channel_videos(subscription)

        assert result == []  # no crash, no API key error

    def test_fetch_playlist_videos_works_without_youtube_api_key(self, scheduler):
        """_fetch_playlist_videos uses yt-dlp only, no YouTube Data API key needed."""
        subscription = {'source_id': 'PLnokey', 'source_type': 'playlist'}
        expected = [
            {'video_id': 'vid_nokey', 'video_url': 'https://www.youtube.com/watch?v=vid_nokey',
             'video_title': 'No Key Needed', 'published_at': '2024-03-01'},
        ]

        # Ensure no YouTube Data API key is set
        env = {k: v for k, v in os.environ.items() if k != 'YOUTUBE_DATA_API_KEY'}

        with patch.dict(os.environ, env, clear=True):
            with patch.object(scheduler, '_fetch_videos_with_ytdlp', return_value=expected):
                result = scheduler._fetch_playlist_videos(subscription)

        assert len(result) == 1
        assert result[0]['video_id'] == 'vid_nokey'
        assert result[0]['video_title'] == 'No Key Needed'

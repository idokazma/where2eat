# Fix: Replace YouTube Data API with yt-dlp for Video Fetching

**Branch:** `fix/yt-dlp-playlist-fetcher`
**Status:** Complete

## Problem

The pipeline scheduler required a `YOUTUBE_DATA_API_KEY` to fetch playlist and channel videos via the YouTube Data API v3 (`google-api-python-client`). This added an extra secret to manage and a dependency on a quota-limited paid API.

## Solution

Replaced the YouTube Data API calls in `PipelineScheduler` with `yt-dlp`, which uses flat extraction to list videos from any YouTube playlist or channel URL without requiring an API key.

## Changes

### Modified Files

| File | Change |
|------|--------|
| `src/pipeline_scheduler.py` | Replaced `_fetch_playlist_videos()` (was using `googleapiclient`) and `_fetch_channel_videos()` (was using `YouTubeChannelCollector`) with `_fetch_videos_with_ytdlp()` |
| `requirements.txt` | Added `yt-dlp>=2024.0.0` |
| `Dockerfile` | Added `yt-dlp` to pip install |

### New Files

| File | Description |
|------|-------------|
| `tests/test_ytdlp_fetcher.py` | 15 tests covering the new yt-dlp fetcher |
| `docs/fix-ytdlp-playlist-fetcher.md` | This tracking document |

## Architecture

### Before
```
_fetch_channel_videos()
  ├── playlist → _fetch_playlist_videos() → googleapiclient (needs YOUTUBE_DATA_API_KEY)
  └── channel  → YouTubeChannelCollector  → googleapiclient (needs YOUTUBE_DATA_API_KEY)
```

### After
```
_fetch_channel_videos()
  ├── playlist → _fetch_playlist_videos() → _fetch_videos_with_ytdlp() (no API key)
  └── channel  → _fetch_videos_with_ytdlp() directly                   (no API key)
```

### Key method: `_fetch_videos_with_ytdlp(url)`
- Uses `yt_dlp.YoutubeDL` with `extract_flat=True` (no download, just metadata)
- Works for playlists, channels, and any multi-video YouTube URL
- Respects `PIPELINE_MAX_INITIAL_VIDEOS` via `playlistend` option
- Converts yt-dlp date format (YYYYMMDD) to ISO (YYYY-MM-DD)
- Graceful fallback: returns `[]` on ImportError or extraction errors

## Tests

All 35 tests pass (15 new + 20 existing):

**New tests (test_ytdlp_fetcher.py):**
- `TestFetchVideosWithYtdlp` (11 tests): video list parsing, date conversion, missing fields, empty/null entries, import errors, extraction errors, yt-dlp options, URL fallback
- `TestFetchPlaylistVideos` (2 tests): playlist URL construction, delegation
- `TestFetchChannelVideosDispatch` (3 tests): playlist dispatch, channel direct fetch, no API key needed

**Existing tests (test_pipeline_scheduler.py):**
- All 20 tests pass unchanged (they mock at `_fetch_channel_videos` / `_fetch_playlist_videos` level)

## Environment Variables

### No Longer Required by Pipeline
- `YOUTUBE_DATA_API_KEY` - no longer needed for playlist/channel video fetching

### Still Used Elsewhere
- `google-api-python-client` remains in dependencies for Google Places API and `YouTubeChannelCollector` (used outside the pipeline)

## Known Issues

- `youtube_channel_collector.py` still uses `google-api-python-client` and requires `YOUTUBE_DATA_API_KEY` when used directly. This module is no longer called by the pipeline scheduler but may be used by other code paths.
- `yt-dlp` flat extraction may not return `upload_date` for all entries; handled gracefully with empty string fallback.

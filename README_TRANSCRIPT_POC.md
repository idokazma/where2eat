# YouTube Transcript Collector POC

This is a proof of concept for collecting transcripts from YouTube videos to help discover trending restaurants.

## Features

- Extract transcripts from YouTube videos using various URL formats
- Support for multiple languages
- Batch processing of multiple videos
- Keyword search within transcripts
- Timestamp support for all transcript segments

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```python
from youtube_transcript_collector import YouTubeTranscriptCollector

# Initialize collector
collector = YouTubeTranscriptCollector()

# Get transcript from a video
result = collector.get_transcript('https://www.youtube.com/watch?v=VIDEO_ID')

if result:
    print(f"Transcript: {result['transcript']}")
    print(f"Number of segments: {result['segment_count']}")
```

### Batch Processing

```python
# Process multiple videos
video_urls = [
    'https://www.youtube.com/watch?v=VIDEO_ID_1',
    'https://www.youtube.com/watch?v=VIDEO_ID_2',
    'https://youtu.be/VIDEO_ID_3'
]

results = collector.get_transcripts_batch(video_urls)
print(f"Successfully fetched {len(results)} transcripts")
```

### Keyword Search

```python
# Search for keywords in transcript
matches = collector.search_transcript(
    'https://www.youtube.com/watch?v=VIDEO_ID',
    'restaurant'
)

for match in matches:
    print(f"[{match['start']}s] {match['text']}")
```

### Supported URL Formats

The collector supports various YouTube URL formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/v/VIDEO_ID`
- Direct video ID: `VIDEO_ID`

## Demo Script

Run the interactive demo:

```bash
python demo_transcript_collector.py
```

This will walk you through:
1. Fetching a single video transcript
2. Batch processing multiple videos
3. Searching for keywords in transcripts

## API Reference

### YouTubeTranscriptCollector

#### Methods

**get_transcript(video_url, languages=['en'])**
- Fetch transcript for a single video
- Parameters:
  - `video_url` (str): YouTube URL or video ID
  - `languages` (list): Preferred language codes (default: ['en'])
- Returns: Dictionary with transcript data or None

**get_transcripts_batch(video_urls, languages=['en'])**
- Fetch transcripts for multiple videos
- Parameters:
  - `video_urls` (list): List of YouTube URLs or video IDs
  - `languages` (list): Preferred language codes
- Returns: List of transcript dictionaries

**search_transcript(video_url, keyword)**
- Search for keyword in video transcript
- Parameters:
  - `video_url` (str): YouTube URL or video ID
  - `keyword` (str): Keyword to search for
- Returns: List of matching segments with timestamps

**extract_video_id(url)** (static)
- Extract video ID from YouTube URL
- Parameters:
  - `url` (str): YouTube URL or video ID
- Returns: Video ID string or None

## Return Data Structure

The `get_transcript()` method returns a dictionary with:

```python
{
    'video_id': str,           # YouTube video ID
    'video_url': str,          # Full YouTube URL
    'transcript': str,         # Complete transcript text
    'segments': list,          # List of transcript segments
    'language': str,           # Language code
    'segment_count': int       # Number of segments
}
```

Each segment in the `segments` list contains:
```python
{
    'text': str,               # Segment text
    'start': float,            # Start timestamp in seconds
    'duration': float          # Duration in seconds
}
```

## Use Cases for Restaurant Discovery

This POC enables:

1. **Restaurant Review Analysis**: Extract transcripts from food vlogger videos
2. **Trend Detection**: Identify frequently mentioned restaurants across multiple videos
3. **Sentiment Analysis**: Analyze what people say about specific restaurants
4. **Location Extraction**: Find restaurant names and locations mentioned in videos
5. **Time-based Analysis**: Track when specific restaurants are mentioned (using timestamps)

## Limitations

- Requires videos to have captions/transcripts available
- Some videos may have transcripts disabled by the creator
- Language support depends on available captions
- Rate limiting may apply for large batch operations

## Next Steps

To extend this POC:
1. Add integration with YouTube Data API for video metadata
2. Implement NLP for restaurant name extraction
3. Add sentiment analysis on transcript text
4. Create database storage for transcripts
5. Build scheduling system for regular transcript collection
6. Add support for Instagram and Facebook content

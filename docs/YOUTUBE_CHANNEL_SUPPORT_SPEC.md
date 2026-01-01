# YouTube Channel Support Feature Specification

**Document Version:** 1.0  
**Created:** 2026-01-01  
**Status:** Pending Implementation  

## 🎯 Overview

This feature specification defines the implementation of YouTube channel support for the Where2Eat restaurant discovery system. Currently, the system processes individual YouTube videos. This enhancement will enable users to provide a YouTube channel URL and automatically process all videos from that channel to extract restaurant mentions.

## 🎪 User Stories

### Primary User Story
**As a** restaurant discovery user  
**I want to** analyze an entire YouTube food channel  
**So that** I can discover all restaurants mentioned across multiple episodes without having to process each video individually  

### Secondary User Stories

1. **Channel Auto-Discovery**
   - **As a** user, **I want to** provide a channel URL and have the system automatically find all videos, **so that** I don't need to manually collect individual video URLs

2. **Progress Tracking**
   - **As a** user, **I want to** see real-time progress when processing a channel, **so that** I know how many videos are completed and estimated time remaining

3. **Intelligent Filtering**
   - **As a** user, **I want to** skip videos I've already processed, **so that** I can incrementally update my restaurant database without duplicating work

4. **Batch Results**
   - **As a** user, **I want to** see a comprehensive summary of all restaurants found across a channel, **so that** I can understand the overall restaurant landscape from that content creator

## 🏗️ Technical Architecture

### 🔧 Core Components

#### 1. YouTube Channel Data Collector
**File:** `src/youtube_channel_collector.py`

Responsible for discovering and listing all videos from a YouTube channel using the YouTube Data API v3.

**Key Functions:**
- Extract channel ID from various URL formats
- Fetch channel uploads playlist
- Paginate through all videos
- Filter videos by date, duration, view count
- Return structured video metadata

#### 2. Channel Batch Processor
**File:** `src/channel_batch_processor.py`

Orchestrates the processing of multiple videos from a channel with progress tracking and error handling.

**Key Functions:**
- Process videos in configurable batch sizes
- Track processing progress and status
- Handle individual video failures gracefully
- Generate comprehensive batch reports
- Implement rate limiting to respect API quotas

#### 3. Web Interface Extensions
**File:** `web/src/components/youtube-analyzer.tsx`

Enhanced UI components to support channel input and progress visualization.

**Key Features:**
- Channel URL input with validation
- Real-time progress bars and status updates
- Batch processing results display
- Channel metadata preview

#### 4. API Extensions
**File:** `api/index.js`

New endpoints to support channel processing and progress tracking.

## 📋 Functional Requirements

### FR-1: Channel URL Support
- **Description:** System must accept YouTube channel URLs in multiple formats
- **Acceptance Criteria:**
  - Support `youtube.com/channel/UC...` format
  - Support `youtube.com/c/channelname` format  
  - Support `youtube.com/user/username` format
  - Support `youtube.com/@channelname` format
  - Validate URL format before processing
  - Extract channel ID regardless of URL format

### FR-2: Video Discovery
- **Description:** Automatically discover all videos from a channel
- **Acceptance Criteria:**
  - Fetch all public videos from channel uploads playlist
  - Paginate through results to get complete video list
  - Return video metadata including title, duration, publish date, view count
  - Handle channels with 1000+ videos efficiently
  - Support filtering by date range (e.g., last 6 months)

### FR-3: Batch Processing
- **Description:** Process multiple videos with progress tracking
- **Acceptance Criteria:**
  - Process videos in configurable batches (default: 5 videos at a time)
  - Show real-time progress (X of Y videos completed)
  - Display current video being processed
  - Estimate remaining time based on average processing time
  - Continue processing even if individual videos fail
  - Generate detailed batch processing report

### FR-4: Duplicate Prevention
- **Description:** Skip videos that have already been processed
- **Acceptance Criteria:**
  - Check if video ID already exists in restaurant data
  - Allow user to force reprocess if desired
  - Show count of skipped vs. new videos
  - Update existing data if video was reprocessed

### FR-5: Progress Visualization
- **Description:** Real-time progress tracking in web interface
- **Acceptance Criteria:**
  - Progress bar showing percentage completed
  - Current video title and thumbnail
  - Count of restaurants found so far
  - List of videos processed/failed/remaining
  - Estimated time remaining
  - Ability to cancel ongoing processing

### FR-6: Batch Results Summary
- **Description:** Comprehensive summary of channel processing results
- **Acceptance Criteria:**
  - Total videos processed vs. skipped vs. failed
  - Total restaurants discovered
  - Top cuisines found across the channel
  - Geographic distribution of restaurants
  - Timeline view of when restaurants were mentioned
  - Export capabilities for batch results

## 🛠️ Technical Requirements

### TR-1: YouTube Data API Integration
- **Requirements:**
  - Use YouTube Data API v3 for channel data retrieval
  - Implement API quota management and rate limiting
  - Handle API errors gracefully (quota exceeded, invalid channel, etc.)
  - Cache channel metadata to reduce API calls
  - **Dependencies:** `google-api-python-client>=2.100.0`

### TR-2: Database Schema Extensions
- **Requirements:**
  - Add channel metadata to restaurant records
  - Track processing status for each video
  - Store batch processing history
  - Index by channel ID for efficient filtering

### TR-3: Error Handling & Resilience
- **Requirements:**
  - Continue processing if individual videos fail
  - Retry failed videos with exponential backoff
  - Log detailed error information for debugging
  - Provide user-friendly error messages
  - Save partial results even if batch processing is interrupted

### TR-4: Performance Requirements
- **Requirements:**
  - Process channels with 500+ videos within 2 hours
  - Maintain responsive UI during background processing
  - Use worker processes for CPU-intensive tasks
  - Implement proper connection pooling for database operations

### TR-5: Configuration Management
- **Requirements:**
  - Configurable batch sizes (default: 5 videos)
  - Configurable processing timeouts
  - Rate limiting configuration
  - Filter options (date range, minimum views, etc.)

## 🧪 Test-Driven Development Requirements

### TDD-1: Unit Test Coverage
Following the project's mandatory TDD requirements, all new code must have >90% test coverage.

**Required Test Files:**
- `tests/test_youtube_channel_collector.py`
- `tests/test_channel_batch_processor.py`
- `tests/test_channel_api_endpoints.py`

**Test Categories:**
- **URL Parsing Tests:** Various channel URL formats
- **API Integration Tests:** Mock YouTube Data API responses
- **Batch Processing Tests:** Various batch sizes and error scenarios
- **Progress Tracking Tests:** Status updates and progress calculations
- **Error Handling Tests:** API failures, network issues, invalid channels

### TDD-2: Integration Tests
- **Channel Processing End-to-End:** Full workflow from URL input to restaurant extraction
- **API Endpoint Tests:** All new REST endpoints with various inputs
- **UI Component Tests:** React component behavior and state management

### TDD-3: Performance Tests
- **Large Channel Tests:** Channels with 1000+ videos
- **Concurrent Processing Tests:** Multiple users processing channels simultaneously
- **Memory Usage Tests:** Ensure no memory leaks during long-running operations

## 📊 API Specifications

### New REST Endpoints

#### POST /api/analyze/channel
Process an entire YouTube channel for restaurant extraction.

**Request:**
```json
{
  "channel_url": "https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxxx",
  "filters": {
    "date_from": "2023-01-01",
    "date_to": "2026-01-01",
    "min_duration_seconds": 300,
    "min_views": 1000
  },
  "processing_options": {
    "batch_size": 5,
    "skip_existing": true,
    "force_reprocess": false
  }
}
```

**Response:**
```json
{
  "job_id": "uuid-4-batch-job",
  "status": "started",
  "channel_info": {
    "channel_id": "UCxxxxxxxxxxxxxxxxxxxxxxx",
    "channel_title": "Food Channel Name",
    "total_videos": 245,
    "videos_to_process": 180,
    "videos_skipped": 65
  },
  "estimated_duration_minutes": 90
}
```

#### GET /api/jobs/{job_id}/status
Get real-time status of channel processing job.

**Response:**
```json
{
  "job_id": "uuid-4-batch-job",
  "status": "processing", // started|processing|completed|failed|cancelled
  "progress": {
    "videos_completed": 25,
    "videos_total": 180,
    "videos_failed": 2,
    "restaurants_found": 87,
    "current_video": {
      "title": "Best Restaurants in Tel Aviv 2025",
      "duration": "15:30",
      "progress": "analyzing_transcript"
    }
  },
  "estimated_completion": "2026-01-01T14:30:00Z",
  "started_at": "2026-01-01T12:00:00Z"
}
```

#### GET /api/jobs/{job_id}/results
Get final results of completed channel processing job.

**Response:**
```json
{
  "job_id": "uuid-4-batch-job",
  "status": "completed",
  "summary": {
    "videos_processed": 178,
    "videos_failed": 2,
    "restaurants_found": 312,
    "processing_duration_minutes": 87
  },
  "statistics": {
    "top_cuisines": [
      {"cuisine": "Mediterranean", "count": 45},
      {"cuisine": "Italian", "count": 38}
    ],
    "top_cities": [
      {"city": "Tel Aviv", "count": 89},
      {"city": "Jerusalem", "count": 56}
    ]
  },
  "failed_videos": [
    {
      "video_id": "abc123",
      "title": "Video Title",
      "error": "Transcript not available"
    }
  ]
}
```

## 🚀 Implementation Plan

### Phase 1: Core Channel Discovery (Week 1)
1. **Day 1-2:** TDD implementation of `YouTubeChannelCollector`
   - URL parsing and channel ID extraction
   - YouTube Data API integration
   - Video metadata retrieval with pagination

2. **Day 3-4:** TDD implementation of `ChannelBatchProcessor`
   - Batch processing logic
   - Progress tracking mechanisms
   - Error handling and retry logic

3. **Day 5:** Integration testing and API endpoint development

### Phase 2: Web Interface (Week 2)
1. **Day 1-2:** UI components for channel input
   - Channel URL validation
   - Channel preview display

2. **Day 3-4:** Progress tracking interface
   - Real-time progress bars
   - Status updates and current video display

3. **Day 5:** Results visualization and summary pages

### Phase 3: Advanced Features (Week 3)
1. **Day 1-2:** Filtering and configuration options
2. **Day 3-4:** Performance optimizations and caching
3. **Day 5:** Documentation and final testing

## 🔐 Security & Privacy Considerations

### Data Privacy
- **Video Metadata:** Only store minimal necessary metadata (title, duration, publish date)
- **API Keys:** Secure storage of YouTube Data API credentials
- **User Data:** No storage of user's personal YouTube data

### Rate Limiting
- **API Quotas:** Respect YouTube Data API quotas (10,000 units/day default)
- **Processing Limits:** Limit concurrent channel processing to prevent resource exhaustion
- **User Limits:** Implement reasonable limits per user/session

### Error Information
- **API Errors:** Don't expose internal API keys or sensitive error details
- **User Feedback:** Provide helpful error messages without revealing system internals

## 📈 Success Metrics

### Functional Metrics
- **Channel Processing Success Rate:** >95% of valid channels processed successfully
- **Video Discovery Accuracy:** 100% of public videos discovered from channel
- **Processing Speed:** Average 2-3 videos processed per minute
- **Error Recovery:** <5% of videos fail due to system errors

### User Experience Metrics
- **Progress Visibility:** Real-time progress updates within 5 seconds
- **UI Responsiveness:** Interface remains responsive during background processing
- **Result Accuracy:** Restaurant extraction quality maintains current standards

### Performance Metrics
- **Memory Usage:** No memory leaks during large channel processing
- **API Efficiency:** Minimize API calls through intelligent caching
- **Concurrent Users:** Support 5+ simultaneous channel processing jobs

## 🔮 Future Enhancements

### Advanced Filtering
- Filter by video title keywords (e.g., only "restaurant review" videos)
- Filter by video description content
- Filter by comment sentiment analysis

### Machine Learning Integration
- Predict which videos are most likely to contain restaurant mentions
- Automatically categorize videos by content type
- Optimize processing order based on prediction confidence

### Social Features
- Share channel processing results with other users
- Collaborative filtering and tagging of restaurants
- Community-driven restaurant verification

### Analytics Dashboard
- Channel comparison analytics
- Trending restaurants across multiple channels
- Geographic heat maps of restaurant discoveries

---

**This feature specification follows the project's mandatory TDD requirements and architectural standards. All implementation must include comprehensive test coverage (>90%) written before the actual code implementation.**
# Technical Specifications
## Restaurant Trend Scout

**Document Version:** 1.0
**Last Updated:** 2026-01-01
**Owner:** Engineering Team
**Status:** Draft

---

## Overview

This document provides detailed technical specifications for implementing the Restaurant Trend Scout system. It includes data models, API contracts, algorithms, and implementation guidelines for the engineering team.

---

## 1. Data Models

### 1.1 Database Schema

#### Restaurant Entity
```sql
CREATE TABLE restaurants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,  -- lowercase, no punctuation
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Classification
    cuisine_types TEXT[],  -- ['Italian', 'Pizza', 'Fine Dining']
    price_level INT CHECK (price_level BETWEEN 1 AND 4),  -- 1=$ to 4=$$$$

    -- Contact
    phone VARCHAR(20),
    website VARCHAR(500),
    email VARCHAR(255),

    -- External IDs
    google_place_id VARCHAR(255) UNIQUE,
    yelp_id VARCHAR(255),
    facebook_page_id VARCHAR(255),
    instagram_handle VARCHAR(100),

    -- Operating hours (JSONB)
    hours JSONB,  -- {"monday": {"open": "11:00", "close": "22:00"}, ...}

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_scraped_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    CONSTRAINT unique_restaurant UNIQUE (normalized_name, city, state)
);

-- Indexes
CREATE INDEX idx_restaurants_location ON restaurants
    USING GIST (ll_to_earth(latitude, longitude));
CREATE INDEX idx_restaurants_normalized_name ON restaurants
    USING gin (normalized_name gin_trgm_ops);
CREATE INDEX idx_restaurants_city_state ON restaurants (city, state);
CREATE INDEX idx_restaurants_cuisine ON restaurants USING GIN (cuisine_types);
CREATE INDEX idx_restaurants_updated ON restaurants (updated_at DESC);

-- Enable PostGIS for advanced geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- trigram similarity
CREATE EXTENSION IF NOT EXISTS cube;     -- for earth distance
CREATE EXTENSION IF NOT EXISTS earthdistance;
```

#### Social Posts Entity
```sql
CREATE TABLE social_posts (
    id BIGSERIAL PRIMARY KEY,

    -- Platform identification
    platform VARCHAR(50) NOT NULL,  -- 'youtube', 'instagram', 'facebook'
    post_id VARCHAR(255) NOT NULL,
    post_url TEXT,

    -- Author
    user_id VARCHAR(255),
    user_handle VARCHAR(100),
    user_name VARCHAR(255),
    user_followers INT,
    user_is_verified BOOLEAN DEFAULT FALSE,
    user_is_influencer BOOLEAN DEFAULT FALSE,  -- followers > 10K

    -- Content
    content TEXT,  -- post caption, video description, etc.
    content_type VARCHAR(50),  -- 'photo', 'video', 'story', 'reel'

    -- Timestamps
    posted_at TIMESTAMP NOT NULL,
    scraped_at TIMESTAMP DEFAULT NOW(),

    -- Engagement metrics
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    shares INT DEFAULT 0,
    views INT DEFAULT 0,
    saves INT DEFAULT 0,
    engagement_rate DECIMAL(5, 4),  -- calculated: (likes+comments+shares)/followers

    -- Sentiment analysis
    sentiment_score DECIMAL(3, 2),  -- -1.0 to +1.0
    sentiment_label VARCHAR(20),    -- 'positive', 'negative', 'neutral'

    -- Location data
    location_text VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Media
    media_urls TEXT[],
    thumbnail_url TEXT,

    -- Metadata
    hashtags TEXT[],
    mentions TEXT[],  -- @username mentions

    -- Flags
    is_ad BOOLEAN DEFAULT FALSE,
    is_bot BOOLEAN DEFAULT FALSE,
    quality_score DECIMAL(3, 2),  -- 0.0 to 1.0

    CONSTRAINT unique_post UNIQUE (platform, post_id)
);

-- Indexes
CREATE INDEX idx_social_posts_posted_at ON social_posts (posted_at DESC);
CREATE INDEX idx_social_posts_platform ON social_posts (platform);
CREATE INDEX idx_social_posts_location ON social_posts
    USING GIST (ll_to_earth(latitude, longitude));
CREATE INDEX idx_social_posts_hashtags ON social_posts USING GIN (hashtags);
CREATE INDEX idx_social_posts_scraped ON social_posts (scraped_at DESC);
CREATE INDEX idx_social_posts_engagement ON social_posts (engagement_rate DESC);

-- Partition by month for performance
CREATE TABLE social_posts_y2026m01 PARTITION OF social_posts
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- (add more partitions as needed)
```

#### Restaurant Mentions Entity
```sql
CREATE TABLE restaurant_mentions (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES social_posts(id) ON DELETE CASCADE,

    -- Extraction details
    mention_text VARCHAR(500),  -- actual text mentioning restaurant
    confidence DECIMAL(3, 2),   -- 0.0 to 1.0 (NER confidence)
    context TEXT,               -- surrounding text for context

    -- Classification
    mention_type VARCHAR(50),   -- 'review', 'recommendation', 'checkin', 'tag'
    is_positive BOOLEAN,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_mention UNIQUE (restaurant_id, post_id)
);

-- Indexes
CREATE INDEX idx_mentions_restaurant ON restaurant_mentions (restaurant_id);
CREATE INDEX idx_mentions_post ON restaurant_mentions (post_id);
CREATE INDEX idx_mentions_created ON restaurant_mentions (created_at DESC);
```

#### Trend Metrics Entity (Pre-computed)
```sql
CREATE TABLE trend_metrics (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Basic metrics
    mention_count INT DEFAULT 0,
    unique_users INT DEFAULT 0,
    total_engagement INT DEFAULT 0,

    -- Sentiment
    avg_sentiment DECIMAL(3, 2),
    positive_ratio DECIMAL(3, 2),  -- % of positive mentions

    -- Platform breakdown
    platform_breakdown JSONB,  -- {"instagram": 45, "youtube": 12, "facebook": 8}

    -- Trend indicators
    trend_score DECIMAL(10, 4),      -- 0.0 to 1.0+
    trend_velocity DECIMAL(10, 4),   -- rate of growth
    trend_category VARCHAR(20),      -- 'hot', 'rising', 'new', 'emerging'

    -- Rankings
    rank_global INT,
    rank_city INT,
    rank_cuisine INT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_trend_metric UNIQUE (restaurant_id, date)
);

-- Indexes
CREATE INDEX idx_trend_metrics_date ON trend_metrics (date DESC);
CREATE INDEX idx_trend_metrics_score ON trend_metrics (trend_score DESC);
CREATE INDEX idx_trend_metrics_restaurant ON trend_metrics (restaurant_id);
CREATE INDEX idx_trend_metrics_category ON trend_metrics (trend_category);

-- Materialized view for fast trending queries
CREATE MATERIALIZED VIEW trending_restaurants AS
SELECT
    r.*,
    tm.trend_score,
    tm.trend_velocity,
    tm.trend_category,
    tm.mention_count,
    tm.rank_city
FROM restaurants r
JOIN trend_metrics tm ON r.id = tm.restaurant_id
WHERE tm.date = CURRENT_DATE
  AND tm.trend_score > 0.3
ORDER BY tm.trend_score DESC;

CREATE INDEX idx_trending_restaurants_score ON trending_restaurants (trend_score DESC);
CREATE INDEX idx_trending_restaurants_location ON trending_restaurants
    USING GIST (ll_to_earth(latitude, longitude));

-- Refresh daily at 4 AM
```

#### YouTube Channels Entity
```sql
CREATE TABLE youtube_channels (
    id BIGSERIAL PRIMARY KEY,
    channel_id VARCHAR(255) UNIQUE NOT NULL,
    channel_handle VARCHAR(100),
    channel_name VARCHAR(255),

    -- Classification
    channel_type VARCHAR(50),  -- 'food_review', 'podcast', 'vlog', 'news'
    is_food_focused BOOLEAN DEFAULT TRUE,

    -- Metrics
    subscriber_count INT,
    video_count INT,
    avg_views INT,

    -- Geographic focus
    primary_cities TEXT[],  -- cities this channel typically covers

    -- Quality indicators
    quality_score DECIMAL(3, 2),  -- 0.0 to 1.0
    scraping_priority INT DEFAULT 5,  -- 1 (highest) to 10 (lowest)

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    last_scraped_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_youtube_channels_priority ON youtube_channels (scraping_priority, is_active);
CREATE INDEX idx_youtube_channels_type ON youtube_channels (channel_type);

-- Seed data for known food podcast channels
INSERT INTO youtube_channels (channel_id, channel_handle, channel_name, channel_type, scraping_priority, primary_cities) VALUES
    ('UCpko_-a4wgz2u_DgDgd9fqA', '@hotones', 'Hot Ones', 'podcast', 1, ARRAY['New York', 'Los Angeles']),
    ('UC7fyfH_b_9KdMa1gvGMDkMw', '@bobappetit', 'Bon Appétit', 'food_review', 1, ARRAY['New York']),
    ('UCbpMy0Fg74eXXkvxJrtEn3w', '@firstwefeast', 'First We Feast', 'podcast', 1, ARRAY['New York']),
    ('UCBqKFo8xuhQ4_72vJjxtxdA', '@worthit', 'Worth It', 'food_review', 2, ARRAY['Los Angeles', 'New York', 'Chicago']);
-- (add more as identified)
```

#### YouTube Transcripts Entity
```sql
CREATE TABLE youtube_transcripts (
    id BIGSERIAL PRIMARY KEY,
    video_id VARCHAR(255) UNIQUE NOT NULL,
    channel_id VARCHAR(255) REFERENCES youtube_channels(channel_id),

    -- Transcript data
    transcript_text TEXT,  -- full transcript
    transcript_segments JSONB,  -- [{"start": 10.5, "duration": 2.3, "text": "..."}]

    -- Extracted mentions
    restaurant_mentions JSONB,  -- [{"name": "Ramen Heaven", "timestamp": 125, "context": "..."}]

    -- Metadata
    language VARCHAR(10) DEFAULT 'en',
    generated_at TIMESTAMP,  -- when transcript was created
    scraped_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_youtube_transcripts_video ON youtube_transcripts (video_id);
CREATE INDEX idx_youtube_transcripts_channel ON youtube_transcripts (channel_id);
```

#### Users Entity
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100),

    -- Preferences
    default_location GEOGRAPHY(POINT),  -- PostGIS geography type
    default_city VARCHAR(100),
    default_radius_miles INT DEFAULT 15,
    preferences JSONB,  -- {"cuisines": ["Italian", "Japanese"], "price_levels": [2, 3]}

    -- Auth
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,

    -- Role
    role VARCHAR(50) DEFAULT 'user'  -- 'user', 'admin'
);

-- Indexes
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_created ON users (created_at DESC);
```

#### User Bookmarks Entity
```sql
CREATE TABLE user_bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,

    -- User notes
    notes TEXT,
    tags TEXT[],

    -- Status
    visited BOOLEAN DEFAULT FALSE,
    visited_at TIMESTAMP,
    rating INT CHECK (rating BETWEEN 1 AND 5),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT unique_bookmark UNIQUE (user_id, restaurant_id)
);

-- Indexes
CREATE INDEX idx_bookmarks_user ON user_bookmarks (user_id);
CREATE INDEX idx_bookmarks_created ON user_bookmarks (created_at DESC);
```

#### Scraping Jobs Entity
```sql
CREATE TABLE scraping_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL,  -- 'youtube_trending', 'instagram_hashtag', etc.
    platform VARCHAR(50) NOT NULL,

    -- Job parameters
    parameters JSONB,  -- {"hashtag": "#foodie", "location": "Austin"}

    -- Execution
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INT,

    -- Results
    items_processed INT DEFAULT 0,
    items_created INT DEFAULT 0,
    error_message TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    scheduled_for TIMESTAMP
);

-- Indexes
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs (status);
CREATE INDEX idx_scraping_jobs_scheduled ON scraping_jobs (scheduled_for);
CREATE INDEX idx_scraping_jobs_type ON scraping_jobs (job_type);
```

---

## 2. API Specifications

### 2.1 RESTful API Endpoints

#### Base URL
- **Production**: `https://api.restauranttrendscout.com/v1`
- **Staging**: `https://api-staging.restauranttrendscout.com/v1`
- **Development**: `http://localhost:8000/v1`

#### Authentication
All authenticated endpoints require JWT token in header:
```
Authorization: Bearer <jwt_token>
```

---

### 2.2 Trends Endpoints

#### GET /trends
Retrieve trending restaurants based on location and filters.

**Query Parameters:**
```typescript
interface TrendsQuery {
  // Location (required: either lat/lng OR location)
  latitude?: number;       // -90 to 90
  longitude?: number;      // -180 to 180
  location?: string;       // "Austin, TX" or "78701"
  radius_miles?: number;   // 5-50, default: 15

  // Filters
  cuisine?: string[];      // ["Italian", "Japanese"]
  price_level?: number[];  // [1, 2, 3, 4]
  trend_category?: 'hot' | 'rising' | 'new' | 'emerging';

  // Pagination
  limit?: number;          // 1-100, default: 20
  offset?: number;         // default: 0

  // Sorting
  sort?: 'trend_score' | 'distance' | 'mentions' | 'sentiment';
  order?: 'asc' | 'desc';  // default: 'desc'
}
```

**Response:**
```typescript
interface TrendsResponse {
  trends: Array<{
    restaurant: {
      id: number;
      name: string;
      address: string;
      city: string;
      state: string;
      latitude: number;
      longitude: number;
      cuisine_types: string[];
      price_level: number;  // 1-4
      phone?: string;
      website?: string;
      hours?: Record<string, { open: string; close: string }>;
    };
    trend: {
      score: number;          // 0.0 to 1.0+
      category: 'hot' | 'rising' | 'new' | 'emerging';
      rank: number;
      mention_count_7d: number;
      mention_growth: number; // % growth vs prior week
      avg_sentiment: number;  // -1.0 to 1.0
      engagement_total: number;
    };
    social_proof: {
      instagram_posts: number;
      youtube_videos: number;
      facebook_checkins: number;
      sample_posts: Array<{
        platform: string;
        user_handle: string;
        excerpt: string;
        posted_at: string;
        url: string;
      }>;
    };
    distance_miles: number;
  }>;
  total: number;
  page: number;
  pages: number;
  query: TrendsQuery;
}
```

**Example Request:**
```bash
GET /v1/trends?latitude=30.2672&longitude=-97.7431&radius_miles=10&cuisine=Japanese&limit=10
```

**Example Response:**
```json
{
  "trends": [
    {
      "restaurant": {
        "id": 12345,
        "name": "Ramen Heaven",
        "address": "123 Main St",
        "city": "Austin",
        "state": "TX",
        "latitude": 30.2672,
        "longitude": -97.7431,
        "cuisine_types": ["Japanese", "Ramen"],
        "price_level": 2,
        "phone": "(512) 555-0100",
        "website": "https://ramenheaven.com",
        "hours": {
          "monday": {"open": "11:00", "close": "22:00"},
          "tuesday": {"open": "11:00", "close": "22:00"}
        }
      },
      "trend": {
        "score": 0.85,
        "category": "hot",
        "rank": 1,
        "mention_count_7d": 145,
        "mention_growth": 230,
        "avg_sentiment": 0.92,
        "engagement_total": 15000
      },
      "social_proof": {
        "instagram_posts": 78,
        "youtube_videos": 5,
        "facebook_checkins": 62,
        "sample_posts": [
          {
            "platform": "instagram",
            "user_handle": "@foodie_jane",
            "excerpt": "Best ramen in Austin! The tonkotsu broth is incredible...",
            "posted_at": "2026-01-01T18:30:00Z",
            "url": "https://instagram.com/p/abc123"
          }
        ]
      },
      "distance_miles": 2.3
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 5,
  "query": {
    "latitude": 30.2672,
    "longitude": -97.7431,
    "radius_miles": 10,
    "cuisine": ["Japanese"],
    "limit": 10
  }
}
```

**Error Responses:**
```json
// 400 Bad Request
{
  "error": "validation_error",
  "message": "Either latitude/longitude or location must be provided",
  "details": {
    "field": "location",
    "code": "required"
  }
}

// 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "API rate limit exceeded. Try again in 60 seconds.",
  "retry_after": 60
}
```

---

#### GET /restaurants/{id}
Get detailed information about a specific restaurant.

**Path Parameters:**
- `id` (number): Restaurant ID

**Response:**
```typescript
interface RestaurantDetailResponse {
  restaurant: {
    id: number;
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    latitude: number;
    longitude: number;
    cuisine_types: string[];
    price_level: number;
    phone?: string;
    website?: string;
    email?: string;
    hours?: Record<string, { open: string; close: string }>;
    google_place_id?: string;
    instagram_handle?: string;
    facebook_page_id?: string;
  };
  trend_history: Array<{
    date: string;          // "2026-01-01"
    score: number;
    mentions: number;
    sentiment: number;
    rank: number;
  }>;
  recent_posts: Array<{
    id: number;
    platform: string;
    user_handle: string;
    user_name: string;
    user_followers: number;
    content: string;
    posted_at: string;
    likes: number;
    comments: number;
    engagement_rate: number;
    sentiment_score: number;
    url: string;
    media_urls: string[];
  }>;
  menu_highlights: string[];  // ["Tonkotsu Ramen", "Spicy Miso Bowl"]
  similar_restaurants: Array<{
    id: number;
    name: string;
    cuisine_types: string[];
    distance_miles: number;
    trend_score: number;
  }>;
}
```

---

#### GET /search
Search for restaurants by name, cuisine, or other criteria.

**Query Parameters:**
```typescript
interface SearchQuery {
  q: string;              // search query
  location?: string;      // "Austin, TX"
  latitude?: number;
  longitude?: number;
  radius_miles?: number;
  limit?: number;
  offset?: number;
}
```

**Response:**
```typescript
interface SearchResponse {
  results: Array<{
    restaurant: RestaurantBasic;
    relevance_score: number;  // 0.0 to 1.0
    match_type: 'name' | 'cuisine' | 'description';
    trend_score?: number;
  }>;
  total: number;
  query: SearchQuery;
}
```

---

### 2.3 User Endpoints

#### POST /auth/register
Register a new user account.

**Request Body:**
```typescript
interface RegisterRequest {
  email: string;
  password: string;      // min 8 chars
  name: string;
  location?: string;     // "Austin, TX"
}
```

**Response:**
```typescript
interface AuthResponse {
  user: {
    id: number;
    email: string;
    name: string;
  };
  access_token: string;
  refresh_token: string;
  expires_in: number;  // seconds
}
```

---

#### POST /auth/login
Authenticate and receive tokens.

**Request Body:**
```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response:** Same as register

---

#### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```typescript
interface RefreshRequest {
  refresh_token: string;
}
```

**Response:**
```typescript
interface RefreshResponse {
  access_token: string;
  expires_in: number;
}
```

---

#### GET /users/me
Get current user profile. **[Authenticated]**

**Response:**
```typescript
interface UserProfile {
  id: number;
  email: string;
  name: string;
  default_location: {
    latitude: number;
    longitude: number;
    city: string;
  };
  default_radius_miles: number;
  preferences: {
    cuisines: string[];
    price_levels: number[];
  };
  created_at: string;
}
```

---

#### PATCH /users/me
Update user profile. **[Authenticated]**

**Request Body:**
```typescript
interface UpdateProfileRequest {
  name?: string;
  default_location?: {
    latitude: number;
    longitude: number;
    city: string;
  };
  default_radius_miles?: number;
  preferences?: {
    cuisines?: string[];
    price_levels?: number[];
  };
}
```

---

#### GET /users/me/bookmarks
Get user's saved restaurants. **[Authenticated]**

**Response:**
```typescript
interface BookmarksResponse {
  bookmarks: Array<{
    id: number;
    restaurant: RestaurantBasic;
    notes?: string;
    tags: string[];
    visited: boolean;
    visited_at?: string;
    rating?: number;
    created_at: string;
  }>;
  total: number;
}
```

---

#### POST /users/me/bookmarks
Save a restaurant. **[Authenticated]**

**Request Body:**
```typescript
interface CreateBookmarkRequest {
  restaurant_id: number;
  notes?: string;
  tags?: string[];
}
```

---

#### DELETE /users/me/bookmarks/{restaurant_id}
Remove a saved restaurant. **[Authenticated]**

---

### 2.4 Rate Limiting

**Free Tier:**
- 100 requests per hour
- 1,000 requests per day

**Authenticated Users:**
- 500 requests per hour
- 10,000 requests per day

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000  // Unix timestamp
```

---

## 3. Scraping Specifications

### 3.1 YouTube Scraper

#### Data Sources
1. **YouTube Data API v3** (primary)
2. **Google Gemini API** (for transcripts)
3. **Open-source fallback**: `yt-dlp` for metadata

#### Implementation

**Technology Stack:**
```python
# requirements.txt
google-api-python-client==2.110.0
google-generativeai==0.3.2  # Gemini API
yt-dlp==2023.12.30
youtube-transcript-api==0.6.1
celery==5.3.4
redis==5.0.1
```

**Scraping Strategy:**

```python
# scrapers/youtube_scraper.py
from typing import List, Dict
import google.generativeai as genai
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
import yt_dlp

class YouTubeScraper:
    def __init__(self, api_key: str, gemini_api_key: str):
        self.youtube = build('youtube', 'v3', developerKey=api_key)
        genai.configure(api_key=gemini_api_key)
        self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')

    def scrape_channel_videos(self, channel_id: str, location: str) -> List[Dict]:
        """Scrape recent videos from a food podcast channel."""
        # Get recent uploads
        request = self.youtube.search().list(
            part="snippet",
            channelId=channel_id,
            maxResults=50,
            order="date",
            type="video",
            publishedAfter=(datetime.now() - timedelta(days=30)).isoformat() + 'Z'
        )
        response = request.execute()

        videos = []
        for item in response.get('items', []):
            video_id = item['id']['videoId']
            video_data = self.get_video_details(video_id, location)
            if video_data:
                videos.append(video_data)

        return videos

    def get_video_details(self, video_id: str, location: str) -> Dict:
        """Get full video details including transcript analysis."""
        # Get basic metadata
        request = self.youtube.videos().list(
            part="snippet,statistics",
            id=video_id
        )
        response = request.execute()

        if not response['items']:
            return None

        video = response['items'][0]
        snippet = video['snippet']
        stats = video['statistics']

        # Get transcript
        transcript = self.get_transcript(video_id)

        # Use Gemini to extract restaurant mentions
        mentions = self.extract_restaurants_with_gemini(
            transcript,
            snippet['title'],
            snippet['description'],
            location
        )

        return {
            'video_id': video_id,
            'channel_id': snippet['channelId'],
            'title': snippet['title'],
            'description': snippet['description'],
            'published_at': snippet['publishedAt'],
            'view_count': int(stats.get('viewCount', 0)),
            'like_count': int(stats.get('likeCount', 0)),
            'comment_count': int(stats.get('commentCount', 0)),
            'transcript': transcript,
            'restaurant_mentions': mentions
        }

    def get_transcript(self, video_id: str) -> str:
        """Get video transcript using youtube-transcript-api."""
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            transcript = ' '.join([item['text'] for item in transcript_list])
            return transcript
        except Exception as e:
            print(f"Failed to get transcript for {video_id}: {e}")
            return ""

    def extract_restaurants_with_gemini(
        self,
        transcript: str,
        title: str,
        description: str,
        location: str
    ) -> List[Dict]:
        """Use Google Gemini to extract restaurant mentions from transcript."""
        prompt = f"""
        Analyze this YouTube video about food/restaurants in {location}.

        Title: {title}
        Description: {description}
        Transcript: {transcript[:10000]}  # limit to 10K chars

        Extract all restaurant mentions with:
        1. Restaurant name
        2. Location/address if mentioned
        3. Type of cuisine
        4. Sentiment (positive/negative/neutral)
        5. Key phrases describing the restaurant
        6. Approximate timestamp in transcript

        Return as JSON array:
        [
          {{
            "name": "Restaurant Name",
            "location": "address or area",
            "cuisine": "cuisine type",
            "sentiment": "positive/negative/neutral",
            "context": "what was said about it",
            "timestamp_text": "approximate time in video"
          }}
        ]

        Only include restaurants explicitly mentioned in {location} area.
        Return empty array if no restaurants mentioned.
        """

        try:
            response = self.gemini_model.generate_content(prompt)
            mentions_json = response.text
            # Parse JSON response
            import json
            mentions = json.loads(mentions_json)
            return mentions
        except Exception as e:
            print(f"Gemini extraction failed: {e}")
            return []

    def scrape_trending_food_videos(self, location: str) -> List[Dict]:
        """Search for trending food videos in a location."""
        queries = [
            f"best new restaurants {location} 2026",
            f"food review {location}",
            f"where to eat {location}",
            f"{location} food guide",
        ]

        all_videos = []
        for query in queries:
            request = self.youtube.search().list(
                part="snippet",
                q=query,
                type="video",
                order="relevance",
                maxResults=25,
                publishedAfter=(datetime.now() - timedelta(days=30)).isoformat() + 'Z',
                relevanceLanguage="en",
                safeSearch="strict"
            )
            response = request.execute()

            for item in response.get('items', []):
                video_id = item['id']['videoId']
                video_data = self.get_video_details(video_id, location)
                if video_data:
                    all_videos.append(video_data)

        return all_videos
```

**Priority Channels List:**
```python
# config/youtube_channels.py
PRIORITY_FOOD_CHANNELS = [
    {
        "channel_id": "UCpko_-a4wgz2u_DgDgd9fqA",
        "name": "Hot Ones",
        "type": "podcast",
        "priority": 1,
        "cities": ["New York", "Los Angeles"]
    },
    {
        "channel_id": "UC7fyfH_b_9KdMa1gvGMDkMw",
        "name": "Bon Appétit",
        "type": "food_review",
        "priority": 1,
        "cities": ["New York"]
    },
    {
        "channel_id": "UCbpMy0Fg74eXXkvxJrtEn3w",
        "name": "First We Feast",
        "type": "podcast",
        "priority": 1,
        "cities": ["New York"]
    },
    {
        "channel_id": "UCBqKFo8xuhQ4_72vJjxtxdA",
        "name": "Worth It (BuzzFeed)",
        "type": "food_review",
        "priority": 2,
        "cities": ["Los Angeles", "New York", "Chicago"]
    },
    {
        "channel_id": "UCRzPUBhXUZHclB7B5bURFXw",
        "name": "Eater",
        "type": "food_news",
        "priority": 2,
        "cities": ["Multiple"]
    },
    {
        "channel_id": "UCxRKl2FHbDZVOhbOdXfUr5A",
        "name": "Mark Wiens",
        "type": "food_vlog",
        "priority": 3,
        "cities": ["International", "US Cities"]
    },
    # Add more channels as identified
]
```

**Celery Task:**
```python
# tasks/youtube_tasks.py
from celery import shared_task

@shared_task(bind=True, max_retries=3)
def scrape_youtube_channel(self, channel_id: str, location: str):
    """Celery task to scrape a YouTube channel."""
    try:
        scraper = YouTubeScraper(
            api_key=settings.YOUTUBE_API_KEY,
            gemini_api_key=settings.GEMINI_API_KEY
        )
        videos = scraper.scrape_channel_videos(channel_id, location)

        # Store in database
        for video in videos:
            store_youtube_video(video)

        return {"status": "success", "videos_scraped": len(videos)}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))

@shared_task
def scrape_youtube_trending(location: str):
    """Scrape trending food videos for a location."""
    scraper = YouTubeScraper(
        api_key=settings.YOUTUBE_API_KEY,
        gemini_api_key=settings.GEMINI_API_KEY
    )
    videos = scraper.scrape_trending_food_videos(location)

    for video in videos:
        store_youtube_video(video)

    return {"status": "success", "videos_scraped": len(videos)}
```

---

### 3.2 Instagram Scraper

#### Approach
**Primary**: Open-source libraries (no official API due to restrictions)
**Libraries**: `instaloader`, `instagram-scraper`, or custom Playwright-based scraper

**IMPORTANT**: If Instagram blocks scraping, this is optional and can be disabled.

#### Implementation (Open-Source)

```python
# scrapers/instagram_scraper.py
import instaloader
from typing import List, Dict
from datetime import datetime, timedelta

class InstagramScraper:
    def __init__(self):
        self.L = instaloader.Instaloader(
            download_videos=False,
            download_video_thumbnails=False,
            download_geotags=True,
            download_comments=True,
            save_metadata=False,
            compress_json=False,
        )

    def scrape_location_hashtags(self, hashtags: List[str], location: str) -> List[Dict]:
        """Scrape posts from location-specific hashtags."""
        all_posts = []

        for hashtag in hashtags:
            try:
                posts = instaloader.Hashtag.from_name(self.L.context, hashtag)

                for post in posts.get_posts():
                    # Only recent posts (last 30 days)
                    if post.date < datetime.now() - timedelta(days=30):
                        break

                    # Check if post is in target location
                    if not self._is_relevant_location(post, location):
                        continue

                    post_data = self._extract_post_data(post)
                    all_posts.append(post_data)

                    if len(all_posts) >= 100:  # Limit per hashtag
                        break

            except Exception as e:
                print(f"Error scraping hashtag {hashtag}: {e}")
                continue

        return all_posts

    def _is_relevant_location(self, post, target_location: str) -> bool:
        """Check if post is relevant to target location."""
        # Check location tag
        if post.location:
            if target_location.lower() in post.location.name.lower():
                return True

        # Check caption for location mentions
        if post.caption:
            if target_location.lower() in post.caption.lower():
                return True

        # Check hashtags
        if any(target_location.lower() in tag.lower() for tag in post.caption_hashtags):
            return True

        return False

    def _extract_post_data(self, post) -> Dict:
        """Extract relevant data from Instagram post."""
        return {
            'post_id': post.shortcode,
            'post_url': f'https://instagram.com/p/{post.shortcode}',
            'user_id': post.owner_username,
            'user_handle': post.owner_username,
            'user_followers': post.owner_profile.followers if post.owner_profile else 0,
            'caption': post.caption,
            'hashtags': list(post.caption_hashtags),
            'mentions': list(post.caption_mentions),
            'posted_at': post.date.isoformat(),
            'likes': post.likes,
            'comments': post.comments,
            'location_text': post.location.name if post.location else None,
            'media_urls': [post.url],
            'is_video': post.is_video,
        }

    def scrape_user_posts(self, username: str) -> List[Dict]:
        """Scrape posts from a food influencer account."""
        try:
            profile = instaloader.Profile.from_username(self.L.context, username)
            posts = []

            for post in profile.get_posts():
                if post.date < datetime.now() - timedelta(days=30):
                    break

                posts.append(self._extract_post_data(post))

                if len(posts) >= 50:
                    break

            return posts
        except Exception as e:
            print(f"Error scraping user {username}: {e}")
            return []
```

**Hashtags to Monitor:**
```python
# config/instagram_config.py
FOOD_HASHTAGS_BY_CITY = {
    "Austin": [
        "austinfood",
        "austinfoodie",
        "atxfood",
        "eataustin",
        "austineats",
        "austinrestaurants",
        "atxfoodie",
    ],
    "New York": [
        "nycfood",
        "nycfoodie",
        "newyorkfood",
        "nycrestaurants",
        "nyceats",
    ],
    # Add more cities
}

GENERIC_FOOD_HASHTAGS = [
    "foodie",
    "foodstagram",
    "instafood",
    "foodporn",
    "newrestaurant",
    "restaurantreview",
]
```

**Mitigation for Instagram Blocking:**
```python
# If Instagram scraping is blocked:
# 1. Disable Instagram scraper entirely
# 2. Focus on YouTube and Facebook only
# 3. Add alternative sources:
#    - TikTok (via open-source scrapers)
#    - Reddit (via PRAW API)
#    - Twitter/X (via API)

# config/settings.py
SCRAPING_ENABLED = {
    'youtube': True,
    'instagram': False,  # Disabled if blocked
    'facebook': True,
    'tiktok': False,     # Future
    'reddit': False,     # Future
}
```

---

### 3.3 Facebook Scraper

#### Approach
**Primary**: Facebook Graph API (official)
**Fallback**: Selenium/Playwright for public pages

#### Implementation

```python
# scrapers/facebook_scraper.py
import requests
from typing import List, Dict

class FacebookScraper:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = "https://graph.facebook.com/v18.0"

    def get_page_info(self, page_id: str) -> Dict:
        """Get restaurant page information."""
        url = f"{self.base_url}/{page_id}"
        params = {
            'fields': 'id,name,about,category,location,phone,website,overall_star_rating,rating_count,fan_count,checkins,hours',
            'access_token': self.access_token
        }

        response = requests.get(url, params=params)
        return response.json()

    def get_page_posts(self, page_id: str, limit: int = 25) -> List[Dict]:
        """Get recent posts from a restaurant page."""
        url = f"{self.base_url}/{page_id}/posts"
        params = {
            'fields': 'id,message,created_time,reactions.summary(true),comments.summary(true),shares',
            'limit': limit,
            'access_token': self.access_token
        }

        response = requests.get(url, params=params)
        data = response.json()
        return data.get('data', [])

    def search_pages(self, query: str, location: str) -> List[Dict]:
        """Search for restaurant pages in a location."""
        url = f"{self.base_url}/search"
        params = {
            'q': query,
            'type': 'page',
            'fields': 'id,name,location,category',
            'access_token': self.access_token
        }

        response = requests.get(url, params=params)
        data = response.json()

        # Filter by location
        pages = [
            page for page in data.get('data', [])
            if page.get('location', {}).get('city', '').lower() == location.lower()
        ]

        return pages
```

---

## 4. Trend Analysis Algorithm

### 4.1 Trend Score Calculation

**Complete Implementation:**

```python
# analytics/trend_calculator.py
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class TrendMetrics:
    mention_velocity: float
    engagement_rate: float
    sentiment_score: float
    influencer_amplification: float
    geographic_concentration: float
    overall_score: float
    category: str

class TrendCalculator:
    # Weighting factors
    WEIGHTS = {
        'mention_velocity': 0.35,
        'engagement_rate': 0.25,
        'sentiment_score': 0.20,
        'influencer_amplification': 0.10,
        'geographic_concentration': 0.10,
    }

    # Thresholds for categorization
    THRESHOLDS = {
        'hot': 0.7,      # Score >= 0.7
        'rising': 0.4,   # Score >= 0.4 and < 0.7
        'emerging': 0.2, # Score >= 0.2 and < 0.4
    }

    def __init__(self, db_connection):
        self.db = db_connection

    def calculate_trend_score(
        self,
        restaurant_id: int,
        date: datetime
    ) -> TrendMetrics:
        """Calculate comprehensive trend score for a restaurant."""

        # Get mentions for last 7 days and prior 7 days
        recent_window = (date - timedelta(days=7), date)
        prior_window = (date - timedelta(days=14), date - timedelta(days=7))

        recent_mentions = self._get_mentions(restaurant_id, *recent_window)
        prior_mentions = self._get_mentions(restaurant_id, *prior_window)

        # Calculate individual components
        mention_velocity = self._calculate_mention_velocity(
            recent_mentions, prior_mentions
        )
        engagement_rate = self._calculate_engagement_rate(recent_mentions)
        sentiment_score = self._calculate_sentiment_score(recent_mentions)
        influencer_amp = self._calculate_influencer_amplification(recent_mentions)
        geo_concentration = self._calculate_geographic_concentration(
            restaurant_id, recent_mentions
        )

        # Calculate weighted score
        overall_score = (
            self.WEIGHTS['mention_velocity'] * mention_velocity +
            self.WEIGHTS['engagement_rate'] * engagement_rate +
            self.WEIGHTS['sentiment_score'] * sentiment_score +
            self.WEIGHTS['influencer_amplification'] * influencer_amp +
            self.WEIGHTS['geographic_concentration'] * geo_concentration
        )

        # Determine category
        category = self._categorize_trend(overall_score, recent_mentions)

        return TrendMetrics(
            mention_velocity=mention_velocity,
            engagement_rate=engagement_rate,
            sentiment_score=sentiment_score,
            influencer_amplification=influencer_amp,
            geographic_concentration=geo_concentration,
            overall_score=overall_score,
            category=category
        )

    def _calculate_mention_velocity(
        self,
        recent: List[Dict],
        prior: List[Dict]
    ) -> float:
        """Calculate mention growth velocity (0.0 to 1.0+)."""
        recent_count = len(recent)
        prior_count = len(prior)

        # Handle edge cases
        if prior_count == 0:
            # New restaurant: high score if sufficient mentions
            return 1.0 if recent_count >= 5 else 0.0

        # Calculate % growth, cap at 300%
        growth = (recent_count - prior_count) / prior_count
        velocity = min(max(growth, 0), 3.0) / 3.0  # Normalize to 0-1

        return velocity

    def _calculate_engagement_rate(self, mentions: List[Dict]) -> float:
        """Calculate average engagement rate (0.0 to 1.0)."""
        if not mentions:
            return 0.0

        total_engagement = sum(
            m['likes'] + m['comments'] + m['shares']
            for m in mentions
        )
        total_impressions = sum(m['user_followers'] for m in mentions)

        if total_impressions == 0:
            return 0.0

        # Typical good engagement rate is 3-5%, cap at 10%
        rate = total_engagement / total_impressions
        normalized = min(rate, 0.10) / 0.10

        return normalized

    def _calculate_sentiment_score(self, mentions: List[Dict]) -> float:
        """Calculate average sentiment (0.0 to 1.0)."""
        if not mentions:
            return 0.0

        sentiments = [m['sentiment_score'] for m in mentions if m['sentiment_score'] is not None]

        if not sentiments:
            return 0.5  # Neutral if no sentiment data

        avg_sentiment = np.mean(sentiments)  # -1.0 to 1.0
        normalized = (avg_sentiment + 1.0) / 2.0  # Convert to 0.0 to 1.0

        return normalized

    def _calculate_influencer_amplification(self, mentions: List[Dict]) -> float:
        """Calculate influencer amplification factor (0.0 to 1.0)."""
        if not mentions:
            return 0.0

        # Influencer = 10K+ followers
        influencer_mentions = [
            m for m in mentions
            if m['user_followers'] >= 10000
        ]

        ratio = len(influencer_mentions) / len(mentions)
        return ratio

    def _calculate_geographic_concentration(
        self,
        restaurant_id: int,
        mentions: List[Dict]
    ) -> float:
        """Calculate what % of mentions are from target area (0.0 to 1.0)."""
        if not mentions:
            return 0.0

        # Get restaurant location
        restaurant = self._get_restaurant(restaurant_id)
        r_lat, r_lng = restaurant['latitude'], restaurant['longitude']

        # Count mentions within 25 miles
        nearby_mentions = [
            m for m in mentions
            if m['latitude'] and m['longitude'] and
            self._distance_miles(r_lat, r_lng, m['latitude'], m['longitude']) <= 25
        ]

        ratio = len(nearby_mentions) / len(mentions)
        return ratio

    def _categorize_trend(self, score: float, mentions: List[Dict]) -> str:
        """Categorize trend based on score and other factors."""
        mention_count = len(mentions)

        # Check if new (restaurant first appeared < 14 days ago)
        is_new = self._is_new_restaurant(mentions)

        if score >= self.THRESHOLDS['hot']:
            return 'hot'
        elif score >= self.THRESHOLDS['rising']:
            return 'rising'
        elif is_new and score >= self.THRESHOLDS['emerging']:
            return 'new'
        elif score >= self.THRESHOLDS['emerging']:
            return 'emerging'
        else:
            return None  # Not trending

    def _is_new_restaurant(self, mentions: List[Dict]) -> bool:
        """Check if restaurant is newly discovered (first mention < 14 days)."""
        if not mentions:
            return False

        earliest_mention = min(m['posted_at'] for m in mentions)
        days_since_first = (datetime.now() - earliest_mention).days

        return days_since_first <= 14

    def _distance_miles(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points in miles."""
        from math import radians, cos, sin, asin, sqrt

        # Haversine formula
        lon1, lat1, lon2, lat2 = map(radians, [lng1, lat1, lng2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        miles = 3956 * c  # Earth radius in miles

        return miles

    def _get_mentions(self, restaurant_id: int, start_date: datetime, end_date: datetime) -> List[Dict]:
        """Fetch mentions from database."""
        # Query database for mentions in date range
        query = """
            SELECT sp.*, rm.mention_text, rm.confidence
            FROM social_posts sp
            JOIN restaurant_mentions rm ON sp.id = rm.post_id
            WHERE rm.restaurant_id = %s
            AND sp.posted_at BETWEEN %s AND %s
            AND rm.confidence >= 0.7
            ORDER BY sp.posted_at DESC
        """

        return self.db.execute(query, [restaurant_id, start_date, end_date])

    def _get_restaurant(self, restaurant_id: int) -> Dict:
        """Fetch restaurant from database."""
        query = "SELECT * FROM restaurants WHERE id = %s"
        return self.db.execute_one(query, [restaurant_id])
```

### 4.2 Anomaly Detection

**Filter out artificial trends:**

```python
# analytics/anomaly_detector.py
from typing import Dict, List
from scipy import stats
import numpy as np

class AnomalyDetector:
    def is_artificial_trend(self, mentions: List[Dict]) -> bool:
        """Detect if trend is artificial (bots, paid promotion)."""

        checks = [
            self._check_bot_accounts(mentions),
            self._check_paid_promotion(mentions),
            self._check_temporal_anomaly(mentions),
            self._check_low_quality(mentions),
        ]

        # If 2 or more checks fail, flag as artificial
        return sum(checks) >= 2

    def _check_bot_accounts(self, mentions: List[Dict]) -> bool:
        """Check for bot account patterns."""
        bot_indicators = 0

        for m in mentions:
            # Low follower count
            if m['user_followers'] < 100:
                bot_indicators += 1

            # Generic username pattern
            if self._is_generic_username(m['user_handle']):
                bot_indicators += 1

        # More than 30% bot-like accounts
        return (bot_indicators / len(mentions)) > 0.3

    def _check_paid_promotion(self, mentions: List[Dict]) -> bool:
        """Check for paid promotion indicators."""
        paid_count = 0

        for m in mentions:
            content = (m['content'] or '').lower()
            hashtags = [h.lower() for h in m['hashtags']]

            # Check for paid hashtags
            paid_hashtags = ['#ad', '#sponsored', '#partner', '#promo']
            if any(tag in hashtags for tag in paid_hashtags):
                paid_count += 1
                continue

            # Check for disclosure language
            paid_terms = ['sponsored', 'partnership', 'paid promotion', '#ad']
            if any(term in content for term in paid_terms):
                paid_count += 1

        # More than 20% paid mentions
        return (paid_count / len(mentions)) > 0.2

    def _check_temporal_anomaly(self, mentions: List[Dict]) -> bool:
        """Check for unnatural posting patterns."""
        if len(mentions) < 10:
            return False

        # Get posting timestamps
        timestamps = [m['posted_at'].timestamp() for m in mentions]
        timestamps.sort()

        # Calculate intervals between posts
        intervals = np.diff(timestamps)

        # Check if intervals are suspiciously regular (bot pattern)
        # Real posts have irregular intervals, bots post at regular intervals
        std_dev = np.std(intervals)
        mean_interval = np.mean(intervals)

        # Coefficient of variation < 0.3 suggests regular pattern
        cv = std_dev / mean_interval if mean_interval > 0 else 0

        return cv < 0.3

    def _check_low_quality(self, mentions: List[Dict]) -> bool:
        """Check for low-quality content."""
        low_quality_count = 0

        for m in mentions:
            content = m['content'] or ''

            # Very short content
            if len(content) < 20:
                low_quality_count += 1
                continue

            # No engagement despite followers
            if m['user_followers'] > 1000 and (m['likes'] + m['comments']) < 10:
                low_quality_count += 1

        # More than 40% low quality
        return (low_quality_count / len(mentions)) > 0.4

    def _is_generic_username(self, username: str) -> bool:
        """Check if username follows generic pattern."""
        import re

        # Patterns: user1234, foodie_567, name.123
        generic_patterns = [
            r'^user\d+$',
            r'^[a-z]+_?\d{3,}$',
            r'^[a-z]+\.\d+$',
        ]

        return any(re.match(pattern, username.lower()) for pattern in generic_patterns)
```

---

## 5. Deployment Specifications

### 5.1 Docker Configuration

**Multi-stage Python Dockerfile:**

```dockerfile
# Dockerfile for API service
FROM python:3.11-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Docker Compose for local development:**

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: restaurant_trends
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/schema.sql:/docker-entrypoint-initdb.d/schema.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/restaurant_trends
      REDIS_URL: redis://redis:6379
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A tasks worker --loglevel=info
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/restaurant_trends
      REDIS_URL: redis://redis:6379
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
    depends_on:
      - postgres
      - redis

  scheduler:
    build:
      context: .
      dockerfile: Dockerfile
    command: celery -A tasks beat --loglevel=info
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/restaurant_trends
      REDIS_URL: redis://redis:6379
    depends_on:
      - redis

volumes:
  postgres_data:
```

---

### 5.2 Environment Configuration

```bash
# .env.example
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/restaurant_trends
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_MAX_CONNECTIONS=50

# APIs
YOUTUBE_API_KEY=your_youtube_api_key
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_PLACES_API_KEY=your_places_api_key
FACEBOOK_ACCESS_TOKEN=your_facebook_token

# JWT
JWT_SECRET_KEY=your_secret_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Scraping
SCRAPING_ENABLED_YOUTUBE=true
SCRAPING_ENABLED_INSTAGRAM=false
SCRAPING_ENABLED_FACEBOOK=true

# Rate Limiting
RATE_LIMIT_FREE=100/hour
RATE_LIMIT_AUTHENTICATED=500/hour

# Application
DEBUG=false
LOG_LEVEL=INFO
ALLOWED_HOSTS=api.restauranttrendscout.com
CORS_ORIGINS=https://restauranttrendscout.com

# AWS (if using)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=restaurant-trends-media
```

---

## 6. Testing Specifications

### Unit Test Example
```python
# tests/test_trend_calculator.py
import pytest
from analytics.trend_calculator import TrendCalculator

def test_mention_velocity_calculation():
    calculator = TrendCalculator(mock_db)

    recent = [{'id': i} for i in range(20)]  # 20 mentions
    prior = [{'id': i} for i in range(10)]   # 10 mentions

    velocity = calculator._calculate_mention_velocity(recent, prior)

    # 100% growth should give velocity of 0.33 (1.0/3.0)
    assert velocity == pytest.approx(0.33, rel=0.01)

def test_engagement_rate_calculation():
    calculator = TrendCalculator(mock_db)

    mentions = [
        {'likes': 100, 'comments': 50, 'shares': 25, 'user_followers': 10000},
        {'likes': 200, 'comments': 100, 'shares': 50, 'user_followers': 20000},
    ]

    engagement = calculator._calculate_engagement_rate(mentions)

    # (475 / 30000) / 0.10 = 0.158
    assert engagement == pytest.approx(0.158, rel=0.01)
```

---

**Document Status**: Ready for implementation
**Next Steps**: Review with team, begin sprint 1 development

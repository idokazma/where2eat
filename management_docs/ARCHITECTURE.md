# Technical Architecture Document
## Restaurant Trend Scout

**Document Version:** 1.0
**Last Updated:** 2026-01-01
**Owner:** CTO Office
**Status:** Draft

---

## Executive Summary

This document outlines the technical architecture for Restaurant Trend Scout, a distributed system that scrapes social media platforms, analyzes restaurant trends, and delivers location-based recommendations. The architecture prioritizes scalability, resilience, and modularity to support rapid iteration and growth.

---

## Architecture Principles

### Core Principles
1. **Separation of Concerns**: Distinct services for scraping, analysis, and presentation
2. **Horizontal Scalability**: All components can scale independently
3. **Fault Isolation**: Failures in one component don't cascade
4. **Data-Driven**: Architecture supports extensive analytics and ML
5. **Cloud-Native**: Designed for containerized deployment
6. **API-First**: Internal services communicate via well-defined APIs

### Technical Values
- **Pragmatism over Perfection**: Ship working solutions, iterate based on data
- **Open Source First**: Leverage proven OSS tools before building custom
- **Observability**: Comprehensive logging, monitoring, and tracing
- **Security by Design**: Authentication, encryption, and privacy built-in
- **Cost Efficiency**: Optimize for compute and storage costs

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Web App      │  │ Mobile App   │  │ API Clients  │          │
│  │ (React)      │  │ (Future)     │  │ (Future)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  API Gateway (Kong/AWS API Gateway)                      │   │
│  │  - Authentication & Authorization                        │   │
│  │  - Rate Limiting                                         │   │
│  │  - Request Routing                                       │   │
│  │  - SSL Termination                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐
│              │  │                  │  │                  │
│ APPLICATION LAYER                                       │
│              │  │                  │  │                  │
├──────────────┤  ├──────────────────┤  ├──────────────────┤
│  User API    │  │  Trend Engine    │  │  Data Ingest     │
│  Service     │  │  Service         │  │  Orchestrator    │
│              │  │                  │  │                  │
│  - Auth      │  │  - Analysis      │  │  - Scheduling    │
│  - Search    │  │  - Ranking       │  │  - Job Queue     │
│  - Details   │  │  - Filtering     │  │  - Monitoring    │
│  - Bookmarks │  │  - Aggregation   │  │                  │
└──────────────┘  └──────────────────┘  └──────────────────┘
        │                  │                      │
        │                  │                      │
        └──────────────────┼──────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ PostgreSQL   │  │ Redis        │  │ S3/Object    │          │
│  │ (Primary)    │  │ (Cache)      │  │ Storage      │          │
│  │              │  │              │  │              │          │
│  │ - Users      │  │ - Sessions   │  │ - Images     │          │
│  │ - Restaurants│  │ - Trends     │  │ - Logs       │          │
│  │ - Posts      │  │ - API Cache  │  │ - Backups    │          │
│  │ - Analytics  │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                           ▲
                           │
┌─────────────────────────────────────────────────────────────────┐
│                   SCRAPING AGENT LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ YouTube      │  │ Instagram    │  │ Facebook     │          │
│  │ Scraper      │  │ Scraper      │  │ Scraper      │          │
│  │ Agent        │  │ Agent        │  │ Agent        │          │
│  │              │  │              │  │              │          │
│  │ - Video data │  │ - Post data  │  │ - Page data  │          │
│  │ - Comments   │  │ - Hashtags   │  │ - Events     │          │
│  │ - Metadata   │  │ - Stories    │  │ - Reviews    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Google       │  │ Yelp         │  │ Generic Web  │          │
│  │ Places       │  │ Scraper      │  │ Scraper      │          │
│  │ API Client   │  │ Agent        │  │ Agent        │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ YouTube API  │  │ Instagram    │  │ Facebook     │          │
│  │              │  │ Graph API    │  │ Graph API    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Google       │  │ Geocoding    │  │ SendGrid     │          │
│  │ Places API   │  │ Service      │  │ (Email)      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Scraping Agent Layer

#### Purpose
Autonomous agents that collect data from social media platforms and external APIs.

#### Components

##### 1.1 YouTube Scraper Agent
**Technology Stack:**
- Language: Python 3.11+
- Framework: Scrapy / Playwright
- Queue: Celery with Redis broker
- Storage: PostgreSQL + S3

**Responsibilities:**
- Search for restaurant-related content by location
- Extract video metadata (title, description, views, likes)
- Parse comments for restaurant mentions
- Download thumbnails for trend previews
- Detect food influencer channels
- Rate limit compliance (10K API units/day)

**Data Collected:**
```json
{
  "video_id": "abc123",
  "channel_id": "channel_xyz",
  "title": "Best New Restaurants in Austin 2026",
  "published_at": "2026-01-01T12:00:00Z",
  "view_count": 50000,
  "like_count": 2500,
  "comment_count": 150,
  "channel_subscribers": 100000,
  "restaurant_mentions": [
    {
      "name": "Taco Bliss",
      "timestamp": "2:35",
      "context": "amazing breakfast tacos"
    }
  ],
  "sentiment": 0.85,
  "location_tags": ["Austin", "TX"]
}
```

**Scaling Strategy:**
- Horizontal scaling via Celery workers
- Distributed queue for parallel processing
- API quota management across multiple keys

---

##### 1.2 Instagram Scraper Agent
**Technology Stack:**
- Language: Python 3.11+
- Library: Instaloader / Custom API wrapper
- Headless Browser: Playwright (for non-API scraping)
- Queue: Celery with Redis broker

**Responsibilities:**
- Monitor location-based hashtags (#foodie, #newrestaurant, etc.)
- Track food influencer accounts
- Extract post metadata and engagement
- Download images for trend visualization
- Parse captions for restaurant mentions
- Track stories (24h window)

**Data Collected:**
```json
{
  "post_id": "C1234567890",
  "user_id": "foodie_jane",
  "user_followers": 50000,
  "caption": "Obsessed with the new ramen spot downtown! 🍜 @ramen_heaven",
  "hashtags": ["#ramen", "#foodie", "#austin", "#newrestaurant"],
  "mentions": ["@ramen_heaven"],
  "location": {
    "name": "Downtown Austin",
    "latitude": 30.2672,
    "longitude": -97.7431
  },
  "posted_at": "2026-01-01T18:30:00Z",
  "likes": 3500,
  "comments": 120,
  "engagement_rate": 0.072,
  "restaurant_detected": "Ramen Heaven"
}
```

**Anti-Detection Measures:**
- Rotating proxies
- Random delays between requests
- User-agent rotation
- Session management
- Cookie persistence

---

##### 1.3 Facebook Scraper Agent
**Technology Stack:**
- Language: Python 3.11+
- API: Facebook Graph API
- Fallback: Selenium/Playwright for public pages
- Queue: Celery with Redis broker

**Responsibilities:**
- Monitor restaurant pages for activity
- Track check-ins and reviews
- Extract event data (restaurant openings, pop-ups)
- Analyze page engagement metrics
- Parse user reviews and ratings

**Data Collected:**
```json
{
  "page_id": "123456789",
  "page_name": "Burger Paradise Austin",
  "page_category": "Restaurant",
  "fan_count": 5000,
  "checkins": 1200,
  "overall_rating": 4.7,
  "rating_count": 350,
  "recent_posts": [
    {
      "post_id": "123456789_987654321",
      "message": "New truffle burger launching this weekend!",
      "created_time": "2026-01-01T10:00:00Z",
      "reactions": 450,
      "comments": 78,
      "shares": 34
    }
  ],
  "events": [
    {
      "event_id": "event_123",
      "name": "Grand Opening Party",
      "start_time": "2026-01-15T18:00:00Z",
      "attending_count": 250
    }
  ]
}
```

---

##### 1.4 Google Places API Client
**Technology Stack:**
- Language: Python 3.11+
- API: Google Places API
- Caching: Redis (24h TTL)

**Responsibilities:**
- Fetch restaurant details (address, phone, hours)
- Get price level and rating
- Retrieve photos
- Validate restaurant existence
- Geocode addresses

**Rate Limiting:**
- 100 requests per 100 seconds
- Caching to minimize API calls
- Batch requests where possible

---

##### 1.5 Agent Orchestrator
**Technology Stack:**
- Language: Python 3.11+
- Framework: Apache Airflow / Prefect
- Monitoring: Prometheus + Grafana

**Responsibilities:**
- Schedule scraping jobs
- Manage agent lifecycle
- Monitor job health
- Handle failures and retries
- Coordinate multi-stage pipelines
- Resource allocation

**Scheduling Strategy:**
```yaml
scraping_schedule:
  instagram_trending_hashtags:
    frequency: "*/4 * * * *"  # Every 4 hours
    priority: HIGH
    timeout: 30min

  youtube_new_videos:
    frequency: "0 */6 * * *"  # Every 6 hours
    priority: MEDIUM
    timeout: 45min

  facebook_page_updates:
    frequency: "0 */8 * * *"  # Every 8 hours
    priority: MEDIUM
    timeout: 30min

  google_places_refresh:
    frequency: "0 2 * * *"    # Daily at 2 AM
    priority: LOW
    timeout: 60min
```

---

### 2. Data Ingest Pipeline

#### Purpose
Process, validate, and store scraped data; trigger downstream analysis.

#### Components

##### 2.1 Data Validator
**Responsibilities:**
- Schema validation
- Duplicate detection
- Data quality checks
- Restaurant name normalization
- Location geocoding

**Validation Rules:**
```python
validation_rules = {
    "post": {
        "required_fields": ["platform", "post_id", "content", "timestamp"],
        "timestamp_range": "last_90_days",
        "min_content_length": 10,
        "valid_platforms": ["youtube", "instagram", "facebook"]
    },
    "restaurant_mention": {
        "required_fields": ["name", "location"],
        "min_confidence": 0.7,
        "location_format": "geocoded"
    }
}
```

##### 2.2 Restaurant Entity Resolver
**Technology Stack:**
- Language: Python 3.11+
- NLP: spaCy + custom NER model
- Fuzzy Matching: RapidFuzz
- Database: PostgreSQL with trigram indexing

**Responsibilities:**
- Extract restaurant names from text
- Resolve name variations (e.g., "Joe's Pizza" vs "Joe's Pizzeria")
- Merge duplicate entities
- Link social mentions to canonical restaurant records
- Geocode addresses

**Algorithm:**
```
1. Extract potential restaurant names using NER
2. Normalize name (lowercase, remove punctuation)
3. Search existing restaurants using trigram similarity
4. If similarity > 0.85: Link to existing
5. If 0.65 < similarity < 0.85: Queue for manual review
6. If similarity < 0.65: Create new restaurant entity
7. Enrich with Google Places API data
8. Geocode location
```

##### 2.3 Data Storage Layer
**PostgreSQL Schema:**

```sql
-- Core entities
CREATE TABLE restaurants (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    cuisine_types TEXT[],
    price_level INT CHECK (price_level BETWEEN 1 AND 4),
    phone VARCHAR(20),
    website VARCHAR(500),
    google_place_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_restaurant UNIQUE (normalized_name, city, state)
);

CREATE INDEX idx_restaurants_location ON restaurants USING GIST (
    ll_to_earth(latitude, longitude)
);
CREATE INDEX idx_restaurants_normalized_name ON restaurants
    USING gin (normalized_name gin_trgm_ops);

-- Social media posts
CREATE TABLE social_posts (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    post_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    user_handle VARCHAR(100),
    user_followers INT,
    content TEXT,
    posted_at TIMESTAMP NOT NULL,
    scraped_at TIMESTAMP DEFAULT NOW(),
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    shares INT DEFAULT 0,
    engagement_rate DECIMAL(5, 4),
    sentiment_score DECIMAL(3, 2),
    location_text VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    media_urls TEXT[],
    hashtags TEXT[],
    CONSTRAINT unique_post UNIQUE (platform, post_id)
);

CREATE INDEX idx_social_posts_posted_at ON social_posts (posted_at DESC);
CREATE INDEX idx_social_posts_platform ON social_posts (platform);
CREATE INDEX idx_social_posts_location ON social_posts USING GIST (
    ll_to_earth(latitude, longitude)
);

-- Restaurant mentions in posts
CREATE TABLE restaurant_mentions (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
    post_id BIGINT REFERENCES social_posts(id) ON DELETE CASCADE,
    mention_text VARCHAR(500),
    confidence DECIMAL(3, 2),
    context TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_mention UNIQUE (restaurant_id, post_id)
);

CREATE INDEX idx_mentions_restaurant ON restaurant_mentions (restaurant_id);
CREATE INDEX idx_mentions_post ON restaurant_mentions (post_id);

-- Trend metrics (pre-computed)
CREATE TABLE trend_metrics (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mention_count INT DEFAULT 0,
    total_engagement INT DEFAULT 0,
    avg_sentiment DECIMAL(3, 2),
    unique_users INT DEFAULT 0,
    platform_breakdown JSONB,
    trend_score DECIMAL(10, 4),
    trend_velocity DECIMAL(10, 4),
    rank INT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_trend_metric UNIQUE (restaurant_id, date)
);

CREATE INDEX idx_trend_metrics_date ON trend_metrics (date DESC);
CREATE INDEX idx_trend_metrics_score ON trend_metrics (trend_score DESC);
CREATE INDEX idx_trend_metrics_restaurant ON trend_metrics (restaurant_id);

-- User data
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(100),
    default_location GEOGRAPHY(POINT),
    default_radius_miles INT DEFAULT 15,
    preferences JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE user_bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_bookmark UNIQUE (user_id, restaurant_id)
);
```

---

### 3. Trend Analysis Engine

#### Purpose
Analyze scraped data to identify trending restaurants using statistical and ML methods.

#### Components

##### 3.1 Trend Scoring Algorithm
**Technology Stack:**
- Language: Python 3.11+
- Libraries: NumPy, Pandas, SciPy
- ML: scikit-learn (future: custom models)

**Scoring Formula:**
```
Trend Score = (
    0.35 × Mention Velocity +
    0.25 × Engagement Rate +
    0.20 × Sentiment Score +
    0.10 × Influencer Amplification +
    0.10 × Geographic Concentration
)

Where:
- Mention Velocity = (mentions_last_7d - mentions_prior_7d) / mentions_prior_7d
- Engagement Rate = total_engagement / total_impressions
- Sentiment Score = avg_sentiment (from -1 to +1, normalized to 0-1)
- Influencer Amplification = mentions_from_influencers / total_mentions
- Geographic Concentration = mentions_in_target_area / total_mentions
```

**Implementation:**
```python
def calculate_trend_score(restaurant_id: int, date: datetime) -> float:
    """Calculate trend score for a restaurant on given date."""

    # Get mentions for last 7 days and prior 7 days
    recent_mentions = get_mentions(restaurant_id, date - 7d, date)
    prior_mentions = get_mentions(restaurant_id, date - 14d, date - 7d)

    # Mention velocity
    if len(prior_mentions) == 0:
        mention_velocity = 1.0 if len(recent_mentions) > 5 else 0.0
    else:
        mention_velocity = min((len(recent_mentions) - len(prior_mentions)) / len(prior_mentions), 3.0) / 3.0

    # Engagement rate
    total_engagement = sum(m.likes + m.comments + m.shares for m in recent_mentions)
    total_impressions = sum(m.user_followers for m in recent_mentions)
    engagement_rate = min(total_engagement / max(total_impressions, 1), 0.1) / 0.1

    # Sentiment
    avg_sentiment = np.mean([m.sentiment_score for m in recent_mentions])
    sentiment_normalized = (avg_sentiment + 1) / 2  # -1 to 1 -> 0 to 1

    # Influencer amplification (users with 10K+ followers)
    influencer_mentions = [m for m in recent_mentions if m.user_followers >= 10000]
    influencer_amplification = len(influencer_mentions) / max(len(recent_mentions), 1)

    # Geographic concentration
    target_area_mentions = [m for m in recent_mentions if is_in_target_area(m, restaurant_id)]
    geo_concentration = len(target_area_mentions) / max(len(recent_mentions), 1)

    # Weighted score
    score = (
        0.35 * mention_velocity +
        0.25 * engagement_rate +
        0.20 * sentiment_normalized +
        0.10 * influencer_amplification +
        0.10 * geo_concentration
    )

    return min(score, 1.0)
```

##### 3.2 Anomaly Detection
**Purpose:** Filter out artificial trends (paid promotions, bot activity)

**Methods:**
- Statistical outlier detection (Z-score > 3 for sudden spikes)
- Bot account detection (low followers, generic names, rapid posting)
- Paid promotion detection (hashtag patterns like #ad, #sponsored)
- Temporal pattern analysis (unnatural posting times)

##### 3.3 Trend Categorization
**Categories:**
- 🔥 **Hot**: High trend score (> 0.7), sustained momentum
- ⬆️ **Rising**: Medium trend score (0.4-0.7), increasing velocity
- 🆕 **New**: Recently appeared (< 14 days), moderate score
- 📈 **Emerging**: Early signals, low mention count but high quality

##### 3.4 Batch Processing
**Schedule:**
- Run daily at 3 AM UTC
- Process all restaurants with activity in last 30 days
- Compute 7-day, 14-day, 30-day trend metrics
- Update `trend_metrics` table
- Invalidate cached trend rankings

---

### 4. User API Service

#### Purpose
Serve trend data to frontend applications via RESTful API.

#### Technology Stack
- Language: Python 3.11+ / Node.js 18+ (TypeScript)
- Framework: FastAPI (Python) / Express (Node.js)
- Authentication: JWT
- Rate Limiting: Redis-based
- Caching: Redis (5-15 min TTL)

#### API Endpoints

##### 4.1 Trends API
```
GET /api/v1/trends
Query Parameters:
  - latitude: float (required if no location)
  - longitude: float (required if no location)
  - location: string (city, ZIP code)
  - radius_miles: int (default: 15, max: 50)
  - cuisine: string[] (filter by cuisine)
  - price_level: int[] (1-4)
  - trend_category: enum [hot, rising, new, emerging]
  - limit: int (default: 20, max: 100)
  - offset: int (pagination)

Response:
{
  "trends": [
    {
      "restaurant": {
        "id": 12345,
        "name": "Ramen Heaven",
        "address": "123 Main St, Austin, TX 78701",
        "latitude": 30.2672,
        "longitude": -97.7431,
        "cuisine_types": ["Japanese", "Ramen"],
        "price_level": 2,
        "phone": "(512) 555-0100",
        "website": "https://ramenheaven.com"
      },
      "trend": {
        "score": 0.85,
        "category": "hot",
        "rank": 1,
        "mention_count_7d": 145,
        "mention_growth": 2.3,
        "avg_sentiment": 0.92,
        "engagement_total": 15000
      },
      "social_proof": {
        "instagram_posts": 78,
        "youtube_videos": 5,
        "facebook_checkins": 62,
        "sample_posts": [...]
      },
      "distance_miles": 2.3
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 3
}
```

##### 4.2 Restaurant Details API
```
GET /api/v1/restaurants/{id}

Response:
{
  "restaurant": {...},
  "trend_history": [
    {"date": "2026-01-01", "score": 0.85, "mentions": 145},
    {"date": "2025-12-31", "score": 0.78, "mentions": 120}
  ],
  "recent_posts": [
    {
      "platform": "instagram",
      "user_handle": "@foodie_jane",
      "content": "Best ramen in Austin!",
      "posted_at": "2026-01-01T18:30:00Z",
      "engagement": 3500,
      "url": "https://instagram.com/p/..."
    }
  ],
  "menu_highlights": ["Tonkotsu Ramen", "Spicy Miso Bowl"],
  "hours": {
    "monday": "11:00-22:00",
    "tuesday": "11:00-22:00",
    ...
  }
}
```

##### 4.3 Search API
```
GET /api/v1/search
Query Parameters:
  - q: string (search query)
  - location: string
  - radius_miles: int

Response:
{
  "results": [
    {
      "restaurant": {...},
      "relevance_score": 0.95,
      "match_type": "name" | "cuisine" | "description"
    }
  ]
}
```

##### 4.4 User API
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET /api/v1/users/me
PATCH /api/v1/users/me
GET /api/v1/users/me/bookmarks
POST /api/v1/users/me/bookmarks
DELETE /api/v1/users/me/bookmarks/{restaurant_id}
```

#### Performance Requirements
- p50 latency: < 100ms
- p95 latency: < 500ms
- p99 latency: < 1000ms
- Throughput: 1000 req/sec per instance
- Cache hit rate: > 80%

---

### 5. Frontend Application

#### Technology Stack
- Framework: React 18+ with TypeScript
- State Management: Zustand / React Query
- UI Components: shadcn/ui + Tailwind CSS
- Maps: Mapbox GL JS
- Charts: Recharts
- Build: Vite
- Hosting: Vercel / Cloudflare Pages

#### Key Pages
1. **Trends Dashboard** (`/`)
   - List/grid view of trending restaurants
   - Filters and sorting
   - Map view toggle

2. **Restaurant Detail** (`/restaurants/:id`)
   - Full restaurant information
   - Trend chart
   - Social proof section
   - Photo gallery

3. **Search** (`/search`)
   - Full-text search
   - Advanced filters

4. **User Profile** (`/profile`)
   - Saved restaurants
   - Preferences
   - Location settings

#### Performance Targets
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.0s
- Lighthouse Score: > 90

---

## Data Flow

### Scraping to Presentation Flow

```
1. Agent Orchestrator schedules scraping job
   ↓
2. Scraper Agent executes (YouTube/Instagram/Facebook)
   ↓
3. Raw data sent to Data Validator
   ↓
4. Validated data stored in PostgreSQL (social_posts)
   ↓
5. Restaurant Entity Resolver extracts mentions
   ↓
6. Mentions stored (restaurant_mentions)
   ↓
7. Daily: Trend Engine computes scores
   ↓
8. Scores stored (trend_metrics)
   ↓
9. User API serves cached trend data
   ↓
10. Frontend displays to user
```

---

## Infrastructure & Deployment

### Cloud Platform
**Primary: AWS** (alternatives: GCP, Azure)

#### Compute
- **ECS Fargate** for containerized services
- **Lambda** for event-driven functions
- **EC2** for scraping agents (cost optimization)

#### Storage
- **RDS PostgreSQL** (Multi-AZ, r6g.xlarge)
- **ElastiCache Redis** (r6g.large)
- **S3** for media and backups

#### Networking
- **ALB** for load balancing
- **CloudFront** CDN for frontend
- **Route 53** for DNS
- **VPC** with private subnets

#### Monitoring & Logging
- **CloudWatch** for logs and metrics
- **Prometheus** + **Grafana** for detailed metrics
- **Sentry** for error tracking
- **DataDog** (optional, for APM)

### Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│                 CloudFront CDN                   │
│            (Frontend Static Assets)              │
└─────────────────────────────────────────────────┘
                       │
┌─────────────────────────────────────────────────┐
│              Application Load Balancer           │
│                  (API Gateway)                   │
└─────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  ECS Fargate│ │  ECS Fargate│ │  ECS Fargate│
│   User API  │ │Trend Engine │ │Data Ingest  │
│  (3 tasks)  │ │  (2 tasks)  │ │  (2 tasks)  │
└─────────────┘ └─────────────┘ └─────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  RDS Postgres│ │ElastiCache │ │     S3      │
│   (Multi-AZ)│ │   Redis     │ │  (Media)    │
└─────────────┘ └─────────────┘ └─────────────┘

┌─────────────────────────────────────────────────┐
│            EC2 Auto Scaling Group                │
│          (Scraping Agent Workers)                │
│          c6g.large (2-10 instances)              │
└─────────────────────────────────────────────────┘
```

### Container Strategy
- **Docker** for all services
- **ECR** for container registry
- **Multi-stage builds** for optimization
- Base images: `python:3.11-slim`, `node:18-alpine`

### CI/CD Pipeline
```
GitHub → GitHub Actions → Build → Test → Push to ECR → Deploy to ECS
                                    ↓
                            Security Scan (Trivy)
                                    ↓
                            Integration Tests
```

---

## Scalability Strategy

### Horizontal Scaling
| Component | Scaling Trigger | Min | Max |
|-----------|----------------|-----|-----|
| User API | CPU > 70% | 2 | 10 |
| Trend Engine | Queue depth > 100 | 1 | 5 |
| Scraper Workers | Schedule-based | 2 | 20 |
| PostgreSQL | Read replicas | 1 | 3 |
| Redis | Memory > 80% | 1 | 3 |

### Caching Strategy
```
Layer 1: Browser cache (static assets, 1 year)
Layer 2: CDN cache (frontend, 1 hour)
Layer 3: API gateway cache (5 min)
Layer 4: Application cache (Redis, 15 min)
Layer 5: Database query cache (PostgreSQL)
```

### Database Optimization
- **Partitioning**: `social_posts` by month
- **Indexing**: GiST for geospatial, GIN for full-text
- **Materialized Views**: Pre-computed trend rankings
- **Read Replicas**: Route read queries to replicas
- **Connection Pooling**: PgBouncer (max 100 connections)

---

## Security Architecture

### Authentication & Authorization
- **JWT tokens** (15 min access, 7 day refresh)
- **bcrypt** password hashing (cost factor 12)
- **OAuth 2.0** for social login (future)
- **API keys** for service-to-service

### Network Security
- **TLS 1.3** for all external communication
- **Private subnets** for databases and internal services
- **Security groups** with least privilege
- **WAF** (Web Application Firewall) for API
- **DDoS protection** via CloudFront

### Data Security
- **Encryption at rest** (RDS, S3)
- **Encryption in transit** (TLS)
- **Secrets management** (AWS Secrets Manager)
- **Regular security audits**
- **Automated vulnerability scanning**

### Privacy Compliance
- **GDPR compliance**: Right to deletion, data portability
- **CCPA compliance**: Do not sell data
- **Data retention**: 90 days for social posts
- **PII minimization**: Only store necessary user data
- **Audit logging**: Track data access

---

## Observability

### Logging Strategy
```
Application Logs → CloudWatch Logs → S3 (archive)
                         ↓
                  Log Aggregation (DataDog/ELK)
                         ↓
                  Alerting (PagerDuty)
```

### Metrics Collection
- **System metrics**: CPU, memory, disk, network
- **Application metrics**: Request rate, latency, errors
- **Business metrics**: Trends discovered, user engagement
- **Custom metrics**: Scraping success rate, trend accuracy

### Tracing
- **OpenTelemetry** for distributed tracing
- **Trace spans**: API request → DB query → External API
- **Performance bottleneck identification**

### Alerting Rules
```yaml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m
    severity: critical

  - name: SlowAPIResponse
    condition: p95_latency > 1s
    duration: 10m
    severity: warning

  - name: ScraperFailure
    condition: scraper_success_rate < 80%
    duration: 30m
    severity: high

  - name: DatabaseHighCPU
    condition: db_cpu > 80%
    duration: 15m
    severity: critical
```

---

## Disaster Recovery

### Backup Strategy
- **Database**: Automated daily snapshots, 30-day retention
- **Point-in-time recovery**: Last 7 days
- **Cross-region replication**: S3 media files
- **Configuration backups**: Infrastructure as Code (Terraform)

### Recovery Objectives
- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 1 hour

### Failure Scenarios
| Scenario | Impact | Mitigation | Recovery |
|----------|--------|------------|----------|
| API service down | Users can't access | Multi-AZ deployment | Auto-scaling, health checks |
| Database failure | Total outage | Multi-AZ RDS, replicas | Failover to standby (< 5 min) |
| Scraper failure | Stale data | Multiple agents | Retry logic, alerts |
| Region outage | Total outage | Cross-region backup | Manual failover (4 hours) |

---

## Cost Optimization

### Estimated Monthly Costs (MVP)

| Service | Configuration | Cost |
|---------|--------------|------|
| RDS PostgreSQL | db.r6g.xlarge Multi-AZ | $550 |
| ElastiCache Redis | cache.r6g.large | $200 |
| ECS Fargate | 7 tasks (1 vCPU, 2 GB) | $300 |
| EC2 Scrapers | 4x c6g.large (on-demand) | $400 |
| S3 Storage | 500 GB | $12 |
| CloudFront | 1 TB transfer | $85 |
| API Calls | Google Places, social APIs | $200 |
| Monitoring | CloudWatch, Sentry | $100 |
| **Total** | | **~$1,850/month** |

### Optimization Strategies
1. **Spot instances** for scraping workers (70% cost savings)
2. **Reserved instances** for stable workloads
3. **S3 Intelligent-Tiering** for media
4. **CloudFront caching** to reduce API calls
5. **Query optimization** to reduce database load
6. **Serverless** for sporadic workloads

---

## Technology Decisions

### Why PostgreSQL?
- Excellent geospatial support (PostGIS)
- JSONB for flexible data
- Full-text search capabilities
- ACID compliance for trend data
- Mature ecosystem

### Why Python for Scrapers?
- Rich scraping libraries (Scrapy, Playwright)
- ML/NLP ecosystem (spaCy, scikit-learn)
- Fast development iteration
- Strong community support

### Why React for Frontend?
- Component reusability
- Large talent pool
- Excellent tooling (Vite, TypeScript)
- Performance optimizations (Virtual DOM)

### Why Redis?
- Fast in-memory caching
- Pub/sub for real-time features
- Session storage
- Rate limiting support

---

## Migration Path

### Phase 1: Monolith (Months 1-2)
- Single service with all functionality
- Validates product-market fit quickly
- Easier debugging and development

### Phase 2: Service Separation (Months 3-4)
- Split scrapers into separate service
- Separate trend engine
- Keep user API as gateway

### Phase 3: Microservices (Months 5+)
- Fully independent services
- Event-driven architecture
- Service mesh (Istio/Linkerd)

---

## Open Questions & Future Considerations

### Technical Debt to Monitor
1. **Scraping reliability**: Social platforms may block agents
2. **Data quality**: Entity resolution accuracy degrades over time
3. **Scaling costs**: Compute costs grow with data volume
4. **API dependencies**: External API changes break integrations

### Future Enhancements
1. **Machine Learning**: Predict future trends, personalized recommendations
2. **Real-time Updates**: WebSocket connections for live data
3. **Graph Database**: Neo4j for complex relationship queries
4. **Data Warehouse**: BigQuery/Snowflake for analytics
5. **Multi-region**: Deploy in US-West, US-East, Europe

---

## Appendix

### Technology Stack Summary
| Layer | Technology | Alternatives Considered |
|-------|-----------|------------------------|
| Frontend | React + TypeScript | Vue.js, Svelte |
| API | FastAPI (Python) | Express (Node.js), Go |
| Database | PostgreSQL | MongoDB, MySQL |
| Cache | Redis | Memcached |
| Queue | Celery + Redis | RabbitMQ, AWS SQS |
| Orchestration | Airflow | Prefect, Dagster |
| Hosting | AWS ECS | Kubernetes, Heroku |
| CI/CD | GitHub Actions | GitLab CI, Jenkins |

### Key Architecture Patterns
- **Microservices**: Loosely coupled services
- **Event-Driven**: Async processing via queues
- **CQRS**: Separate read/write models (trend metrics)
- **Circuit Breaker**: Graceful external API failures
- **Retry with Backoff**: Resilient scraping
- **Bulkhead**: Isolate failures

---

**Document Status**: Ready for engineering review
**Next Steps**: Review with engineering team, finalize tech stack, begin sprint planning

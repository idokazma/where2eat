# Where2Eat API Documentation

**Production URL:** `https://where2eat-production.up.railway.app`
**Frontend URL:** `https://where2eat-delta.vercel.app`

---

## Environment Setup

### Railway (API Server)

Set these environment variables in Railway dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_PLACES_API_KEY` | Yes | Google Places API key for location search |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for YouTube analysis |
| `OPENAI_API_KEY` | No | Alternative to Claude for analysis |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `PORT` | Auto | Set automatically by Railway |

### Vercel (Frontend)

Set these environment variables in Vercel dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | `https://where2eat-production.up.railway.app` |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | No | For client-side map features |

**Important:** After adding `NEXT_PUBLIC_API_URL`, redeploy on Vercel for changes to take effect.

---

## Health Check

### GET /health
Check if the API is running.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-10T18:26:07.195Z"
}
```

---

## Restaurants

### GET /api/restaurants
Get all restaurants.

**Response:**
```json
{
  "restaurants": [...],
  "count": 42
}
```

### GET /api/restaurants/:id
Get a single restaurant by ID.

**Response:** Restaurant object or `404` if not found.

### GET /api/restaurants/search
Advanced search with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `location` | string | Filter by city name (partial match) |
| `cuisine` | string/array | Filter by cuisine type |
| `price_range` | string/array | Filter by price range |
| `status` | string/array | Filter by status |
| `host_opinion` | string/array | Filter by host opinion |
| `date_start` | ISO date | Filter from date |
| `date_end` | ISO date | Filter to date |
| `episode_id` | string | Filter by episode video ID |
| `sort_by` | string | `name`, `location`, `cuisine`, `rating`, `analysis_date` (default) |
| `sort_direction` | string | `asc` or `desc` (default) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

**Example:**
```
GET /api/restaurants/search?location=תל אביב&cuisine=Italian&sort_by=rating&limit=10
```

**Response:**
```json
{
  "restaurants": [...],
  "timeline_data": [...],
  "analytics": {
    "total_count": 15,
    "page": 1,
    "limit": 10,
    "total_pages": 2,
    "filter_counts": {
      "cuisine": {"Italian": 5, "Mediterranean": 3},
      "location": {"תל אביב": 10},
      "price_range": {"$$": 8, "$$$": 7},
      "host_opinion": {"positive": 12}
    },
    "date_distribution": {"2026-01-10": 3}
  }
}
```

### POST /api/restaurants
Create a new restaurant.

**Request Body:** Restaurant object
**Response:** `201` with created restaurant

### PUT /api/restaurants/:id
Update an existing restaurant.

**Request Body:** Restaurant object
**Response:** Updated restaurant or `404`

### DELETE /api/restaurants/:id
Delete a restaurant.

**Response:** `{ "message": "Restaurant deleted successfully" }` or `404`

---

## Episodes

### GET /api/episodes/search
Search episodes with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `date_start` | ISO date | Filter from date |
| `date_end` | ISO date | Filter to date |
| `cuisine_filter` | string | Filter by cuisine |
| `location_filter` | string | Filter by location |
| `min_restaurants` | number | Minimum restaurants per episode (default: 1) |
| `sort_by` | string | `analysis_date` (default) or `restaurant_count` |
| `sort_direction` | string | `asc` or `desc` (default) |
| `page` | number | Page number |
| `limit` | number | Results per page |

**Response:**
```json
{
  "episodes": [
    {
      "episode_info": {...},
      "restaurants": [...],
      "matching_restaurants": 5
    }
  ],
  "count": 10,
  "total_restaurants": 45
}
```

---

## Analytics

### GET /api/analytics/timeline
Get timeline analytics data.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `date_start` | ISO date | Start date |
| `date_end` | ISO date | End date |
| `granularity` | string | `day` (default), `week`, or `month` |
| `cuisine_filter` | string | Filter by cuisine |
| `location_filter` | string | Filter by location |

**Response:**
```json
{
  "timeline": [
    { "date": "2026-01-10", "restaurants": [...], "count": 5 }
  ],
  "analytics": {
    "cuisine_distribution": {"Italian": 12, "Mediterranean": 8},
    "location_distribution": {"Tel Aviv": 20},
    "opinion_distribution": {"positive": 15, "neutral": 5},
    "price_distribution": {"$$": 10, "$$$": 8},
    "top_episodes": [...]
  },
  "summary": {
    "total_restaurants": 50,
    "unique_episodes": 10,
    "date_range": {...}
  }
}
```

### GET /api/analytics/trends
Get trending restaurants and patterns.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `period` | string | `1month`, `3months` (default), `6months`, `1year` |
| `trending_threshold` | number | Min mentions to be "trending" (default: 3) |

**Response:**
```json
{
  "trending_restaurants": [...],
  "regional_patterns": [
    {
      "region": "Center",
      "cities": {"Tel Aviv": 20},
      "total": 25,
      "cuisines": {"Italian": 5},
      "average_rating": 4.2,
      "top_city": "Tel Aviv",
      "top_cuisine": "Italian"
    }
  ],
  "cuisine_trends": [
    { "cuisine": "Italian", "total": 15, "recent_mentions": 5 }
  ],
  "period_summary": {
    "period": "3months",
    "restaurants_discovered": 50,
    "most_active_region": "Center"
  }
}
```

---

## Google Places

### GET /api/places/search
Search for places using Google Places API.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query |
| `location` | string | No | Location bias |

**Response:**
```json
{
  "places": [
    {
      "place_id": "ChIJ...",
      "name": "Restaurant Name",
      "formatted_address": "123 Street, City",
      "geometry": { "location": { "lat": 32.0, "lng": 34.7 } },
      "rating": 4.5,
      "price_level": 2,
      "types": ["restaurant"],
      "photos": [...]
    }
  ]
}
```

### GET /api/places/details/:placeId
Get detailed information about a place.

**Response:**
```json
{
  "place": {
    "place_id": "ChIJ...",
    "name": "Restaurant Name",
    "formatted_address": "...",
    "formatted_phone_number": "...",
    "website": "...",
    "opening_hours": {...},
    "photos": [...],
    "reviews": [...]
  }
}
```

---

## Analysis (YouTube Processing)

### POST /api/analyze
Analyze a single YouTube video for restaurant mentions.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:** `202 Accepted`
```json
{
  "message": "Analysis started successfully",
  "status": "processing",
  "url": "..."
}
```

### POST /api/analyze/channel
Analyze an entire YouTube channel.

**Request Body:**
```json
{
  "channel_url": "https://www.youtube.com/@ChannelName",
  "filters": {
    "max_results": 50,
    "date_from": "2025-01-01",
    "date_to": "2026-01-01",
    "min_views": 1000,
    "min_duration_seconds": 300
  },
  "processing_options": {
    "batch_size": 5,
    "skip_existing": true
  }
}
```

**Response:** `202 Accepted`
```json
{
  "job_id": "uuid",
  "message": "Channel analysis started successfully",
  "status": "started",
  "estimated_duration_minutes": 20
}
```

---

## Jobs

### GET /api/jobs
List all background jobs.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |

### GET /api/jobs/:jobId/status
Get status of a specific job.

### GET /api/jobs/:jobId/results
Get results of a completed job.

### DELETE /api/jobs/:jobId
Cancel a running job.

---

## Admin Routes

All admin routes require authentication.

| Route | Description |
|-------|-------------|
| `/api/admin/auth` | Authentication endpoints |
| `/api/admin/restaurants` | Restaurant management |
| `/api/admin/analytics` | Analytics dashboard |
| `/api/admin/articles` | Article management |
| `/api/admin/videos` | Video management |
| `/api/admin/bulk` | Bulk operations |
| `/api/admin/audit` | Audit logs |

---

## Error Responses

All endpoints return errors in this format:
```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad request (invalid parameters)
- `404` - Resource not found
- `500` - Internal server error

---

## CORS Configuration

The API accepts requests from these origins by default:
- `http://localhost:3000`
- `http://localhost:3001`
- `https://where2eat.vercel.app`

Additional origins can be added via the `ALLOWED_ORIGINS` environment variable (comma-separated).

---

## Rate Limiting

No rate limiting is currently implemented. Consider adding for production use.

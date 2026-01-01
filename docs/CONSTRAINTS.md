# Development Constraints & Guidelines
## Restaurant Trend Scout

**Document Version:** 1.0
**Last Updated:** 2026-01-01
**Owner:** VP R&D & CTO
**Status:** Draft

---

## Overview

This document outlines critical development constraints, technical limitations, coding standards, and operational guidelines for Restaurant Trend Scout. All engineers must understand and adhere to these constraints to ensure legal compliance, technical feasibility, and system reliability.

---

## Legal & Compliance Constraints

### 1. Web Scraping Compliance

#### CRITICAL: Platform Terms of Service
All scraping must comply with platform Terms of Service and legal requirements.

**YouTube**:
- ✅ **ALLOWED**: YouTube Data API v3 (official)
- ✅ **ALLOWED**: Public video metadata
- ⚠️ **RESTRICTED**: API quota limits (10,000 units/day)
- ❌ **PROHIBITED**: Bypassing API to scrape HTML
- ❌ **PROHIBITED**: Downloading videos without permission

**Instagram**:
- ⚠️ **USE CAUTION**: Official API extremely limited
- ✅ **ALLOWED**: Open-source tools (Instaloader) for public data
- ⚠️ **RESTRICTED**: May be blocked, must gracefully handle
- ❌ **PROHIBITED**: Automated account creation
- ❌ **PROHIBITED**: Violating rate limits
- **FALLBACK**: Disable if blocked, rely on other platforms

**Facebook**:
- ✅ **ALLOWED**: Graph API for public pages
- ⚠️ **RESTRICTED**: Requires app review for some permissions
- ❌ **PROHIBITED**: Scraping private profiles
- ❌ **PROHIBITED**: Storing user data beyond 24 hours (per policy)

#### robots.txt Compliance
```python
# REQUIRED: Check robots.txt before scraping
from urllib.robotparser import RobotFileParser

def can_scrape(url: str, user_agent: str) -> bool:
    """Check if URL can be scraped per robots.txt."""
    rp = RobotFileParser()
    rp.set_url(f"{url}/robots.txt")
    rp.read()
    return rp.can_fetch(user_agent, url)

# ALWAYS check before scraping
if not can_scrape("https://example.com/page", "RestaurantTrendScout/1.0"):
    logger.warning("robots.txt disallows scraping")
    return
```

#### Rate Limiting Requirements
**MANDATORY**: Respect platform rate limits

| Platform | Rate Limit | Implementation |
|----------|-----------|----------------|
| YouTube API | 10,000 units/day | Track usage, rotate keys |
| Instagram | Variable, ~200 req/hour | Exponential backoff, delays |
| Facebook API | 200 calls/hour/user | Token rotation, caching |
| Google Places | 100 req/100s | Redis-based rate limiter |

**Code Example**:
```python
# scrapers/rate_limiter.py
import time
from functools import wraps

def rate_limit(calls_per_second: float):
    """Decorator to enforce rate limiting."""
    min_interval = 1.0 / calls_per_second

    def decorator(func):
        last_called = [0.0]

        @wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.time() - last_called[0]
            wait_time = min_interval - elapsed
            if wait_time > 0:
                time.sleep(wait_time)
            result = func(*args, **kwargs)
            last_called[0] = time.time()
            return result
        return wrapper
    return decorator

# Usage
@rate_limit(calls_per_second=2)  # Max 2 calls per second
def scrape_page(url):
    # Scraping logic
    pass
```

---

### 2. Data Privacy & GDPR Compliance

#### Personal Data Handling
**CRITICAL**: Minimize personal data collection

**ALLOWED**:
- ✅ Public posts, captions, hashtags
- ✅ Public engagement metrics (likes, comments counts)
- ✅ Restaurant information (public business data)

**RESTRICTED**:
- ⚠️ User handles (only store if essential)
- ⚠️ User profile photos (link, don't download)
- ⚠️ Email addresses (only for registered users)

**PROHIBITED**:
- ❌ Private profiles
- ❌ Private messages
- ❌ Personal contact information (unless publicly listed by business)
- ❌ Faces in photos (blur if displaying user-generated content)

#### Data Retention Policy
```sql
-- REQUIRED: Auto-delete old data
-- Social posts older than 90 days
DELETE FROM social_posts WHERE posted_at < NOW() - INTERVAL '90 days';

-- User data: Delete on account closure
DELETE FROM users WHERE deleted_at < NOW() - INTERVAL '30 days';
```

**Implementation**:
```python
# jobs/data_retention.py
from celery import shared_task

@shared_task
def cleanup_old_posts():
    """Delete social posts older than 90 days."""
    cutoff_date = datetime.now() - timedelta(days=90)
    deleted = db.execute(
        "DELETE FROM social_posts WHERE posted_at < %s",
        [cutoff_date]
    )
    logger.info(f"Deleted {deleted} old posts")

# Schedule daily at 2 AM
# celerybeat_schedule = {
#     'cleanup-old-posts': {
#         'task': 'jobs.data_retention.cleanup_old_posts',
#         'schedule': crontab(hour=2, minute=0),
#     },
# }
```

#### User Rights (GDPR)
**MUST IMPLEMENT**:
1. **Right to Access**: User can export their data
2. **Right to Deletion**: User can delete account and data
3. **Right to Portability**: User can download data in JSON format

```python
# api/user_data.py
@router.get("/users/me/export")
async def export_user_data(user: User):
    """Export all user data (GDPR compliance)."""
    data = {
        "user": {
            "email": user.email,
            "name": user.name,
            "created_at": user.created_at.isoformat(),
        },
        "bookmarks": [
            {
                "restaurant_name": b.restaurant.name,
                "bookmarked_at": b.created_at.isoformat(),
                "notes": b.notes,
            }
            for b in user.bookmarks
        ],
    }
    return JSONResponse(content=data)

@router.delete("/users/me")
async def delete_user_account(user: User):
    """Delete user account and all data (GDPR compliance)."""
    # Mark for deletion (actual deletion after 30 days)
    user.deleted_at = datetime.now()
    db.commit()

    # Queue background job to purge data
    purge_user_data.delay(user.id)

    return {"message": "Account scheduled for deletion"}
```

---

### 3. Copyright & Attribution

#### Content Attribution
**REQUIRED**: Always attribute content to original creators

```python
# When displaying social posts
class SocialPostDisplay:
    def __init__(self, post: SocialPost):
        self.content = post.content[:200] + "..."  # Excerpt only
        self.author = post.user_handle
        self.platform = post.platform
        self.url = post.post_url  # Link to original
        self.posted_at = post.posted_at

# In API response
{
    "content": "Amazing ramen at this new spot!...",
    "author": "@foodie_jane",
    "platform": "instagram",
    "url": "https://instagram.com/p/abc123",  # REQUIRED: Link to original
    "posted_at": "2026-01-01T12:00:00Z"
}
```

**PROHIBITED**:
- ❌ Copying full posts without attribution
- ❌ Removing watermarks from images
- ❌ Claiming content as our own
- ❌ Commercial use of user-generated content without permission

#### DMCA Compliance
**MUST IMPLEMENT**: Takedown request handling

```python
# api/dmca.py
@router.post("/dmca/takedown")
async def dmca_takedown_request(request: DMCARequest):
    """Handle DMCA takedown requests."""
    # Validate request
    # Remove content
    # Notify user
    # Log for records
    pass
```

---

## Technical Constraints

### 1. API Quota Management

#### YouTube API Quota
**CRITICAL**: 10,000 units per day per API key

**Unit Costs**:
- `search.list`: 100 units
- `videos.list`: 1 unit
- `channels.list`: 1 unit

**Strategy**:
```python
# config/api_quotas.py
YOUTUBE_API_KEYS = [
    os.getenv("YOUTUBE_API_KEY_1"),
    os.getenv("YOUTUBE_API_KEY_2"),
    os.getenv("YOUTUBE_API_KEY_3"),
]

class YouTubeQuotaManager:
    def __init__(self):
        self.current_key_index = 0
        self.quota_used = defaultdict(int)

    def get_api_key(self) -> str:
        """Get API key with available quota."""
        for i, key in enumerate(YOUTUBE_API_KEYS):
            if self.quota_used[key] < 9500:  # Leave buffer
                return key

        # All keys exhausted
        raise QuotaExceededError("All YouTube API keys exhausted")

    def track_usage(self, key: str, units: int):
        """Track quota usage."""
        self.quota_used[key] += units
        if self.quota_used[key] >= 9500:
            logger.warning(f"YouTube API key {key[:8]}... quota nearly exhausted")

# Usage
manager = YouTubeQuotaManager()
key = manager.get_api_key()
# Make API call
manager.track_usage(key, units=100)
```

**Fallback**:
- If quota exhausted, pause YouTube scraping for 24 hours
- Focus on Instagram and Facebook
- Resume at midnight UTC when quota resets

---

### 2. Database Constraints

#### Storage Limits
**Estimated Growth**:
- Social posts: ~10,000 per day = ~300,000 per month
- Avg post size: 2 KB
- Monthly growth: ~600 MB

**Retention**:
- Keep posts for 90 days max
- Archive to S3 after 30 days (cold storage)

**Partitioning**:
```sql
-- REQUIRED: Partition social_posts by month
CREATE TABLE social_posts_y2026m01 PARTITION OF social_posts
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE social_posts_y2026m02 PARTITION OF social_posts
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Auto-drop partitions older than 90 days
DROP TABLE social_posts_y2025m10;  -- Older than 90 days
```

#### Connection Pool Limits
```python
# config/database.py
DATABASE_CONFIG = {
    'pool_size': 10,           # Max connections
    'max_overflow': 20,        # Additional connections under load
    'pool_timeout': 30,        # Timeout waiting for connection
    'pool_recycle': 3600,      # Recycle connections after 1 hour
}

# NEVER exceed 100 total connections to database
```

---

### 3. Memory & Performance Constraints

#### Scraping Agent Memory
**Limit**: 2 GB RAM per scraper agent

```python
# REQUIRED: Process in batches, not all at once
def scrape_hashtag(hashtag: str):
    """Scrape Instagram hashtag in batches."""
    batch_size = 50  # Process 50 posts at a time
    posts = []

    for batch in get_posts_in_batches(hashtag, batch_size):
        # Process batch
        processed = [process_post(p) for p in batch]

        # Store immediately, don't accumulate in memory
        store_posts(processed)

        # Clear batch from memory
        del batch
        del processed
```

#### API Response Size
**Limit**: 5 MB per API response

```python
# REQUIRED: Implement pagination
@router.get("/v1/trends")
async def get_trends(limit: int = 20, offset: int = 0):
    """Get trends with pagination."""
    if limit > 100:
        raise HTTPException(400, "Max limit is 100")

    trends = db.query(Trend).limit(limit).offset(offset).all()
    return {"trends": trends, "total": total, "limit": limit, "offset": offset}
```

---

### 4. Cost Constraints

#### Cloud Costs Budget
**Monthly Budget**: $2,000 (MVP)

**Breakdown**:
- Compute (ECS): $700
- Database (RDS): $550
- Cache (Redis): $200
- Storage (S3): $50
- APIs (external): $200
- Monitoring: $100
- CDN: $100
- Misc: $100

**Cost Optimization**:
```python
# REQUIRED: Use spot instances for scrapers (70% cost savings)
# terraform/ecs.tf
resource "aws_ecs_task_definition" "scraper" {
  requires_compatibilities = ["FARGATE_SPOT"]  # Use spot instances
  # ...
}

# REQUIRED: Aggressive caching to reduce API calls
@cached(ttl=900, key_prefix="trends")  # 15-minute cache
def get_trending_restaurants(location):
    # Expensive operation
    pass
```

**Alerts**:
```yaml
# cloudwatch_alarms.tf
resource "aws_cloudwatch_metric_alarm" "high_costs" {
  alarm_name          = "monthly-costs-high"
  comparison_operator = "GreaterThanThreshold"
  threshold           = "2000"
  alarm_description   = "Monthly costs exceeded budget"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

---

## Coding Standards

### 1. Python Code Standards

#### Style Guide: PEP 8
**Enforced via**: Ruff, Black

```python
# REQUIRED: Type hints for all functions
def calculate_trend_score(
    restaurant_id: int,
    date: datetime,
    window_days: int = 7
) -> float:
    """Calculate trend score for a restaurant.

    Args:
        restaurant_id: Unique identifier for restaurant
        date: Date to calculate score for
        window_days: Number of days to analyze (default: 7)

    Returns:
        Trend score between 0.0 and 1.0

    Raises:
        ValueError: If restaurant_id not found
        DatabaseError: If database query fails
    """
    pass

# REQUIRED: Docstrings for all public functions (Google style)

# REQUIRED: Max line length 100 characters
# REQUIRED: Max function complexity 10 (cyclomatic complexity)

# REQUIRED: Error handling
def scrape_youtube_video(video_id: str) -> Dict:
    """Scrape YouTube video metadata."""
    try:
        response = youtube_api.get_video(video_id)
        return parse_video_data(response)
    except YouTubeAPIError as e:
        logger.error(f"Failed to scrape video {video_id}: {e}")
        raise
    except Exception as e:
        logger.exception(f"Unexpected error scraping video {video_id}")
        raise ScraperError("Failed to scrape video") from e
```

#### Logging Standards
```python
# REQUIRED: Structured logging with context
import structlog

logger = structlog.get_logger()

# GOOD
logger.info(
    "scraping_completed",
    platform="youtube",
    channel_id="abc123",
    videos_scraped=42,
    duration_seconds=15.3,
    success=True
)

# BAD
print(f"Scraped {videos} videos from YouTube")  # NO print statements!

# REQUIRED: Log levels
# DEBUG: Detailed diagnostic info
# INFO: Normal operations, milestones
# WARNING: Unexpected but handled situations
# ERROR: Errors that need attention
# CRITICAL: System-level failures
```

---

### 2. TypeScript Code Standards

#### Style Guide: Airbnb TypeScript

```typescript
// REQUIRED: Strict TypeScript mode
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// REQUIRED: Interfaces for all data structures
interface Restaurant {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  cuisineTypes: string[];
  priceLevel: number;
}

// REQUIRED: Functional components with explicit types
interface RestaurantCardProps {
  restaurant: Restaurant;
  trend: TrendData;
  onBookmark: (id: number) => void;
}

export const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  trend,
  onBookmark,
}) => {
  // Component implementation
  return <div>...</div>;
};

// REQUIRED: Error handling
const fetchTrends = async (location: Location): Promise<TrendsResponse> => {
  try {
    const response = await api.get('/trends', { params: location });
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch trends', { error, location });
    throw new TrendsFetchError('Unable to load trends');
  }
};
```

---

### 3. SQL Best Practices

```sql
-- REQUIRED: Always use parameterized queries (prevent SQL injection)
-- GOOD
cursor.execute(
    "SELECT * FROM restaurants WHERE city = %s",
    [city]
)

-- BAD (SQL injection vulnerability!)
cursor.execute(f"SELECT * FROM restaurants WHERE city = '{city}'")

-- REQUIRED: Add indexes for all WHERE clauses
CREATE INDEX idx_restaurants_city ON restaurants (city);
CREATE INDEX idx_social_posts_posted_at ON social_posts (posted_at DESC);

-- REQUIRED: Use EXPLAIN ANALYZE for slow queries
EXPLAIN ANALYZE
SELECT * FROM restaurants
WHERE city = 'Austin'
  AND cuisine_types @> ARRAY['Japanese'];

-- REQUIRED: Limit query results
SELECT * FROM social_posts
ORDER BY posted_at DESC
LIMIT 1000;  -- ALWAYS use LIMIT for large tables
```

---

## Security Guidelines

### 1. Authentication & Authorization

```python
# REQUIRED: Hash passwords with bcrypt (cost factor 12)
from passlib.hash import bcrypt

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.using(rounds=12).hash(password)

def verify_password(password: str, hash: str) -> bool:
    """Verify password against hash."""
    return bcrypt.verify(password, hash)

# REQUIRED: JWT tokens with expiration
from datetime import timedelta
import jwt

def create_access_token(user_id: int) -> str:
    """Create JWT access token."""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=15),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# REQUIRED: Validate all inputs
from pydantic import BaseModel, EmailStr, constr

class UserRegister(BaseModel):
    email: EmailStr  # Validates email format
    password: constr(min_length=8, max_length=100)  # Min 8 chars
    name: constr(min_length=1, max_length=100)
```

### 2. Environment Variables

```python
# REQUIRED: Never commit secrets to Git
# Use environment variables for all sensitive data

# .env (NEVER commit this file!)
DATABASE_URL=postgresql://user:pass@localhost/db
YOUTUBE_API_KEY=AIza...
JWT_SECRET_KEY=super-secret-key-here

# .gitignore (REQUIRED)
.env
.env.local
*.pem
*.key
secrets/

# config/settings.py
import os
from dotenv import load_dotenv

load_dotenv()

# REQUIRED: Fail fast if critical env vars missing
def get_required_env(key: str) -> str:
    """Get required environment variable or raise error."""
    value = os.getenv(key)
    if value is None:
        raise ValueError(f"Missing required environment variable: {key}")
    return value

DATABASE_URL = get_required_env("DATABASE_URL")
YOUTUBE_API_KEY = get_required_env("YOUTUBE_API_KEY")
```

### 3. Input Validation

```python
# REQUIRED: Validate and sanitize all user inputs
from pydantic import BaseModel, validator

class TrendsQuery(BaseModel):
    latitude: float
    longitude: float
    radius_miles: int = 15

    @validator('latitude')
    def validate_latitude(cls, v):
        if not -90 <= v <= 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v

    @validator('longitude')
    def validate_longitude(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v

    @validator('radius_miles')
    def validate_radius(cls, v):
        if not 5 <= v <= 50:
            raise ValueError('Radius must be between 5 and 50 miles')
        return v

# REQUIRED: Sanitize output (prevent XSS)
import html

def sanitize_html(text: str) -> str:
    """Escape HTML to prevent XSS."""
    return html.escape(text)

# When displaying user-generated content
post_content = sanitize_html(post.content)
```

---

## Operational Constraints

### 1. Deployment Requirements

#### Zero-Downtime Deployment
**REQUIRED**: Use blue-green or rolling deployment

```yaml
# .github/workflows/deploy.yml
- name: Deploy to ECS (rolling update)
  run: |
    aws ecs update-service \
      --cluster restaurant-trends \
      --service api \
      --force-new-deployment \
      --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200"
```

#### Database Migrations
**REQUIRED**: All migrations must be backward compatible

```python
# GOOD: Backward compatible migration
# 1. Add new column as nullable
ALTER TABLE restaurants ADD COLUMN new_field VARCHAR(255) NULL;

# 2. Deploy code that can handle NULL
# 3. Backfill data
UPDATE restaurants SET new_field = 'default_value' WHERE new_field IS NULL;

# 4. Make NOT NULL in later migration
ALTER TABLE restaurants ALTER COLUMN new_field SET NOT NULL;

# BAD: Breaking migration
ALTER TABLE restaurants DROP COLUMN old_field;  # Breaks old code!
```

#### Rollback Plan
**REQUIRED**: Every deployment must have rollback plan

```bash
# Rollback procedure
# 1. Revert ECS task definition to previous version
aws ecs update-service --cluster restaurant-trends --service api \
  --task-definition api:42  # Previous version

# 2. Rollback database migration (if applicable)
alembic downgrade -1

# 3. Clear cache
redis-cli FLUSHALL

# 4. Verify rollback
curl https://api.restauranttrendscout.com/health
```

---

### 2. Monitoring Requirements

#### Health Checks
**REQUIRED**: All services must have health endpoint

```python
# api/health.py
@router.get("/health")
async def health_check():
    """Health check endpoint for load balancer."""
    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "api": True,
    }

    all_healthy = all(checks.values())
    status_code = 200 if all_healthy else 503

    return JSONResponse(
        content={"status": "healthy" if all_healthy else "unhealthy", "checks": checks},
        status_code=status_code
    )

async def check_database() -> bool:
    """Check database connectivity."""
    try:
        await db.execute("SELECT 1")
        return True
    except Exception:
        return False
```

#### Alerts
**REQUIRED**: Alert on critical metrics

```yaml
# monitoring/alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    channels: [pagerduty, slack]

  - name: HighLatency
    condition: p95_latency > 1s
    duration: 10m
    severity: warning
    channels: [slack]

  - name: DatabaseDown
    condition: database_up == 0
    duration: 1m
    severity: critical
    channels: [pagerduty, slack, sms]
```

---

### 3. Backup & Recovery

#### Automated Backups
**REQUIRED**: Daily database backups with 30-day retention

```bash
# Automated via AWS RDS
# Backup window: 2:00-3:00 AM UTC
# Retention: 30 days
# Cross-region replication: Enabled

# Test restore monthly (REQUIRED)
# Document: docs/runbooks/database_restore.md
```

#### Disaster Recovery Plan
**REQUIRED**: Documented DR procedures

**RTO (Recovery Time Objective)**: 4 hours
**RPO (Recovery Point Objective)**: 1 hour

**DR Checklist**:
- [ ] Database restore from backup
- [ ] Restore Redis from snapshot
- [ ] Redeploy API service
- [ ] Verify data integrity
- [ ] Run smoke tests
- [ ] Monitor for 24 hours

---

## Performance Guidelines

### 1. API Performance

```python
# REQUIRED: Cache expensive operations
from functools import lru_cache
import redis

redis_client = redis.Redis(host='localhost', port=6379)

def cached_trends(location: str, radius: int):
    """Get trends with caching."""
    cache_key = f"trends:{location}:{radius}"

    # Check cache
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Compute
    trends = compute_trends(location, radius)

    # Store in cache (15 min TTL)
    redis_client.setex(cache_key, 900, json.dumps(trends))

    return trends

# REQUIRED: Database query optimization
# Use select_related / prefetch_related (Django/SQLAlchemy)
restaurants = db.query(Restaurant).options(
    joinedload(Restaurant.trend_metrics),
    joinedload(Restaurant.mentions)
).all()

# REQUIRED: Pagination for large datasets
def get_restaurants(page: int = 1, page_size: int = 20):
    offset = (page - 1) * page_size
    return db.query(Restaurant).limit(page_size).offset(offset).all()
```

### 2. Frontend Performance

```typescript
// REQUIRED: Code splitting for large bundles
const RestaurantDetail = lazy(() => import('./pages/RestaurantDetail'));

// REQUIRED: Memoization for expensive computations
const ExpensiveComponent: React.FC<Props> = ({ data }) => {
  const computedValue = useMemo(() => {
    return expensiveCalculation(data);
  }, [data]);

  return <div>{computedValue}</div>;
};

// REQUIRED: Debounce search inputs
const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300); // 300ms delay

  useEffect(() => {
    if (debouncedQuery) {
      searchRestaurants(debouncedQuery);
    }
  }, [debouncedQuery]);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
};
```

---

## Scalability Constraints

### 1. Horizontal Scaling Limits

**Current Architecture Supports**:
- ✅ Up to 10,000 concurrent users
- ✅ Up to 1 million restaurants
- ✅ Up to 10 million posts per month

**Beyond These Limits**:
- Requires architecture changes (sharding, microservices)
- Plan for re-architecture at 50% of limits

### 2. Database Scaling

```python
# REQUIRED: Use read replicas for heavy read workloads
# Write to primary
primary_db.execute("INSERT INTO restaurants ...")

# Read from replicas
replica_db.execute("SELECT * FROM restaurants ...")

# REQUIRED: Partition large tables
# social_posts partitioned by month
# trend_metrics partitioned by date range
```

---

## Documentation Requirements

### 1. Code Documentation

```python
# REQUIRED: Docstrings for all public functions
def calculate_trend_score(restaurant_id: int, date: datetime) -> float:
    """Calculate trend score for a restaurant.

    This function analyzes social media mentions, engagement rates,
    and sentiment to produce a trend score between 0.0 and 1.0.

    Args:
        restaurant_id: Unique identifier for the restaurant
        date: Date to calculate the trend score for

    Returns:
        float: Trend score between 0.0 (not trending) and 1.0 (highly trending)

    Raises:
        ValueError: If restaurant_id does not exist
        DatabaseError: If database query fails

    Example:
        >>> score = calculate_trend_score(12345, datetime(2026, 1, 1))
        >>> print(score)
        0.85
    """
    pass
```

### 2. API Documentation

**REQUIRED**: OpenAPI (Swagger) documentation for all endpoints

```python
# Automatically generated from FastAPI
# Available at: /docs

@router.get("/v1/trends", response_model=TrendsResponse)
async def get_trends(
    latitude: float = Query(..., description="Latitude coordinate"),
    longitude: float = Query(..., description="Longitude coordinate"),
    radius_miles: int = Query(15, ge=5, le=50, description="Search radius in miles"),
) -> TrendsResponse:
    """
    Get trending restaurants for a location.

    Returns a list of trending restaurants within the specified radius,
    ranked by trend score.

    **Rate Limit**: 100 requests per hour (free tier)
    """
    pass
```

### 3. Runbooks

**REQUIRED**: Runbooks for common operations

Example: `docs/runbooks/scraper_failure.md`
```markdown
# Runbook: Scraper Failure

## Symptoms
- No new posts in last 6 hours
- Scraping jobs failing in logs
- Alert: "ScraperFailureRate > 50%"

## Diagnosis
1. Check scraper logs: `kubectl logs -l app=scraper`
2. Check API quotas: YouTube API console
3. Check platform status: downdetector.com

## Resolution
1. If API quota exceeded: Wait for reset or activate backup API key
2. If platform blocking: Disable that scraper, rely on other platforms
3. If code error: Fix bug, deploy hotfix

## Prevention
- Rotate API keys
- Implement graceful degradation
- Monitor quota usage
```

---

## Summary Checklist

### Before Every Commit
- [ ] Code follows style guide (Ruff/ESLint passes)
- [ ] Tests written and passing (>80% coverage)
- [ ] Type hints added (Python) / TypeScript types correct
- [ ] Docstrings/comments added
- [ ] No secrets in code
- [ ] Error handling implemented
- [ ] Logging added for key operations

### Before Every Deployment
- [ ] All tests passing in CI
- [ ] Performance benchmarks met
- [ ] Database migrations tested
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Security scan passed (pip-audit, npm audit)
- [ ] Deployment approved by tech lead

### Before Every Release
- [ ] QA testing complete
- [ ] Performance testing complete
- [ ] Security audit complete
- [ ] Documentation updated
- [ ] Release notes written
- [ ] Backup verified
- [ ] DR plan tested (quarterly)

---

## Exceptions & Waivers

If you need to violate a constraint (e.g., exceed API quota, skip a test):

1. **Document the exception** in code comments
2. **Get approval** from tech lead or CTO
3. **Create a ticket** to resolve the exception
4. **Add a TODO** with ticket number

```python
# TODO(ISSUE-123): This violates API quota limits
# EXCEPTION APPROVED BY: CTO (2026-01-01)
# REASON: Critical feature for launch, will fix in Sprint 10
# DEADLINE: 2026-03-01
def scrape_all_videos():
    # Code that exceeds quota
    pass
```

---

**Document Status**: Ready for team review
**Next Steps**: Ensure all engineers read and acknowledge these constraints

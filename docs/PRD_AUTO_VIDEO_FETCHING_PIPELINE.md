# PRD: Auto Video Fetching Pipeline

## Document Info

| Field | Value |
|-------|-------|
| **Feature** | Automatic YouTube Video Fetching & Analysis Pipeline |
| **Status** | Draft |
| **Created** | 2026-02-10 |
| **Owner** | Where2Eat Team |

---

## 1. Problem Statement

Today, discovering new restaurant content requires manual intervention: an admin must log in, paste a YouTube video URL, and trigger analysis one video at a time. There is no way to subscribe to a channel or playlist and have new videos analyzed automatically. This makes the system reactive rather than proactive and creates a bottleneck where content freshness depends on someone remembering to check for new uploads.

**Current pain points:**

1. **Manual process** - Every video must be submitted individually through the admin dashboard or CLI
2. **No new-video detection** - The system has no awareness of when channels publish new content
3. **No scheduling** - Processing is entirely on-demand; there is no background worker or scheduler
4. **No rate-limit orchestration** - If an admin submits many videos at once, they risk hitting YouTube transcript API rate limits (30s between calls) or LLM API rate limits simultaneously
5. **Limited visibility** - The admin dashboard shows individual job status but has no view into channel-level health, pipeline queues, or historical processing trends

---

## 2. Proposed Solution

Build an **Auto Video Fetching Pipeline** that:

1. Accepts YouTube **channel URLs** or **playlist URLs** as subscriptions
2. **Polls every 12 hours** for new videos on each subscribed source
3. Detects videos not yet analyzed and queues them for processing
4. Processes queued videos at a controlled rate of **1 video per hour** to respect API rate limits
5. Provides a dedicated **admin dashboard section** with real-time logs, pipeline status, queue visibility, and historical statistics

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Automated content discovery | % of new videos auto-detected within 24h of upload | > 95% |
| Reduced manual work | Admin video submissions per week | < 5 (down from ~30) |
| Rate limit compliance | API rate limit errors per week | 0 |
| Pipeline visibility | Admin time to understand pipeline health | < 10 seconds |
| System reliability | Pipeline uptime | > 99% |

---

## 4. User Stories

### Admin Users

- **US-1**: As an admin, I want to add a YouTube channel or playlist URL as a subscription so the system monitors it automatically.
- **US-2**: As an admin, I want the system to check all subscriptions every 12 hours and queue any new videos for analysis.
- **US-3**: As an admin, I want queued videos to be processed at most 1 per hour so we never hit API rate limits.
- **US-4**: As an admin, I want to see a live dashboard showing the pipeline queue, processing status, and recent logs.
- **US-5**: As an admin, I want to see statistics per channel: total videos processed, success rate, restaurants found, last check time.
- **US-6**: As an admin, I want to pause/resume a subscription without deleting it.
- **US-7**: As an admin, I want to manually trigger a check for a specific subscription outside the 12-hour schedule.
- **US-8**: As an admin, I want to set priority on a subscription so important channels are checked and processed first.
- **US-9**: As an admin, I want to receive log entries when a video fails processing, with enough detail to diagnose the issue.
- **US-10**: As an admin, I want to retry failed videos from the dashboard.

### System

- **US-11**: The system must not process more than 1 video per hour to stay within LLM and transcript API rate limits.
- **US-12**: The system must persist pipeline state across restarts (no in-memory-only queues).
- **US-13**: The system must handle duplicate detection - never re-analyze a video that already has a completed episode record.
- **US-14**: The system must gracefully handle API errors (YouTube down, LLM quota exceeded) with exponential backoff and retry.

---

## 5. Detailed Requirements

### 5.1 Subscription Management

**A subscription** represents a monitored YouTube source. It can be either a channel or a playlist.

#### Data Model: `subscriptions` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `source_type` | TEXT | `'channel'` or `'playlist'` |
| `source_url` | TEXT | Original URL provided by admin |
| `source_id` | TEXT | Resolved YouTube channel/playlist ID |
| `source_name` | TEXT | Display name (fetched from YouTube) |
| `is_active` | BOOLEAN | Whether polling is enabled (default: true) |
| `priority` | INTEGER | Processing priority (1=highest, default: 5) |
| `check_interval_hours` | INTEGER | Polling interval (default: 12) |
| `last_checked_at` | TIMESTAMP | Last successful poll time |
| `last_video_published_at` | TIMESTAMP | Publish date of most recent known video |
| `total_videos_found` | INTEGER | Cumulative videos discovered |
| `total_videos_processed` | INTEGER | Cumulative videos successfully analyzed |
| `total_restaurants_found` | INTEGER | Cumulative restaurants extracted |
| `created_at` | TIMESTAMP | When subscription was added |
| `updated_at` | TIMESTAMP | Last modification |

**Constraints:**
- `source_id` must be unique (no duplicate subscriptions to same channel/playlist)
- Supported URL formats: `youtube.com/channel/...`, `youtube.com/@handle`, `youtube.com/playlist?list=...`, `youtube.com/c/...`, `youtube.com/user/...`

#### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/subscriptions` | admin+ | List all subscriptions with stats |
| POST | `/api/admin/subscriptions` | admin+ | Add a new subscription |
| GET | `/api/admin/subscriptions/:id` | admin+ | Get subscription details + video history |
| PUT | `/api/admin/subscriptions/:id` | admin+ | Update subscription (active, priority, interval) |
| DELETE | `/api/admin/subscriptions/:id` | super_admin | Remove subscription |
| POST | `/api/admin/subscriptions/:id/check` | admin+ | Trigger immediate poll for this subscription |
| POST | `/api/admin/subscriptions/:id/pause` | admin+ | Pause subscription |
| POST | `/api/admin/subscriptions/:id/resume` | admin+ | Resume subscription |

### 5.2 Video Queue

When a poll discovers new videos, they are added to a persistent queue. Each entry tracks its lifecycle from discovery through processing.

#### Data Model: `video_queue` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `subscription_id` | TEXT FK | Source subscription |
| `video_id` | TEXT | YouTube video ID (unique constraint) |
| `video_url` | TEXT | Full YouTube URL |
| `video_title` | TEXT | Video title |
| `channel_name` | TEXT | Channel name (denormalized for display) |
| `published_at` | TIMESTAMP | Video publish date on YouTube |
| `discovered_at` | TIMESTAMP | When our system found it |
| `status` | TEXT | `queued`, `processing`, `completed`, `failed`, `skipped` |
| `priority` | INTEGER | Inherited from subscription + recency bias |
| `attempt_count` | INTEGER | Number of processing attempts (default: 0) |
| `max_attempts` | INTEGER | Max retries before marking permanently failed (default: 3) |
| `scheduled_for` | TIMESTAMP | Earliest time this video should be processed |
| `processing_started_at` | TIMESTAMP | When processing began |
| `processing_completed_at` | TIMESTAMP | When processing finished |
| `restaurants_found` | INTEGER | Count of restaurants extracted |
| `error_message` | TEXT | Last error (if failed) |
| `error_log` | TEXT | Full error trace (JSON array of all attempts) |
| `episode_id` | TEXT FK | Link to episodes table once processed |

**Constraints:**
- `video_id` is unique across the queue (no duplicate entries)
- Before inserting, check the `episodes` table - if the video_id already exists there, mark as `skipped`
- `scheduled_for` is calculated: next available slot at least 1 hour after the last scheduled/processing video

#### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/pipeline` | admin+ | Get full pipeline status (queue + active + recent) |
| GET | `/api/admin/pipeline/queue` | admin+ | List queued videos (paginated, filterable) |
| GET | `/api/admin/pipeline/history` | admin+ | List completed/failed videos (paginated) |
| POST | `/api/admin/pipeline/:id/retry` | admin+ | Retry a failed video |
| POST | `/api/admin/pipeline/:id/skip` | admin+ | Skip a queued video |
| POST | `/api/admin/pipeline/:id/prioritize` | admin+ | Move video to front of queue |
| DELETE | `/api/admin/pipeline/:id` | admin+ | Remove from queue |

### 5.3 Scheduler

The scheduler is the core engine that drives the pipeline. It runs inside the existing server process (no separate worker needed for the current scale).

#### Architecture Decision: In-Process Scheduler vs External Worker

Given the current deployment model (single Railway container running FastAPI/Express), the scheduler will run **in-process** using Python's `APScheduler` library (for FastAPI) or a lightweight `setInterval`-based approach (for Express). This avoids the complexity of Redis/Celery while the system operates at low volume (< 50 videos/day).

**If scale increases beyond ~100 videos/day**, migrate to a Redis-backed job queue (Bull for Node.js or Celery for Python).

#### Scheduler Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `poll_subscriptions` | Every 12 hours (configurable) | For each active subscription, fetch video list from YouTube, compare against known videos, insert new ones into queue |
| `process_next_video` | Every 60 minutes | Pick the highest-priority queued video whose `scheduled_for` is in the past, and process it through the full pipeline |
| `cleanup_stale_jobs` | Every 6 hours | Mark any video stuck in `processing` for > 2 hours as `failed` (allows retry) |
| `update_subscription_stats` | Every 12 hours (after poll) | Aggregate counts per subscription |

#### Poll Logic (pseudocode)

```
for each active subscription (ordered by priority, then last_checked_at ASC):
    videos = fetch_videos_from_youtube(subscription.source_id)

    for each video in videos:
        if video.id exists in episodes table → skip (already processed)
        if video.id exists in video_queue table → skip (already queued)

        insert into video_queue:
            status = 'queued'
            priority = subscription.priority
            scheduled_for = calculate_next_slot()

    update subscription.last_checked_at = now()
    update subscription.total_videos_found += new_count
```

#### Process Logic (pseudocode)

```
video = SELECT from video_queue
        WHERE status = 'queued'
        AND scheduled_for <= now()
        ORDER BY priority ASC, discovered_at ASC
        LIMIT 1

if no video → return (nothing to process)

update video.status = 'processing'
update video.processing_started_at = now()
update video.attempt_count += 1

try:
    result = backend_service.process_video(video.video_url)

    update video.status = 'completed'
    update video.processing_completed_at = now()
    update video.restaurants_found = len(result.restaurants)
    update video.episode_id = result.episode_id

    update subscription stats

    log_event('video_processed', {video_id, restaurants_found, duration})

except Exception as e:
    if video.attempt_count >= video.max_attempts:
        update video.status = 'failed'
    else:
        update video.status = 'queued'
        update video.scheduled_for = now() + backoff(attempt_count)

    update video.error_message = str(e)
    append to video.error_log

    log_event('video_failed', {video_id, error, attempt})
```

#### Rate Limit Strategy

| API | Limit | Strategy |
|-----|-------|----------|
| YouTube Transcript API | 30s between calls | Built into `YouTubeTranscriptCollector` already |
| YouTube Data API v3 | 10,000 units/day | Each `list` call costs ~1 unit; polling 20 channels twice/day = ~200 units. Well within limit |
| Claude/OpenAI LLM | Varies by tier | 1 video/hour = max 24/day. Conservative; fits within standard rate limits |
| Google Places API | Varies | Batch enrichment already has built-in delays |

### 5.4 Pipeline Logs

Every significant pipeline event is recorded for admin visibility and debugging.

#### Data Model: `pipeline_logs` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PK | UUID |
| `timestamp` | TIMESTAMP | When the event occurred |
| `level` | TEXT | `info`, `warning`, `error` |
| `event_type` | TEXT | e.g., `poll_started`, `poll_completed`, `video_queued`, `video_processing`, `video_completed`, `video_failed`, `subscription_added`, `scheduler_started` |
| `subscription_id` | TEXT FK (nullable) | Related subscription |
| `video_queue_id` | TEXT FK (nullable) | Related queue entry |
| `message` | TEXT | Human-readable log message |
| `details` | TEXT (JSON) | Structured event data |

#### API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/pipeline/logs` | admin+ | Paginated log stream (filter by level, event_type, subscription, date range) |
| GET | `/api/admin/pipeline/stats` | admin+ | Aggregate statistics (see 5.5) |

### 5.5 Statistics & Analytics

The admin dashboard should present at-a-glance pipeline health and historical trends.

#### Pipeline Stats Response (`GET /api/admin/pipeline/stats`)

```json
{
  "overview": {
    "total_subscriptions": 12,
    "active_subscriptions": 10,
    "queue_depth": 7,
    "currently_processing": 1,
    "processed_last_24h": 18,
    "processed_last_7d": 112,
    "failed_last_24h": 1,
    "total_restaurants_found_last_7d": 89,
    "next_poll_at": "2026-02-10T18:00:00Z",
    "next_video_processing_at": "2026-02-10T13:00:00Z"
  },
  "by_subscription": [
    {
      "id": "...",
      "source_name": "שף בוחן מסעדות",
      "total_videos": 245,
      "processed": 230,
      "queued": 3,
      "failed": 2,
      "restaurants_found": 412,
      "last_checked_at": "2026-02-10T06:00:00Z",
      "success_rate": 0.99
    }
  ],
  "daily_trend": [
    { "date": "2026-02-09", "processed": 20, "failed": 1, "restaurants": 15 },
    { "date": "2026-02-08", "processed": 22, "failed": 0, "restaurants": 18 }
  ]
}
```

---

## 6. Architecture

### 6.1 System Context Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      YouTube                              │
│   Channels / Playlists                                    │
└──────────────┬───────────────────────────────────────────┘
               │  YouTube Data API v3 (poll every 12h)
               ▼
┌──────────────────────────────────────────────────────────┐
│                   Scheduler Layer                         │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Poll Job     │  │ Process Job  │  │ Cleanup Job  │   │
│  │ (every 12h)  │  │ (every 1h)  │  │ (every 6h)  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘   │
│         │                 │                               │
│         ▼                 ▼                               │
│  ┌─────────────────────────────────────┐                 │
│  │        Pipeline Orchestrator        │                 │
│  │  (subscription_manager.py /         │                 │
│  │   video_queue_manager.py)           │                 │
│  └─────────────┬───────────────────────┘                 │
│                │                                          │
└────────────────┼──────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│              Existing Processing Pipeline                 │
│                                                           │
│  YouTubeTranscriptCollector                               │
│           │                                               │
│           ▼                                               │
│  UnifiedRestaurantAnalyzer (Claude / OpenAI)              │
│           │                                               │
│           ▼                                               │
│  GooglePlacesEnricher                                     │
│           │                                               │
│           ▼                                               │
│  HallucinationDetector                                    │
│           │                                               │
│           ▼                                               │
│  Database (episodes + restaurants)                        │
│                                                           │
└──────────────────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│                    Admin Dashboard                        │
│                                                           │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Subscriptions│  │ Pipeline │  │ Logs & Stats     │   │
│  │ Management   │  │ Queue    │  │                  │   │
│  └──────────────┘  └──────────┘  └──────────────────┘   │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scheduler | APScheduler (in-process) for FastAPI; `node-cron` or `setInterval` for Express | Avoids external dependencies (Redis, Celery). Sufficient for < 100 videos/day. Migrateable later. |
| Queue persistence | SQLite `video_queue` table | Consistent with existing data layer. Survives restarts. No new infrastructure. |
| Log storage | SQLite `pipeline_logs` table | Same rationale. For high-volume logging, add log rotation (delete logs older than 30 days). |
| Polling vs Webhooks | Polling (YouTube Data API) | YouTube PubSubHubbub webhooks require a public callback URL and are unreliable for small channels. Polling every 12h is simpler and sufficient. |
| Processing rate | 1 video/hour (configurable) | Conservative default that avoids all known rate limits. Can be tuned per deployment. |
| Dual server support | Implement in Python (FastAPI path) | The Docker/Railway deployment uses FastAPI. The Express server can proxy to Python or run its own scheduler via `node-cron`. Both paths are covered. |

### 6.3 New Files

| File | Purpose |
|------|---------|
| `src/subscription_manager.py` | CRUD for subscriptions, YouTube source resolution |
| `src/video_queue_manager.py` | Queue operations: enqueue, dequeue, status updates, scheduling |
| `src/pipeline_scheduler.py` | APScheduler setup, job definitions, rate limit enforcement |
| `src/pipeline_logger.py` | Structured logging to `pipeline_logs` table |
| `api/routes/admin-subscriptions.js` | Express routes for subscription management |
| `api/routes/admin-pipeline.js` | Express routes for pipeline queue, logs, stats |
| `admin/app/dashboard/subscriptions/page.tsx` | Subscriptions management UI |
| `admin/app/dashboard/pipeline/page.tsx` | Pipeline queue & status UI |
| `admin/app/dashboard/pipeline/logs/page.tsx` | Log viewer UI |
| `tests/test_subscription_manager.py` | Subscription manager tests |
| `tests/test_video_queue_manager.py` | Queue manager tests |
| `tests/test_pipeline_scheduler.py` | Scheduler tests |
| `tests/test_pipeline_logger.py` | Logger tests |
| `web/src/components/__tests__/pipeline.test.tsx` | Frontend component tests (if applicable) |

### 6.4 Modified Files

| File | Change |
|------|--------|
| `src/database.py` | Add `subscriptions`, `video_queue`, `pipeline_logs` table creation to schema |
| `src/backend_service.py` | Add methods: `get_subscriptions()`, `add_subscription()`, `get_pipeline_status()`, `get_pipeline_logs()` |
| `src/config.py` | Add config constants: `POLL_INTERVAL_HOURS`, `PROCESS_INTERVAL_MINUTES`, `MAX_RETRY_ATTEMPTS`, `VIDEO_PROCESSING_RATE_LIMIT_MINUTES` |
| `api/index.js` | Mount new route modules |
| `api/main.py` | Start scheduler on FastAPI startup, add new endpoints |
| `admin/lib/api.ts` | Add API client methods for subscriptions and pipeline |
| `admin/app/dashboard/layout.tsx` | Add sidebar navigation items for Subscriptions and Pipeline |
| `Dockerfile` | Add `apscheduler` to requirements |
| `requirements.txt` | Add `apscheduler>=3.10.0` |

---

## 7. UI/UX Design

### 7.1 Admin Dashboard: Subscriptions Page (`/dashboard/subscriptions`)

```
┌─────────────────────────────────────────────────────────────┐
│  📡 Channel Subscriptions                     [+ Add New]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Active (10) ──────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  ┌───────────────────────────────────────────────────┐  │ │
│  │  │ שף בוחן מסעדות             Priority: 1   ● Active │  │ │
│  │  │ youtube.com/@chef-reviewer                        │  │ │
│  │  │ 245 videos │ 412 restaurants │ Last: 2h ago       │  │ │
│  │  │ [Check Now] [Pause] [Edit] [Details →]            │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  │  ┌───────────────────────────────────────────────────┐  │ │
│  │  │ ביקורת אוכל ישראלי          Priority: 3  ● Active │  │ │
│  │  │ youtube.com/@food-reviews-il                      │  │ │
│  │  │ 180 videos │ 298 restaurants │ Last: 2h ago       │  │ │
│  │  │ [Check Now] [Pause] [Edit] [Details →]            │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Paused (2) ───────────────────────────────────────────┐ │
│  │  ...                                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Add Subscription Dialog:**
- Input field for YouTube URL (channel or playlist)
- System resolves the URL and fetches channel/playlist name
- Priority selector (1-5)
- Polling interval override (default: 12 hours)
- Confirmation with channel name and estimated video count

### 7.2 Admin Dashboard: Pipeline Page (`/dashboard/pipeline`)

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙ Processing Pipeline                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Overview ──────────────────────────────────────────────┐│
│  │                                                          ││
│  │   Queued     Processing    Last 24h     Failed          ││
│  │   ┌───┐     ┌───┐         ┌───┐        ┌───┐           ││
│  │   │ 7 │     │ 1 │         │ 18│        │ 1 │           ││
│  │   └───┘     └───┘         └───┘        └───┘           ││
│  │                                                          ││
│  │   Next poll: in 4h 23m    Next process: in 12m          ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Currently Processing ──────────────────────────────────┐│
│  │                                                          ││
│  │  🔄 "המסעדות הכי טובות בתל אביב 2026"                  ││
│  │     שף בוחן מסעדות │ Started 23m ago                    ││
│  │     Step: Enriching restaurants (4/6)                    ││
│  │     ████████████░░░░ 67%                                ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Queue ──────────────────────────────────────────────── ┐│
│  │  [Filter: All ▾]  [Sort: Priority ▾]                    ││
│  │                                                          ││
│  │  #  Title                    Channel        Scheduled    ││
│  │  ── ──────────────────────── ────────────── ──────────  ││
│  │  1  טעימות בשוק הכרמל       שף בוחן        in 12m      ││
│  │  2  מסעדות חדשות בירושלים    ביקורת אוכל    in 1h 12m   ││
│  │  3  הפיצה הטובה בארץ        שף בוחן        in 2h 12m   ││
│  │  ...                                                     ││
│  │                                          Page 1 of 2    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Recent Activity ───────────────────────────────────────┐│
│  │                                                          ││
│  │  ✅ 11:23  "סיור אוכל בנמל יפו"         4 restaurants  ││
│  │  ✅ 10:20  "ברים חדשים בפלורנטין"        2 restaurants  ││
│  │  ❌ 09:15  "טעימות בחיפה" - Transcript unavailable      ││
│  │  ✅ 08:12  "מסעדה סודית בנווה צדק"       3 restaurants  ││
│  │  ...                                                     ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Admin Dashboard: Pipeline Logs Page (`/dashboard/pipeline/logs`)

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Pipeline Logs                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Level: All ▾] [Type: All ▾] [Channel: All ▾] [Date ▾]   │
│                                                             │
│  Time         Level   Event                Message          │
│  ──────────── ─────── ──────────────────── ──────────────── │
│  12:00:05     INFO    poll_started         Polling 10       │
│                                            subscriptions    │
│  12:00:12     INFO    video_queued         New: "טעימות     │
│                                            בשוק" (שף בוחן) │
│  12:00:12     INFO    video_queued         New: "מסעדות     │
│                                            חדשות" (ביקורת)  │
│  12:00:15     INFO    poll_completed       Found 2 new      │
│                                            videos           │
│  12:01:00     INFO    video_processing     Starting:        │
│                                            "סיור בנמל יפו"  │
│  12:04:32     INFO    video_completed      Done: 4          │
│                                            restaurants       │
│  12:05:00     WARNING rate_limit_near      YouTube API:     │
│                                            8,500/10,000     │
│  ...                                                        │
│                                                             │
│  [Load More]                                                │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Design Principles

- **Hebrew-first**: All admin UI supports RTL. Channel/video names display in Hebrew naturally.
- **Real-time feel**: Pipeline page auto-refreshes every 10 seconds (consistent with existing videos page).
- **Progressive disclosure**: Overview cards at top, expandable detail sections below.
- **Actionable**: Every item has contextual actions (retry, skip, prioritize, pause).
- **Color semantics**: Green = success/active, Blue = processing, Yellow = warning/queued, Red = error/failed, Gray = paused/skipped.
- **Component consistency**: Use existing shadcn/ui components (Card, Button, Badge, Table, Dialog, Tabs) and TanStack Table for lists.

---

## 8. Testing Strategy

### 8.1 TDD Approach

All development follows the existing TDD requirements: write failing tests first, then implement.

### 8.2 Python Backend Tests

| Test File | Covers | Key Scenarios |
|-----------|--------|---------------|
| `test_subscription_manager.py` | `subscription_manager.py` | Add/remove/update subscriptions; URL resolution for channels, playlists, handles; duplicate detection; active/paused filtering |
| `test_video_queue_manager.py` | `video_queue_manager.py` | Enqueue new videos; skip already-processed; dequeue by priority; retry logic with backoff; max attempts; scheduling calculations |
| `test_pipeline_scheduler.py` | `pipeline_scheduler.py` | Poll triggers correctly; process triggers at 1/hour; stale job cleanup; graceful shutdown; restart recovery |
| `test_pipeline_logger.py` | `pipeline_logger.py` | Log creation; level filtering; pagination; log rotation (30-day cleanup) |

**Mocking strategy:**
- YouTube Data API calls: mock `googleapiclient.discovery.build`
- LLM calls: mock `UnifiedRestaurantAnalyzer`
- Google Places: mock `GooglePlacesEnricher`
- Time: mock `datetime.now()` and `time.sleep()` for scheduler tests

### 8.3 API Tests

| Test Area | Approach |
|-----------|----------|
| Subscription CRUD | HTTP assertions on Express routes with mocked Python backend |
| Pipeline endpoints | Status codes, response shapes, auth enforcement |
| Rate limit headers | Verify X-RateLimit headers if implemented |

### 8.4 Frontend Tests

| Test Area | Framework | Approach |
|-----------|-----------|----------|
| Subscriptions page | Jest + RTL | Render, mock API responses, verify subscription list, add/pause actions |
| Pipeline page | Jest + RTL | Render queue, verify status indicators, auto-refresh behavior |
| Logs page | Jest + RTL | Filter controls, log entry rendering, pagination |

### 8.5 Integration Tests

| Test | Description |
|------|-------------|
| Poll → Queue | Mock YouTube API, verify new videos land in queue with correct priority and scheduling |
| Queue → Process | Mock processing pipeline, verify video moves through statuses correctly |
| Failure → Retry | Simulate processing failure, verify retry with backoff, verify max attempts |
| Full cycle | Mock all externals, run poll + process + verify DB state end-to-end |

### 8.6 Coverage Target

- New Python code: > 90% line coverage
- New frontend components: > 80% branch coverage
- Integration tests: Cover all happy paths and top 5 error scenarios

---

## 9. Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Channel has 500+ videos on first subscription | Only queue the most recent N videos (configurable, default: 50). Older videos can be backfilled manually. |
| YouTube API quota exceeded during poll | Log warning, mark subscription as "poll_failed", retry on next cycle. Do not block other subscriptions. |
| Video transcript unavailable (private, age-restricted, no captions) | Mark as `failed` with descriptive error. Do not retry automatically (these are permanent failures). |
| LLM API down during processing | Retry with exponential backoff (1h, 2h, 4h). Max 3 attempts. |
| Server restart mid-processing | `cleanup_stale_jobs` will mark stuck videos as failed. They re-enter the queue for retry. |
| Duplicate video across channel and playlist | `video_id` unique constraint prevents double-queuing. |
| Channel deleted or made private | Poll returns empty/error. Log warning. Subscription stays active for manual review by admin. |
| Database lock contention (SQLite) | Use WAL mode (already enabled). Queue operations use short transactions. |
| Admin adds subscription with 0 videos | Create subscription, log info. Next poll will discover videos when they appear. |
| Clock skew / timezone issues | All timestamps stored in UTC. Display in admin's local timezone. |

---

## 10. Configuration

All pipeline settings should be configurable via `src/config.py` and optionally overridable via environment variables.

| Setting | Default | Env Var | Description |
|---------|---------|---------|-------------|
| `POLL_INTERVAL_HOURS` | 12 | `PIPELINE_POLL_INTERVAL_HOURS` | How often to check subscriptions |
| `PROCESS_INTERVAL_MINUTES` | 60 | `PIPELINE_PROCESS_INTERVAL_MINUTES` | Minimum gap between processing videos |
| `MAX_RETRY_ATTEMPTS` | 3 | `PIPELINE_MAX_RETRY_ATTEMPTS` | Max retries for failed videos |
| `MAX_INITIAL_VIDEOS` | 50 | `PIPELINE_MAX_INITIAL_VIDEOS` | Max videos to queue on first subscription |
| `STALE_JOB_TIMEOUT_HOURS` | 2 | `PIPELINE_STALE_TIMEOUT_HOURS` | When to consider a processing job stuck |
| `LOG_RETENTION_DAYS` | 30 | `PIPELINE_LOG_RETENTION_DAYS` | How long to keep pipeline logs |
| `SCHEDULER_ENABLED` | true | `PIPELINE_SCHEDULER_ENABLED` | Kill switch for the scheduler |

---

## 11. Security Considerations

- All subscription/pipeline endpoints require admin authentication (JWT)
- Subscription add/edit requires `admin` or `super_admin` role
- Subscription deletion requires `super_admin` role
- YouTube URLs are validated before being passed to API calls
- Python subprocess calls use parameterized inputs (no shell injection)
- Pipeline logs do not contain API keys or tokens
- Rate limiting on admin API endpoints prevents abuse (existing Helmet + express-rate-limit)

---

## 12. Observability & Monitoring

- **Pipeline logs table** provides audit trail for debugging
- **Scheduler heartbeat**: Log `scheduler_heartbeat` event every cycle to confirm the scheduler is running
- **Health endpoint extension**: Extend existing `/health` endpoint to include pipeline status:
  ```json
  {
    "status": "healthy",
    "pipeline": {
      "scheduler_running": true,
      "last_poll": "2026-02-10T06:00:00Z",
      "queue_depth": 7,
      "last_processed": "2026-02-10T11:23:00Z"
    }
  }
  ```
- **Alerting** (future): If queue depth > 100 or failed rate > 20% in 24h, trigger admin notification

---

## 13. Sprint Plan

### Sprint 1: Foundation (Backend Core)

**Goal**: Database schema, subscription manager, video queue manager, and core tests.

| # | Task | Type | Estimate |
|---|------|------|----------|
| 1.1 | Add `subscriptions`, `video_queue`, `pipeline_logs` tables to `database.py` | BE | S |
| 1.2 | Write `test_subscription_manager.py` (TDD: tests first) | Test | M |
| 1.3 | Implement `subscription_manager.py` - CRUD, URL resolution, duplicate detection | BE | M |
| 1.4 | Write `test_video_queue_manager.py` (TDD: tests first) | Test | M |
| 1.5 | Implement `video_queue_manager.py` - enqueue, dequeue, priority, scheduling, retry | BE | L |
| 1.6 | Write `test_pipeline_logger.py` (TDD: tests first) | Test | S |
| 1.7 | Implement `pipeline_logger.py` - structured logging, rotation | BE | S |
| 1.8 | Add config constants to `config.py` | BE | S |
| 1.9 | Integration test: subscription → queue flow | Test | M |

**Deliverables**: All 3 new tables, subscription manager, queue manager, logger. All with passing tests at > 90% coverage.

**Dependencies**: None. Pure backend work.

---

### Sprint 2: Scheduler & Pipeline Orchestration

**Goal**: In-process scheduler that polls subscriptions and processes videos automatically.

| # | Task | Type | Estimate |
|---|------|------|----------|
| 2.1 | Add `apscheduler` to `requirements.txt` and `Dockerfile` | DevOps | S |
| 2.2 | Write `test_pipeline_scheduler.py` (TDD: tests first) | Test | L |
| 2.3 | Implement `pipeline_scheduler.py` - poll job, process job, cleanup job | BE | L |
| 2.4 | Integrate scheduler startup into `api/main.py` (FastAPI `on_startup`) | BE | M |
| 2.5 | Wire scheduler to `BackendService.process_video()` for actual processing | BE | M |
| 2.6 | Implement stale job cleanup logic | BE | S |
| 2.7 | Add scheduler status to `/health` endpoint | BE | S |
| 2.8 | Integration test: full poll → queue → process → complete cycle | Test | L |
| 2.9 | Manual testing: deploy to staging, add a real channel, verify 12h poll + 1h process | QA | M |

**Deliverables**: Working scheduler that automatically discovers and processes new videos. Health endpoint reports pipeline status.

**Dependencies**: Sprint 1 completed.

---

### Sprint 3: API & Admin Dashboard - Subscriptions

**Goal**: Admin can manage subscriptions through the dashboard.

| # | Task | Type | Estimate |
|---|------|------|----------|
| 3.1 | Implement `api/routes/admin-subscriptions.js` - full CRUD + check/pause/resume | BE | M |
| 3.2 | Add subscription API client methods to `admin/lib/api.ts` | FE | S |
| 3.3 | Build `admin/app/dashboard/subscriptions/page.tsx` - list view with active/paused sections | FE | L |
| 3.4 | Build Add Subscription dialog with URL validation and channel name preview | FE | M |
| 3.5 | Build subscription detail view (video history, stats) | FE | M |
| 3.6 | Add Subscriptions to sidebar navigation in dashboard layout | FE | S |
| 3.7 | Frontend tests for subscription components | Test | M |
| 3.8 | API tests for subscription routes | Test | M |
| 3.9 | UX review: RTL layout, Hebrew content, responsive design | Design | S |

**Deliverables**: Fully functional subscription management page in admin dashboard.

**Dependencies**: Sprint 1 (subscription manager), Sprint 2 (scheduler for "Check Now" action).

---

### Sprint 4: Admin Dashboard - Pipeline & Logs

**Goal**: Admin can monitor the pipeline queue, view logs, and see statistics.

| # | Task | Type | Estimate |
|---|------|------|----------|
| 4.1 | Implement `api/routes/admin-pipeline.js` - queue, history, logs, stats endpoints | BE | M |
| 4.2 | Add pipeline API client methods to `admin/lib/api.ts` | FE | S |
| 4.3 | Build `admin/app/dashboard/pipeline/page.tsx` - overview cards, current processing, queue, recent activity | FE | L |
| 4.4 | Build `admin/app/dashboard/pipeline/logs/page.tsx` - filterable log viewer | FE | M |
| 4.5 | Build pipeline stats charts using Recharts (daily trend, per-channel breakdown) | FE | M |
| 4.6 | Implement queue actions: retry, skip, prioritize from UI | FE | M |
| 4.7 | Add Pipeline to sidebar navigation | FE | S |
| 4.8 | Auto-refresh behavior (10s interval) for pipeline page | FE | S |
| 4.9 | Frontend tests for pipeline components | Test | M |
| 4.10 | API tests for pipeline routes | Test | M |
| 4.11 | End-to-end test: add subscription → wait for poll → verify pipeline page updates | Test | L |

**Deliverables**: Full pipeline monitoring dashboard with real-time queue, log viewer, and statistics.

**Dependencies**: Sprint 2 (scheduler running), Sprint 3 (subscriptions exist).

---

### Sprint 5: Polish, Edge Cases & Production Readiness

**Goal**: Harden the system, handle edge cases, optimize for production.

| # | Task | Type | Estimate |
|---|------|------|----------|
| 5.1 | Implement max initial videos cap (50) for new subscriptions | BE | S |
| 5.2 | Implement log rotation (delete > 30 days) | BE | S |
| 5.3 | Handle permanent failures (no transcript, private video) - don't retry | BE | S |
| 5.4 | Add scheduler kill switch (`PIPELINE_SCHEDULER_ENABLED` env var) | BE | S |
| 5.5 | Add exponential backoff for retries (1h, 2h, 4h) | BE | M |
| 5.6 | Playlist support: resolve playlist URLs, enumerate videos | BE | M |
| 5.7 | Error boundary and empty states for all new admin pages | FE | M |
| 5.8 | Loading skeletons for subscription and pipeline pages | FE | S |
| 5.9 | CI pipeline: add new test files to CI workflow | DevOps | S |
| 5.10 | Update `CLAUDE.md` with new modules, tables, endpoints, commands | Docs | S |
| 5.11 | Update Railway deployment config if needed | DevOps | S |
| 5.12 | Performance test: simulate 50 subscriptions, 500 queued videos | Test | M |
| 5.13 | Security review: validate all new endpoints, check for injection | Security | M |
| 5.14 | Staging deployment and 48-hour soak test | QA | L |

**Deliverables**: Production-ready auto video fetching pipeline. Updated docs and CI.

**Dependencies**: All prior sprints.

---

## 14. Future Enhancements (Out of Scope)

These are explicitly **not** part of this PRD but are worth noting for future consideration:

1. **YouTube PubSubHubbub webhooks** - Real-time notifications instead of polling. Requires stable public URL.
2. **Redis-backed job queue** - For scaling beyond 100 videos/day. Bull (Node.js) or Celery (Python).
3. **Admin notifications** - Email/Slack alerts for pipeline failures or anomalies.
4. **Smart scheduling** - Adjust poll frequency based on channel upload patterns (channels that post daily get checked more often).
5. **Content filtering** - Allow admins to set keyword filters (e.g., only food-related videos from a general lifestyle channel).
6. **Multi-language expansion** - Support non-Hebrew channels with language-specific analyzers.
7. **Batch backfill UI** - Admin tool to queue historical videos from a channel in bulk.
8. **Pipeline analytics in main frontend** - Show "freshness" indicators to end users (e.g., "3 new restaurants added today").

---

## 15. Glossary

| Term | Definition |
|------|------------|
| **Subscription** | A monitored YouTube channel or playlist that the system checks periodically for new videos |
| **Video Queue** | The ordered list of discovered videos waiting to be processed |
| **Pipeline** | The end-to-end flow from video discovery through transcript extraction, AI analysis, and database storage |
| **Poll** | The act of checking a subscription's YouTube source for new videos |
| **Processing** | Running a video through the full analysis pipeline (transcript → LLM → enrichment → DB) |
| **Backoff** | Increasing the delay between retry attempts after failures |

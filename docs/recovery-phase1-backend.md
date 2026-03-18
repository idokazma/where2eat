# Recovery Phase 1: Backend — FastAPI Routes + Security

## Status: Complete

## Objective
Make the Railway FastAPI deployment feature-complete with the Express.js version by adding missing admin routes and security headers.

## Changes

### 1. Subscription Management Routes (`api/routers/admin_subscriptions.py`) — NEW
Full CRUD for YouTube channel/playlist subscriptions:

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/admin/subscriptions` | List all subscriptions | user |
| POST | `/api/admin/subscriptions` | Add new subscription | admin |
| GET | `/api/admin/subscriptions/:id` | Get subscription details | user |
| PUT | `/api/admin/subscriptions/:id` | Update subscription | admin |
| DELETE | `/api/admin/subscriptions/:id` | Delete subscription | super_admin |
| POST | `/api/admin/subscriptions/:id/pause` | Pause subscription | admin |
| POST | `/api/admin/subscriptions/:id/resume` | Resume subscription | admin |
| POST | `/api/admin/subscriptions/:id/check` | Trigger immediate poll | admin |

### 2. Pipeline Management Routes (`api/routers/admin_pipeline.py`) — NEW
Queue monitoring, logs, and video management:

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/admin/pipeline` | Pipeline overview (status counts) | user |
| GET | `/api/admin/pipeline/queue` | Paginated queue listing | user |
| GET | `/api/admin/pipeline/history` | Completed/failed videos | user |
| GET | `/api/admin/pipeline/logs` | Filterable pipeline logs | user |
| GET | `/api/admin/pipeline/stats` | Processing statistics | user |
| POST | `/api/admin/pipeline/:id/retry` | Retry failed video | admin |
| POST | `/api/admin/pipeline/:id/skip` | Skip queued video | admin |
| POST | `/api/admin/pipeline/:id/prioritize` | Move to front of queue | admin |
| DELETE | `/api/admin/pipeline/:id` | Remove from queue | admin |

### 3. Security Headers Middleware (`api/main.py`) — MODIFIED
Added `SecurityHeadersMiddleware` to all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### 4. Fixed Mock Jobs Endpoint (`api/routers/analyze.py`) — MODIFIED
Replaced hardcoded mock data in `GET /api/jobs` with real database queries.
Falls back to empty list if jobs table is unavailable.

### 5. Router Registration (`api/routers/__init__.py`, `api/main.py`) — MODIFIED
Registered `admin_subscriptions_router` and `admin_pipeline_router` in the FastAPI app.

## Tests

### New Test File: `tests/test_fastapi_admin_routes.py`
28 tests covering:
- **SubscriptionManager** (11 tests): add, list, get, update, pause/resume, delete, duplicate detection, URL validation
- **VideoQueueManager** (7 tests): enqueue, get queue, skip, prioritize, remove, history, queue depth
- **PipelineLogger** (4 tests): create logs, filter by level, filter by event_type, pagination
- **URL Resolution** (6 tests): playlist URL, channel handle, channel ID, mobile URL, invalid URL, video URL with list param

All 28 tests pass.

## Known Issues
- The `check` endpoint (`POST /api/admin/subscriptions/:id/check`) calls `PipelineScheduler._fetch_channel_videos()` synchronously. For large channels this could be slow.
- Pipeline stats queries use `julianday()` arithmetic for avg processing time — this works with SQLite but wouldn't port to other databases.

## Dependencies
- No new Python packages required — all routes use existing `src/` modules
- `starlette` (already bundled with FastAPI) for `BaseHTTPMiddleware`

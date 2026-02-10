# Recovery Phase 2: Pipeline Activation

## Status: Complete

## Objective
Provide tooling to seed subscriptions and activate the auto video pipeline on production.

## Changes

### 1. Seed Subscription Script (`scripts/seed_subscription.py`) — NEW
CLI tool for managing subscriptions and pipeline state.

**Commands:**
```bash
# Add a subscription (auto-normalizes video+list URLs to playlist URLs)
python scripts/seed_subscription.py add \
  --url "https://www.youtube.com/watch?v=J6Akd1bXiWM&list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg" \
  --name "Hebrew Food Podcast" \
  --priority 3

# List all subscriptions
python scripts/seed_subscription.py list
python scripts/seed_subscription.py list --all  # include inactive

# Trigger immediate poll for all active subscriptions
python scripts/seed_subscription.py poll

# Show pipeline status
python scripts/seed_subscription.py status
```

**Key features:**
- Automatically converts `/watch?v=xxx&list=PLxxx` URLs to `/playlist?list=PLxxx` format
- Works locally and on Railway (`railway run python scripts/seed_subscription.py`)
- Respects `DATABASE_DIR` env var for Railway volume mounts
- Shows queue depth after polling

## Activation Steps (Post Phase 1 Deploy)

### Step 1: Deploy Phase 1 to Railway
Merge the Phase 1 PR to get the subscription/pipeline admin routes live.

### Step 2: Seed the playlist subscription
**Option A — Via API (requires admin JWT token):**
```bash
curl -X POST https://where2eat-production.up.railway.app/api/admin/subscriptions \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_url": "https://www.youtube.com/playlist?list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg",
    "source_name": "Hebrew Food Podcast",
    "priority": 3
  }'
```

**Option B — Via Railway CLI:**
```bash
railway run python scripts/seed_subscription.py add \
  --url "https://www.youtube.com/watch?v=J6Akd1bXiWM&list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg" \
  --name "Hebrew Food Podcast" \
  --priority 3
```

### Step 3: Verify pipeline picks it up
The scheduler polls every 12 hours (configurable via `PIPELINE_POLL_INTERVAL_HOURS`).
To trigger immediately:
```bash
# Via Railway CLI
railway run python scripts/seed_subscription.py poll

# Then check status
railway run python scripts/seed_subscription.py status
```

### Step 4: Verify Google Places API
Check Google Cloud Console:
- Places API (New) is enabled
- API key stored in Railway's `GOOGLE_PLACES_API_KEY` is valid and unrestricted

### Step 5: Monitor
```bash
# Check queue via API
curl https://where2eat-production.up.railway.app/api/admin/pipeline/queue \
  -H "Authorization: Bearer <TOKEN>"

# Check logs
curl https://where2eat-production.up.railway.app/api/admin/pipeline/logs \
  -H "Authorization: Bearer <TOKEN>"

# Check restaurants appear
curl https://where2eat-production.up.railway.app/api/restaurants
```

## Tests

### New Test File: `tests/test_seed_subscription.py`
8 tests covering:
- **URL Normalization** (4 tests): video+list to playlist, direct playlist passthrough, channel passthrough, video without list
- **Subscription Add** (2 tests): add playlist subscription with normalized URL, add and list
- **Status Command** (2 tests): empty database, database with data

All 8 tests pass.

## Known Issues
- `YOUTUBE_DATA_API_KEY` must be set on Railway for playlist video fetching to work. Without it, the scheduler's `_fetch_playlist_videos()` returns empty.
- The scheduler runs poll every 12h by default. First poll won't happen until the interval fires. Use `poll` command or the `/check` endpoint to trigger immediately.
- Google Places API is returning `REQUEST_DENIED` — needs manual verification in Google Cloud Console.

## Environment Variables Required on Railway
- `YOUTUBE_DATA_API_KEY` — For fetching playlist videos via YouTube Data API
- `GOOGLE_PLACES_API_KEY` — For restaurant location enrichment (currently failing)
- `ANTHROPIC_API_KEY` — For Claude-based transcript analysis

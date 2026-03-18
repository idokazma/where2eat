# PRD: Admin Dashboard Enhancement

## Problem Statement

The current admin panel at `/admin` in the main web app is minimal. It shows basic stats (total restaurants, active jobs) and lets the admin submit a YouTube URL for analysis. It lacks visibility into:
- Which YouTube videos have been fetched and analyzed
- What restaurants were extracted from each video
- The pipeline queue: pending videos, their priority, and scheduled processing time
- The ability to trigger immediate analysis on specific pending videos

The backend already has comprehensive API endpoints for pipeline management, subscriptions, and detailed queue/history data — but the admin UI doesn't surface any of it.

## Goals

1. Give the admin full visibility into the system's operational state
2. Show analyzed videos with their extracted restaurants
3. Show the pending video queue with scheduling details
4. Allow the admin to trigger analysis on specific pending videos
5. Allow the admin to manage the queue (prioritize, skip, retry, remove)

## Non-Goals

- Building a separate admin app (enhance the existing `/admin` page)
- User management / RBAC changes
- Subscription management UI (already exists in the separate admin dashboard)
- Article/CMS management

## Design

### Tab-Based Layout

The admin dashboard will use a tabbed interface with 4 tabs:

#### Tab 1: Overview (default)
- **System stats cards**: Total restaurants, total episodes analyzed, queue depth, pipeline health
- **Pipeline stats**: Completed last 24h, completed last 7d, failure rate, avg processing time
- **Currently processing**: If a video is being processed, show it prominently
- **Recent activity**: Last 5 completed/failed items

#### Tab 2: Analyzed Videos
- **Paginated list** of all completed videos from the pipeline history + episodes table
- Each row shows: video title, channel name, analysis date, restaurants found count, status
- **Expandable rows**: Click to see the list of restaurants extracted from that video
- **Search/filter**: Filter by channel name or video title

#### Tab 3: Restaurants
- **Paginated table** of all restaurants
- Columns: Name (Hebrew), City, Cuisine, Rating, Source Video, Date Added
- **Search**: Filter by name, city, cuisine
- Click row to see full restaurant details

#### Tab 4: Pipeline Queue
- **Queue overview cards**: Queued count, processing count, failed count, skipped count
- **Pending videos list**: Sortable by priority and scheduled time
  - Each row: video title, channel, priority, scheduled time, attempt count
  - **Actions per video**:
    - "Analyze Now" button — prioritizes and triggers immediate processing
    - "Skip" button — marks as skipped
    - "Remove" button — deletes from queue
- **Failed videos section**: Videos that failed processing
  - Each row: video title, error message, attempt count
  - **Actions**: "Retry" button, "Remove" button
- **Auto-refresh**: Queue refreshes every 15 seconds

### New API Endpoints Needed

The backend already has most endpoints. We need to add:

1. `GET /api/admin/episodes` — List all analyzed episodes with restaurant counts
2. `GET /api/admin/pipeline/:id/analyze-now` — Prioritize a video AND trigger immediate processing

### Existing API Endpoints Used

- `GET /api/admin/pipeline` — Pipeline overview (queue counts)
- `GET /api/admin/pipeline/queue` — Queued videos list
- `GET /api/admin/pipeline/history` — Completed/failed videos
- `GET /api/admin/pipeline/stats` — Pipeline statistics
- `POST /api/admin/pipeline/:id/retry` — Retry failed video
- `POST /api/admin/pipeline/:id/skip` — Skip video
- `POST /api/admin/pipeline/:id/prioritize` — Prioritize video
- `DELETE /api/admin/pipeline/:id` — Remove from queue
- `GET /api/restaurants` — All restaurants
- `POST /api/analyze` — Analyze a video URL

## Technical Approach

- Enhance `web/src/app/admin/page.tsx` — refactor into sub-components
- Add new components under `web/src/app/admin/components/`
- Add admin-specific endpoint helpers to `web/src/lib/config.ts`
- Add 1-2 new Express API routes for episodes listing
- Use existing shadcn/ui Tabs component for the tabbed layout
- Auto-refresh using `setInterval` with configurable intervals
- All data fetched client-side with proper loading/error states

## Success Criteria

- Admin can see all analyzed videos and their extracted restaurants
- Admin can see the full pipeline queue with scheduling info
- Admin can trigger immediate analysis on any pending video
- Admin can manage the queue (prioritize, skip, retry, remove)
- All existing tests pass
- New frontend tests cover the new components

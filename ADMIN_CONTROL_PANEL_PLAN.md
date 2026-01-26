# Where2Eat Admin Control Panel - Comprehensive Plan

**Created:** 2026-01-26
**Branch:** `feature/admin-dashboard`
**Status:** Planning Phase

---

## Executive Summary

This document outlines the implementation plan for an enhanced Admin Control Panel focused on:

1. **API Connection Testing** - Real-time connectivity checks for all external services
2. **Restaurant Data Management** - View, filter, and manage all restaurant records
3. **Job Status Monitoring** - Real-time job queue with progress tracking
4. **Error Monitoring & Logging** - Centralized error tracking and alerting
5. **System Health Dashboard** - Comprehensive system metrics and diagnostics

---

## 1. API Connection Testing Panel

### 1.1 Overview

A dedicated panel to test and monitor all API connections in real-time.

### 1.2 Services to Monitor

| Service | Endpoint | Health Check Method |
|---------|----------|---------------------|
| Express API | `/health` | HTTP GET |
| YouTube Transcript | `/api/youtube-transcript/health` | HTTP GET |
| Google Places API | Test search query | API call |
| Claude/Anthropic API | Test prompt | API call |
| OpenAI API | Test prompt | API call |
| SQLite Database | Connection test | Query execution |

### 1.3 UI Components

```
┌─────────────────────────────────────────────────────────────┐
│ API Connection Status                      [Test All] [↻]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 Express API Server                                   │ │
│ │    Status: Online | Response: 45ms | Last: 2 min ago    │ │
│ │    [Test Now]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 YouTube Transcript API                               │ │
│ │    Status: Healthy | Rate Limit: 28/30s remaining       │ │
│ │    Cache: Enabled (245 entries)                         │ │
│ │    [Test Now]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟡 Google Places API                                    │ │
│ │    Status: Warning | Quota: 78% used today              │ │
│ │    API Key: ****3d8f | Last: 5 min ago                  │ │
│ │    [Test Now]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 Claude API (Anthropic)                               │ │
│ │    Status: Online | Model: claude-3.5-sonnet            │ │
│ │    API Key: ****ak-1 | Last: 10 min ago                 │ │
│ │    [Test Now]                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔴 OpenAI API                                           │ │
│ │    Status: Error | Message: Invalid API key             │ │
│ │    API Key: ****xxxx | Last: 1 min ago                  │ │
│ │    [Test Now] [Configure]                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🟢 SQLite Database                                      │ │
│ │    Status: Connected | Size: 12.5 MB                    │ │
│ │    Tables: 7 | Records: 1,247 restaurants               │ │
│ │    [Test Now] [Vacuum]                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 API Endpoints Required

```javascript
// New endpoints to add to api/index.js

// Test all connections
GET /api/admin/system/connections/test-all

// Test individual connection
POST /api/admin/system/connections/test
  Body: { service: 'youtube' | 'google-places' | 'claude' | 'openai' | 'database' }

// Get connection history
GET /api/admin/system/connections/history?service=youtube&limit=100

// Get API key status (masked)
GET /api/admin/system/api-keys/status
```

### 1.5 Backend Service Methods

```python
# Add to src/backend_service.py

def test_youtube_connection(self) -> dict:
    """Test YouTube transcript API connectivity"""

def test_google_places_connection(self) -> dict:
    """Test Google Places API with a simple search"""

def test_claude_connection(self) -> dict:
    """Test Claude API with a minimal prompt"""

def test_openai_connection(self) -> dict:
    """Test OpenAI API with a minimal prompt"""

def test_database_connection(self) -> dict:
    """Test SQLite database connectivity and integrity"""

def get_api_key_status(self) -> dict:
    """Return masked API key status for all services"""
```

---

## 2. Restaurant Data Management Panel

### 2.1 Enhanced Restaurant List View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Restaurants (1,247 total)                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Search: [________________] [🔍]   Filters: [Status ▼] [Cuisine ▼] [City ▼]│
│                                                                         │
│ [☐] [✓ Select All]  Selected: 3    [Bulk Actions ▼]    [Export ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│ [☐] │ Name           │ City      │ Cuisine   │ Status │ Rating │ Actions│
│─────│────────────────│───────────│───────────│────────│────────│────────│
│ [☑] │ חומוס הכרמל    │ תל אביב   │ Israeli   │ 🟢 Open│ ⭐ 4.5 │ ✏️ 🗑️ 👁️│
│ [☑] │ מסעדת האחים    │ ירושלים  │ Middle Eastern│ 🟢 Open│ ⭐ 4.2│ ✏️ 🗑️ 👁️│
│ [☐] │ פיצה שמש      │ חיפה      │ Italian   │ 🔴 Closed│ ⭐ 3.8│ ✏️ 🗑️ 👁️│
│ [☑] │ סושי יאקימונו  │ תל אביב   │ Japanese  │ 🟡 New │ ⭐ 4.7 │ ✏️ 🗑️ 👁️│
├─────────────────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 1,247    [◀ Prev] [1] [2] [3] ... [50] [Next ▶]         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Restaurant Detail View (Quick Panel)

```
┌─────────────────────────────────────────────────────────────┐
│ חומוס הכרמל                                    [Edit] [✕]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐  Basic Info                                 │
│ │   [Image]   │  English: Hummus HaCarmel                   │
│ │             │  Cuisine: Israeli                           │
│ │             │  Status: 🟢 Open                            │
│ └─────────────┘  Price: ₪₪ (Moderate)                       │
│                                                             │
│ Location                                                    │
│ ├─ City: תל אביב                                            │
│ ├─ Neighborhood: שוק הכרמל                                   │
│ ├─ Address: רחוב הכרמל 45                                   │
│ └─ Region: Center                                           │
│                                                             │
│ Google Data                                                 │
│ ├─ Place ID: ChIJxxxxxxxxxx                                │
│ ├─ Rating: ⭐ 4.5 (1,234 reviews)                           │
│ ├─ Coordinates: 32.0669, 34.7691                            │
│ └─ Last Enriched: 2026-01-15                                │
│                                                             │
│ Source Episode                                              │
│ ├─ Video: "Best Hummus in Tel Aviv" (YouTube)               │
│ ├─ Channel: Israeli Food Guide                              │
│ ├─ Analyzed: 2026-01-10                                     │
│ └─ Host Opinion: 😍 Positive                                │
│                                                             │
│ Edit History                                                │
│ ├─ Created: 2026-01-10 by System                            │
│ ├─ Updated: 2026-01-15 by admin@where2eat.com               │
│ └─ [View Full History]                                      │
│                                                             │
│ [Re-Enrich from Google] [View on Map] [Delete]              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Data Quality Indicators

Add visual indicators for data completeness:

```
┌─ Data Quality Score: 85% ─────────────────────────────────┐
│ ████████████████░░░░                                      │
│                                                           │
│ ✅ Name (Hebrew)      ✅ City           ✅ Cuisine        │
│ ✅ Name (English)     ✅ Neighborhood   ✅ Status         │
│ ❌ Address            ✅ Google Place   ⚠️ Image (low res)│
│ ✅ Phone              ✅ Coordinates    ✅ Episode Link   │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Job Status Monitoring Panel

### 3.1 Job Queue Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Processing Jobs                                           [+ New Job]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Active Jobs (2)                                                         │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ 🔄 Channel: Israeli Food Guide                                    │   │
│ │    Status: Processing video 8 of 25                               │   │
│ │    Progress: ████████████░░░░░░░░ 32%                             │   │
│ │    Current: "שוק מחנה יהודה - המדריך המלא"                         │   │
│ │    Restaurants Found: 47                                          │   │
│ │    Started: 15 min ago | ETA: ~30 min                             │   │
│ │    [Pause] [Cancel] [View Details]                                │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ 🔄 Video: Best Hummus Spots 2026                                  │   │
│ │    Status: Analyzing transcript                                   │   │
│ │    Progress: ██████████████████░░ 90%                             │   │
│ │    Step: Extracting restaurant mentions                           │   │
│ │    Started: 2 min ago                                             │   │
│ │    [Cancel] [View Details]                                        │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Pending Jobs (3)                                                        │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ ⏳ Video: "Tel Aviv Street Food Tour"          Queued: 5 min ago  │   │
│ │ ⏳ Video: "Haifa Hidden Gems"                  Queued: 8 min ago  │   │
│ │ ⏳ Channel: Foodies Israel (12 videos)         Queued: 10 min ago │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Recent Completed (10)                                       [View All]  │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ ✅ Video: "Jerusalem Old City Food"    12 restaurants   1 hr ago  │   │
│ │ ✅ Video: "Herzliya Beach Restaurants"  8 restaurants   2 hrs ago │   │
│ │ ❌ Video: "Private Video"              Error: Not accessible 3h    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Job Detail View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Job Details: Channel Processing                                    [✕]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Job ID: job_abc123                                                      │
│ Type: channel_processing                                                │
│ Status: 🔄 Processing                                                   │
│ Channel: Israeli Food Guide                                             │
│ URL: https://youtube.com/@IsraeliFoodGuide                              │
│                                                                         │
│ Progress                                                                │
│ ├─ Videos Total: 25                                                     │
│ ├─ Completed: 8                                                         │
│ ├─ Failed: 1                                                            │
│ ├─ Remaining: 16                                                        │
│ └─ Restaurants Found: 47                                                │
│                                                                         │
│ Current Video                                                           │
│ ├─ Title: שוק מחנה יהודה - המדריך המלא                                  │
│ ├─ Step: analyzing_transcript                                           │
│ └─ Progress: Extracting restaurant mentions...                          │
│                                                                         │
│ Processing Log                                                          │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ 12:45:32 - Started processing channel                             │   │
│ │ 12:45:33 - Found 25 videos to process                             │   │
│ │ 12:45:35 - Processing video 1: "Best Hummus Tel Aviv"             │   │
│ │ 12:46:12 - Video 1 complete: 5 restaurants found                  │   │
│ │ 12:46:15 - Processing video 2: "Shuk HaCarmel Tour"               │   │
│ │ 12:47:01 - Video 2 complete: 8 restaurants found                  │   │
│ │ ...                                                               │   │
│ │ 12:58:45 - Video 7 failed: Transcript not available               │   │
│ │ 12:58:48 - Processing video 8: "שוק מחנה יהודה"                    │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Extracted Restaurants (47)                                  [View All]  │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ ☑ חומוס הכרמל - תל אביב                         [Approve] [Reject]│   │
│ │ ☑ מסעדת האחים - ירושלים                         [Approve] [Reject]│   │
│ │ ☐ פיצה אמריקנה - חיפה (Duplicate?)              [Approve] [Reject]│   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ [Pause Job] [Cancel Job] [Approve All] [Export Results]                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.3 New Job Creation Form

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Create New Processing Job                                          [✕]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Job Type:                                                               │
│ ○ Single Video                                                          │
│ ● Entire Channel                                                        │
│ ○ Playlist                                                              │
│                                                                         │
│ YouTube URL:                                                            │
│ [https://youtube.com/@IsraeliFoodGuide_________________________]        │
│ ✅ Valid channel URL detected                                           │
│                                                                         │
│ ┌─ Preview ─────────────────────────────────────────────────────────┐   │
│ │ Channel: Israeli Food Guide                                       │   │
│ │ Subscribers: 125K                                                 │   │
│ │ Total Videos: 342                                                 │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Processing Options:                                                     │
│ ├─ Max Videos: [25______] (leave empty for all)                         │
│ ├─ Skip Already Processed: [✓]                                          │
│ ├─ Language Filter: [Hebrew ▼]                                          │
│ ├─ Date Range: [2025-01-01] to [2026-01-26]                             │
│ └─ Auto-Enrich with Google Places: [✓]                                  │
│                                                                         │
│ Priority:                                                               │
│ ○ Low (queue end)                                                       │
│ ● Normal                                                                │
│ ○ High (queue front)                                                    │
│                                                                         │
│                                              [Cancel] [Create Job]      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Error Monitoring & Logging Panel

### 4.1 Error Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Error Monitoring                                        [Clear All] [↻] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Error Summary (Last 24 Hours)                                           │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                         │
│ │   12    │ │    3    │ │    8    │ │    1    │                         │
│ │ Total   │ │ Critical│ │ Warning │ │ Info    │                         │
│ │ Errors  │ │ 🔴      │ │ 🟡      │ │ 🔵      │                         │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                         │
│                                                                         │
│ Error Trend (7 Days)                                                    │
│     │    *                                                              │
│  15 │   * *                                                             │
│     │  *   *    *                                                       │
│  10 │ *     *  * *                                                      │
│     │        **   *  *                                                  │
│   5 │              **                                                   │
│     └───────────────────────────────────────                            │
│       Mon Tue Wed Thu Fri Sat Sun                                       │
│                                                                         │
│ Filter: [All Types ▼] [All Services ▼] [Last 24h ▼] [Search...]         │
├─────────────────────────────────────────────────────────────────────────┤
│ Time       │ Level │ Service         │ Message                 │ Count │
│────────────│───────│─────────────────│─────────────────────────│───────│
│ 12:45:32   │ 🔴    │ YouTube API     │ Rate limit exceeded     │   3   │
│ 12:30:15   │ 🟡    │ Google Places   │ Quota warning (80%)     │   1   │
│ 12:15:00   │ 🔴    │ OpenAI API      │ Invalid API key         │   5   │
│ 11:58:22   │ 🟡    │ Job Processing  │ Video transcript N/A    │   2   │
│ 11:45:10   │ 🔵    │ Database        │ Vacuum completed        │   1   │
├─────────────────────────────────────────────────────────────────────────┤
│ Showing 1-10 of 12                              [◀ Prev] [Next ▶]       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Error Detail View

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Error Details                                                      [✕]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Error ID: err_xyz789                                                    │
│ Level: 🔴 Critical                                                      │
│ Service: OpenAI API                                                     │
│ First Occurred: 2026-01-26 11:15:00                                     │
│ Last Occurred: 2026-01-26 12:15:00                                      │
│ Occurrences: 5                                                          │
│                                                                         │
│ Message:                                                                │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ Error: Invalid API key provided. Please check your OpenAI API    │   │
│ │ key in the environment variables.                                 │   │
│ │                                                                   │   │
│ │ OpenAI Error Code: invalid_api_key                                │   │
│ │ HTTP Status: 401                                                  │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Stack Trace:                                                            │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ File "src/openai_restaurant_analyzer.py", line 45, in analyze    │   │
│ │   response = openai.chat.completions.create(...)                 │   │
│ │ File "openai/api_resources.py", line 123, in create              │   │
│ │   raise AuthenticationError("Invalid API key")                   │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Context:                                                                │
│ ├─ Job ID: job_abc123                                                   │
│ ├─ Video: "Best Restaurants Tel Aviv"                                   │
│ ├─ Analyzer: OpenAI (gpt-4)                                             │
│ └─ Fallback: Claude API used successfully                               │
│                                                                         │
│ Resolution:                                                             │
│ ├─ Status: ⚠️ Unresolved                                               │
│ ├─ Suggested Action: Update OPENAI_API_KEY in .env                      │
│ └─ Documentation: https://platform.openai.com/api-keys                  │
│                                                                         │
│ [Mark Resolved] [Ignore] [Create Issue] [Copy Details]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Error Logging Database Schema

```sql
-- Add to database.py

CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_id TEXT UNIQUE NOT NULL,
    level TEXT NOT NULL CHECK(level IN ('critical', 'warning', 'info', 'debug')),
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    context TEXT,  -- JSON
    job_id TEXT,
    video_id TEXT,
    first_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    occurrence_count INTEGER DEFAULT 1,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES admin_users(id),
    resolution_notes TEXT
);

CREATE INDEX idx_error_logs_level ON error_logs(level);
CREATE INDEX idx_error_logs_service ON error_logs(service);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_error_logs_first_occurred ON error_logs(first_occurred);
```

---

## 5. System Health Dashboard

### 5.1 Overview Metrics Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│ System Health                                    Last Updated: Just now │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │
│ │ 🟢 HEALTHY      │ │ API Uptime      │ │ DB Size         │             │
│ │                 │ │    99.9%        │ │   12.5 MB       │             │
│ │ All Systems OK  │ │ (30 days)       │ │ (+2.1 MB/week)  │             │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘             │
│                                                                         │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │
│ │ Memory Usage    │ │ Active Jobs     │ │ Error Rate      │             │
│ │    245 MB       │ │      2          │ │   0.3%          │             │
│ │ ███████░░░ 68%  │ │ (3 pending)     │ │ (last hour)     │             │
│ └─────────────────┘ └─────────────────┘ └─────────────────┘             │
│                                                                         │
│ Response Times (Last Hour)                                              │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ Endpoint             │ p50    │ p95    │ p99    │ Requests        │   │
│ │──────────────────────│────────│────────│────────│─────────────────│   │
│ │ GET /api/restaurants │ 45ms   │ 120ms  │ 250ms  │ 1,234           │   │
│ │ GET /api/search      │ 78ms   │ 180ms  │ 350ms  │ 567             │   │
│ │ POST /api/analyze    │ 2.3s   │ 4.5s   │ 8.2s   │ 45              │   │
│ │ GET /health          │ 12ms   │ 25ms   │ 40ms   │ 892             │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Database Statistics Panel

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Database Statistics                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ Storage                                                                 │
│ ├─ Total Size: 12.5 MB                                                  │
│ ├─ Tables: 7                                                            │
│ ├─ Indexes: 12                                                          │
│ └─ Last Vacuum: 2026-01-25 03:00:00                                     │
│                                                                         │
│ Record Counts                                                           │
│ ┌───────────────────────────────────────────────────────────────────┐   │
│ │ Table            │ Count    │ Growth (7d) │ Size Est.             │   │
│ │──────────────────│──────────│─────────────│───────────────────────│   │
│ │ restaurants      │ 1,247    │ +89         │ 8.2 MB                │   │
│ │ episodes         │ 156      │ +12         │ 2.1 MB                │   │
│ │ jobs             │ 234      │ +45         │ 0.5 MB                │   │
│ │ admin_users      │ 5        │ +0          │ 0.1 MB                │   │
│ │ restaurant_edits │ 892      │ +156        │ 1.2 MB                │   │
│ │ articles         │ 23       │ +3          │ 0.3 MB                │   │
│ │ error_logs       │ 45       │ +12         │ 0.1 MB                │   │
│ └───────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│ Data Distribution                                                       │
│ ├─ Restaurants by Region: North (15%), Center (60%), South (25%)        │
│ ├─ Restaurants by Status: Open (78%), Closed (12%), New (10%)           │
│ └─ Jobs by Status: Completed (89%), Failed (8%), Cancelled (3%)         │
│                                                                         │
│ Maintenance Actions                                                     │
│ [Run Vacuum] [Optimize Indexes] [Export Backup] [View Query Stats]      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Real-time Activity Monitor

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Live Activity Feed                                         [Pause] [↻]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 12:45:32  🔄  Job job_abc123 processing video 8/25                      │
│ 12:45:30  ✅  Restaurant "חומוס הכרמל" enriched with Google data        │
│ 12:45:28  📝  admin@where2eat.com updated restaurant "מסעדת האחים"       │
│ 12:45:25  🔍  API request: GET /api/restaurants?city=תל אביב            │
│ 12:45:20  ✅  Job job_xyz456 completed: 12 restaurants found            │
│ 12:45:15  ⚠️  Rate limit warning: YouTube API (28/30s remaining)        │
│ 12:45:10  🔄  Job job_abc123 processing video 7/25                      │
│ 12:45:05  📊  Analytics query: timeline (7 days)                        │
│ 12:45:00  ✅  Health check passed: all systems operational              │
│ 12:44:55  🔍  API request: GET /api/restaurants/search?q=hummus         │
│                                                                         │
│ [Show More]                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Plan

### Phase 1: API Connection Testing (Week 1)

**Backend:**
1. Add connection test methods to `backend_service.py`
2. Create `/api/admin/system/connections/*` endpoints
3. Implement API key status endpoint (masked)

**Frontend:**
1. Create `ApiConnectionPanel` component
2. Add individual service status cards
3. Implement "Test All" functionality
4. Add auto-refresh (every 60s)

**Files to modify/create:**
- `src/backend_service.py` - Add test methods
- `api/routes/admin-system.js` - New route file
- `api/index.js` - Register routes
- `admin/src/app/(dashboard)/system/page.tsx` - System dashboard
- `admin/src/components/system/api-connection-panel.tsx`

### Phase 2: Enhanced Job Monitoring (Week 2)

**Backend:**
1. Add detailed job progress tracking
2. Implement job pause/resume functionality
3. Add processing log storage

**Frontend:**
1. Create `JobQueuePanel` component
2. Add real-time progress updates (WebSocket or polling)
3. Implement job detail view with logs
4. Add job creation form

**Files to modify/create:**
- `src/database.py` - Add job_logs table
- `api/routes/admin-videos.js` - Enhance endpoints
- `admin/src/app/(dashboard)/videos/page.tsx` - Enhanced UI
- `admin/src/components/videos/job-queue-panel.tsx`
- `admin/src/components/videos/job-detail-dialog.tsx`

### Phase 3: Error Monitoring System (Week 3)

**Backend:**
1. Create error_logs table
2. Implement error aggregation logic
3. Add error resolution tracking

**Frontend:**
1. Create `ErrorMonitoringPanel` component
2. Add error trend visualization
3. Implement error detail view
4. Add filtering and search

**Files to modify/create:**
- `src/database.py` - Add error_logs table
- `src/backend_service.py` - Add error logging methods
- `api/routes/admin-errors.js` - New route file
- `admin/src/app/(dashboard)/errors/page.tsx`
- `admin/src/components/errors/error-dashboard.tsx`

### Phase 4: System Health Dashboard (Week 4)

**Backend:**
1. Implement response time tracking
2. Add memory/resource monitoring
3. Create database statistics queries

**Frontend:**
1. Create `SystemHealthDashboard` component
2. Add metrics visualization with charts
3. Implement real-time activity feed
4. Add maintenance action buttons

**Files to modify/create:**
- `src/backend_service.py` - Add stats methods
- `api/routes/admin-system.js` - Add health endpoints
- `admin/src/app/(dashboard)/system/health/page.tsx`
- `admin/src/components/system/health-dashboard.tsx`
- `admin/src/components/system/activity-feed.tsx`

---

## 7. API Endpoint Summary

### New Endpoints to Implement

```javascript
// Connection Testing
GET  /api/admin/system/connections/status      // All connection statuses
POST /api/admin/system/connections/test        // Test specific connection
GET  /api/admin/system/connections/history     // Connection test history
GET  /api/admin/system/api-keys/status         // API key status (masked)

// Error Monitoring
GET  /api/admin/errors                         // List errors with filters
GET  /api/admin/errors/:id                     // Error details
POST /api/admin/errors/:id/resolve             // Mark error resolved
GET  /api/admin/errors/summary                 // Error summary stats
DELETE /api/admin/errors/clear                 // Clear resolved errors

// System Health
GET  /api/admin/system/health                  // Comprehensive health check
GET  /api/admin/system/stats                   // Database statistics
GET  /api/admin/system/metrics                 // Response time metrics
GET  /api/admin/system/activity                // Real-time activity feed
POST /api/admin/system/maintenance/vacuum      // Run database vacuum
POST /api/admin/system/maintenance/backup      // Create database backup

// Enhanced Job Management
GET  /api/admin/jobs/:id/logs                  // Job processing logs
POST /api/admin/jobs/:id/pause                 // Pause job
POST /api/admin/jobs/:id/resume                // Resume job
GET  /api/admin/jobs/queue                     // Queue status with position
```

---

## 8. Database Schema Additions

```sql
-- Error Logs
CREATE TABLE IF NOT EXISTS error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    error_id TEXT UNIQUE NOT NULL,
    level TEXT NOT NULL CHECK(level IN ('critical', 'warning', 'info', 'debug')),
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    context TEXT,
    job_id TEXT,
    video_id TEXT,
    first_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_occurred TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    occurrence_count INTEGER DEFAULT 1,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES admin_users(id),
    resolution_notes TEXT
);

-- Job Processing Logs
CREATE TABLE IF NOT EXISTS job_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL CHECK(level IN ('info', 'warning', 'error')),
    message TEXT NOT NULL,
    video_id TEXT,
    metadata TEXT
);

-- Connection Test History
CREATE TABLE IF NOT EXISTS connection_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failure', 'timeout')),
    response_time_ms INTEGER,
    error_message TEXT,
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tested_by INTEGER REFERENCES admin_users(id)
);

-- System Metrics (for historical tracking)
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metadata TEXT
);

-- Indexes
CREATE INDEX idx_error_logs_level ON error_logs(level);
CREATE INDEX idx_error_logs_service ON error_logs(service);
CREATE INDEX idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX idx_job_logs_job_id ON job_logs(job_id);
CREATE INDEX idx_connection_tests_service ON connection_tests(service);
CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
```

---

## 9. Component Library

### New Components to Create

```
admin/src/components/
├── system/
│   ├── api-connection-panel.tsx       # API connection status cards
│   ├── connection-status-card.tsx     # Individual connection card
│   ├── health-dashboard.tsx           # System health overview
│   ├── database-stats.tsx             # Database statistics panel
│   ├── activity-feed.tsx              # Real-time activity feed
│   └── maintenance-actions.tsx        # Maintenance buttons
├── errors/
│   ├── error-dashboard.tsx            # Error monitoring main panel
│   ├── error-summary-cards.tsx        # Error count summary
│   ├── error-trend-chart.tsx          # Error trend visualization
│   ├── error-list.tsx                 # Filterable error list
│   └── error-detail-dialog.tsx        # Error detail modal
├── videos/
│   ├── job-queue-panel.tsx            # Enhanced job queue
│   ├── job-progress-card.tsx          # Individual job progress
│   ├── job-detail-dialog.tsx          # Job detail with logs
│   ├── job-creation-form.tsx          # New job creation
│   └── processing-log-viewer.tsx      # Real-time log viewer
└── restaurants/
    ├── data-quality-indicator.tsx     # Data completeness score
    ├── restaurant-quick-panel.tsx     # Quick view side panel
    └── bulk-actions-toolbar.tsx       # Enhanced bulk actions
```

---

## 10. Tech Stack for New Features

### Frontend Libraries to Add

```json
{
  "dependencies": {
    "recharts": "^2.12.0",           // Charts for metrics
    "socket.io-client": "^4.7.0",    // Real-time updates (optional)
    "date-fns": "^3.3.0",            // Date formatting
    "react-virtuoso": "^4.6.0"       // Virtual scrolling for logs
  }
}
```

### Backend Dependencies

```
# requirements.txt additions
psutil>=5.9.0        # System metrics
schedule>=1.2.0      # Background metric collection
```

---

## 11. Security Considerations

1. **API Key Masking** - Never expose full API keys in responses
2. **Rate Limiting** - Protect test endpoints from abuse
3. **Audit Logging** - Log all admin actions including tests
4. **Role-Based Access** - Only super_admin can view API keys and run maintenance
5. **Error Sanitization** - Remove sensitive data from error logs

---

## 12. Testing Plan

### Unit Tests
- Connection test methods
- Error aggregation logic
- Metrics calculation

### Integration Tests
- API endpoint responses
- Database operations
- Real-time updates

### E2E Tests
- Full admin workflow
- Error resolution flow
- Job monitoring flow

---

## Next Steps

1. Review and approve this plan
2. Set up the feature branch worktree (done)
3. Begin Phase 1 implementation
4. Create GitHub issues for each phase
5. Set up CI/CD for admin app

---

**Document Version:** 1.0
**Last Updated:** 2026-01-26
**Author:** Claude Code

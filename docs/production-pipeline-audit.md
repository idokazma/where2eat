# Production Pipeline Audit & Fix Report

**Date**: 2026-02-13
**Status**: Fixed & Deployed
**Branch**: `fix/production-pipeline-e2e`
**PR**: #69

## Executive Summary

A thorough end-to-end audit of the Where2Eat production system revealed that **0/11 restaurants on production had images, coordinates, or Google Places data**. Multiple bugs in the data pipeline caused enrichment data to be lost between SQLite, PostgreSQL, and the API. All issues have been fixed and deployed. Production now shows **10/11 restaurants with full enrichment data**.

## Issues Found & Fixed

### CRITICAL-1: PostgreSQL Write-Through Missing Enrichment Fields

**File**: `src/backend_service.py`

When `process_video()` writes enriched restaurants to PostgreSQL, it omitted:
- `latitude` / `longitude` (coordinates)
- `photos` (JSON array of photo references)
- `google_name` / `google_url` (Google Places metadata)
- `image_url`

**Fix**: Added all missing fields to the PostgreSQL write-through RestaurantModel constructor.

### CRITICAL-2: SQLite-to-PostgreSQL Sync Missing Fields + No Updates

**File**: `api/main.py` `sync_sqlite_to_postgres()`

Two problems:
1. Sync omitted `photos`, `google_name`, `google_url` fields
2. Sync only inserted NEW records — existing restaurants with null data were skipped

**Fix**: Added all missing fields and made sync UPDATE existing restaurants where enrichment data is null but SQLite has values.

### CRITICAL-3: Database `_row_to_restaurant()` Missing Coordinates

**File**: `src/database.py`

The `location` dict didn't include `lat`/`lng`, so the API always returned null coordinates.

**Fix**: Added `lat`/`lng` from `latitude`/`longitude` columns to the location dict.

### CRITICAL-4: models.base Relative Import Failure on Railway

**File**: `api/main.py`

The dynamic module loading via `importlib.util.spec_from_file_location` failed because `restaurant.py` uses `from .base import Base` (relative import) which requires a package context.

**Fix**: Register synthetic `models` package and `models.base` in `sys.modules` before loading restaurant.py.

### CRITICAL-5: PostgreSQL Tables Not Created Before Sync

**File**: `api/main.py`

`sync_sqlite_to_postgres()` tried to query tables that didn't exist yet.

**Fix**: Call `init_db()` to create tables before syncing.

### HIGH-1: Pipeline Scheduler Not Enriching Restaurants

**File**: `src/pipeline_scheduler.py`

`process_video()` was called without `enrich_with_google=True`, so auto-processed videos were never enriched with Google Places data.

**Fix**: Added `enrich_with_google=True` to the process_video call.

### HIGH-2: API Key Exposure in Photo URLs

**File**: `src/google_places_enricher.py`

Photo URLs stored full Google Places API URLs with the API key embedded. The frontend proxy system was designed to hide the key, but the enricher bypassed it.

**Fix**: Store only `photo_reference` strings. Set `image_url` to the reference for database storage.

### MEDIUM-1: Double JSON Encoding of Photos

**Files**: `src/backend_service.py`, `src/database.py`

`reenrich_all_restaurants()` called `json.dumps(photos)` before passing to `update_restaurant()`, which also called `json.dumps()`, resulting in double-encoded JSON strings.

**Fix**:
1. Removed pre-serialization in `reenrich_all_restaurants()`
2. Added double-decode guard in `_row_to_restaurant()` for robustness

### MEDIUM-2: SQLAlchemy ORM Conflict in Re-enrichment

**File**: `src/backend_service.py`

Dynamic module loading in `sync_sqlite_to_postgres` conflicted with the ORM session used in `reenrich_all_restaurants()`.

**Fix**: Replaced ORM query with raw SQL `text()` for PostgreSQL updates.

## Production State

### Before Fix
| Metric | Value |
|--------|-------|
| Total restaurants | 11 |
| With image_url | 0 |
| With photos (list) | 0 |
| With coordinates | 0 |
| With google_place_id | 0 |

### After Fix
| Metric | Value |
|--------|-------|
| Total restaurants | 11 |
| With image_url | 10 |
| With photos (list) | 10 |
| With coordinates | 10 |
| With google_place_id | 10 |
| Not found on Google | 1 (מיז'נה) |

## Remaining: Vercel Photo Proxy

The frontend photo proxy at `/api/photos/[reference]` returns 500 because `GOOGLE_PLACES_API_KEY` is not set on Vercel.

**Action needed**: Add `GOOGLE_PLACES_API_KEY` environment variable to the Vercel project settings.

## Files Modified

| File | Changes |
|------|---------|
| `src/backend_service.py` | Fix PG write-through, add reenrich method, fix double-encoding, raw SQL for PG updates |
| `src/database.py` | Fix `_row_to_restaurant()` coordinates + double-decode guard for photos |
| `api/main.py` | Fix sync (relative imports, table creation, update existing records, JSON parsing) |
| `api/routers/analyze.py` | Add POST `/api/reenrich` endpoint |
| `src/google_places_enricher.py` | Remove API key from photo URLs, store only photo_reference |
| `src/pipeline_scheduler.py` | Add `enrich_with_google=True` to process_video |

## Commits

1. `7f39e34` - fix: Restore missing enrichment data in production pipeline
2. `1319d96` - fix: Remove API key exposure from photo URLs and enable enrichment in pipeline
3. `b0252a9` - fix: Resolve models.base relative import in sync_sqlite_to_postgres
4. `6f7441d` - fix: Initialize PostgreSQL tables before sync on startup
5. `4da2571` - fix: Sync enrichment data to existing PostgreSQL records on startup
6. `5d779b2` - fix: Use raw SQL for PostgreSQL updates in re-enrichment
7. `f324e81` - fix: Parse JSON photos string before storing in PostgreSQL JSON column
8. `84f04e4` - fix: Remove double JSON encoding of photos in reenrich
9. `60e8a70` - fix: Handle double-encoded JSON photos in _row_to_restaurant

## Verification Checklist

- [x] PostgreSQL write-through includes all enrichment fields
- [x] SQLite-to-PostgreSQL sync includes all enrichment fields + updates existing
- [x] `_row_to_restaurant()` includes lat/lng in location
- [x] Pipeline scheduler enriches with Google Places
- [x] Photo URLs store only references (no API key exposure)
- [x] Production: 10/11 restaurants have images, coordinates, photos
- [x] API returns photos as proper JSON arrays (not double-encoded strings)
- [ ] Vercel: `GOOGLE_PLACES_API_KEY` env var needs to be added
- [ ] Frontend: restaurant cards show images (blocked by Vercel env var)

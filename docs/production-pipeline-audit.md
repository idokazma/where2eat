# Production Pipeline Audit & Fix Plan

**Date**: 2026-02-13
**Status**: In Progress
**Branch**: `fix/production-pipeline-e2e`

## Executive Summary

A thorough end-to-end audit of the Where2Eat production system revealed that **no restaurants on production have images, coordinates, or Google Places data**. The pipeline scheduler is running but transcript fetching fails for all queued videos. This document details every issue found and the fixes applied.

## Issues Found

### CRITICAL-1: PostgreSQL Write-Through Missing Enrichment Fields

**File**: `src/backend_service.py` (lines 560-625)

When `process_video()` writes enriched restaurants to PostgreSQL, it **omits** these fields:
- `latitude` / `longitude` (coordinates)
- `photos` (JSON array of photo references)
- `google_name` / `google_url` / `enriched_at` (Google Places metadata)

**Impact**: Every restaurant written to PostgreSQL via pipeline processing has null images, null coordinates, and no Google Places metadata.

**Fix**: Add all missing fields to the PostgreSQL write-through RestaurantModel constructor.

### CRITICAL-2: SQLite-to-PostgreSQL Sync Missing Fields

**File**: `api/main.py` `sync_sqlite_to_postgres()` (lines 469-506)

The sync function copies restaurants from SQLite to PostgreSQL on startup, but **omits**:
- `photos` (JSON array)
- `google_name` / `google_url` / `enriched_at`

**Impact**: Even if SQLite has enriched data, it gets lost during sync to PostgreSQL.

**Fix**: Add all missing fields to the sync function's RestaurantModel constructor.

### CRITICAL-3: Database `_row_to_restaurant()` Missing Coordinates in Location

**File**: `src/database.py` `_row_to_restaurant()` (lines 483-513)

The method reconstructs the nested `location` dict from flat DB columns but **does not include `lat`/`lng`** in the location object. The API's Pydantic `Location` model expects `lat`/`lng`, so the frontend always sees `null` coordinates in `location.lat`/`location.lng`.

```python
# BEFORE (broken):
restaurant['location'] = {
    'city': restaurant.pop('city', None),
    'neighborhood': restaurant.pop('neighborhood', None),
    'address': restaurant.pop('address', None),
    'region': restaurant.pop('region', 'Center')
}
# latitude/longitude remain as top-level fields, not in location

# AFTER (fixed):
restaurant['location'] = {
    'city': restaurant.pop('city', None),
    'neighborhood': restaurant.pop('neighborhood', None),
    'address': restaurant.pop('address', None),
    'region': restaurant.pop('region', 'Center'),
    'lat': restaurant.get('latitude'),
    'lng': restaurant.get('longitude'),
}
```

### CRITICAL-4: Transcript Fetching Failing for All Videos in Production

**Evidence**: Production logs show `Error: No transcript found for video: XXX in languages: ['he']` repeated for ~30+ video IDs. The pipeline scheduler has 37 videos queued but cannot process any.

**Root Cause**: The subscribed playlist videos may not have auto-generated captions enabled. The youtube-transcript-api tries `['he']` then `['en']` then `['he']` again (3 attempts for same languages).

**Fix**: Expand language fallback list to include `['he', 'iw', 'en', 'a.he', 'a.en']` (auto-generated Hebrew/English). Also ensure the pipeline properly handles and logs these failures.

### HIGH-1: Frontend Photo Proxy Works but Never Gets Photo Data

**Files**: `web/src/lib/images.ts`, `web/src/app/api/photos/[reference]/route.ts`

The frontend has a well-designed photo proxy system that:
1. Takes a `photo_reference` string
2. Proxies it through `/api/photos/[reference]` to hide the API key
3. Caches responses for 1 week

**Issue**: Since production restaurants have `null` image_url and empty `photos[]`, the frontend falls back to cuisine-based gradient backgrounds for every restaurant.

**Fix**: No frontend changes needed - this will be resolved when the backend starts providing photo data.

### MEDIUM-1: Local Database Has API Keys in image_url

The 11 restaurants in the local SQLite have `image_url` values like:
```
https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=AZLas...&key=AIzaSy...
```

This is the old data format. The current `google_places_enricher.py` correctly stores just the `photo_reference` string (line 216).

**Fix**: Clean up local data to store only photo references, not full URLs with API keys.

## Production State (Before Fix)

| Metric | Value |
|--------|-------|
| Total restaurants | 11 |
| With image_url | 0 |
| With photos | 0 |
| With coordinates | 0 |
| With google_place_id | 0 |
| Queued videos | 37 |
| Successfully processed | 0 (all failing) |
| Pipeline scheduler | Running |
| Transcript success rate | 0% |

## Fix Implementation Plan

### Phase 1: Fix Data Storage Bugs

1. **Fix PostgreSQL write-through** in `backend_service.py`
   - Add `latitude`, `longitude`, `photos`, `google_name`, `google_url`, `enriched_at`

2. **Fix SQLite-to-PostgreSQL sync** in `api/main.py`
   - Add `photos`, `google_name`, `google_url`, `enriched_at`

3. **Fix `_row_to_restaurant()`** in `database.py`
   - Include `lat`/`lng` in the location dict

### Phase 2: Fix Transcript Fetching

4. **Expand language fallback list** in `pipeline_scheduler.py`
   - Try auto-generated captions: `['he', 'iw', 'a.he', 'en', 'a.en']`

### Phase 3: Fix Image URL Format

5. **Clean up image_url storage** in `backend_service.py`
   - Ensure `image_url` stores only photo references, not full URLs

### Phase 4: Test End-to-End Locally

6. **Run local pipeline test** with a video that has transcripts
7. **Verify data in SQLite** - images, coordinates, photos
8. **Verify API response** - all fields populated
9. **Verify frontend display** - images render correctly

### Phase 5: Deploy & Verify Production

10. **Deploy to Railway**
11. **Trigger re-enrichment** of existing 11 restaurants
12. **Verify production API** returns complete data
13. **Verify frontend** displays images

## Files Modified

| File | Changes |
|------|---------|
| `src/backend_service.py` | Fix PostgreSQL write-through, fix image_url storage |
| `src/database.py` | Fix `_row_to_restaurant()` to include coordinates in location |
| `api/main.py` | Fix `sync_sqlite_to_postgres()` to include all fields |
| `src/pipeline_scheduler.py` | Fix language fallback list for transcripts |

## Verification Checklist

- [ ] PostgreSQL write-through includes all enrichment fields
- [ ] SQLite-to-PostgreSQL sync includes all enrichment fields
- [ ] `_row_to_restaurant()` includes lat/lng in location
- [ ] Pipeline scheduler tries auto-generated captions
- [ ] Local test: video analyzed, restaurants enriched, images displayed
- [ ] Production: restaurants have images, coordinates, photos
- [ ] Frontend: restaurant cards show images instead of gradients

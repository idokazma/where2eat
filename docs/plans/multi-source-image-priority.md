# Plan: Multi-Source Restaurant Image Priority System

## Context
Google Places photos are often low-quality user uploads (blurry interior shots, parking lots, etc.). We want a priority-based image system that prefers:
1. Google Places **owner-attributed photos** (business owners upload their best shots)
2. Restaurant website **og:image** meta tag (curated hero images)
3. Fall back to current behavior (first Google Places photo)

## Changes

### 1. Google Places Enricher — Request `authorAttributions` & prioritize owner photos
**File**: `src/google_places_enricher.py`

- Add `places.photos.authorAttributions` to the `X-Goog-FieldMask` in both search and details requests (lines 126, 157)
- Increase photo fetch limit from 3 to 10 (line 379) to have a larger pool to select from
- In `_map_new_api_response()` (line 228-240): extract `authorAttributions` from each photo and set an `is_owner_photo` flag (owner photos have `authorAttributions` with a URI matching the business)
- In `_merge_google_data()` (line 376-393): **sort photos** so owner-attributed photos come first, then store the top 5
- Set `image_url` to the first owner photo if available

### 2. New Module — `og:image` Scraper
**File**: `src/website_image_scraper.py` (new)

- Function `fetch_og_image(website_url: str) -> Optional[str]`:
  - HTTP GET the restaurant website with a 5s timeout
  - Parse HTML for `<meta property="og:image" content="...">`
  - Validate the URL is an actual image (check Content-Type header with a HEAD request)
  - Return the image URL or None
- Keep it simple — just `requests` + regex or `html.parser` (no new dependencies)

### 3. Integrate og:image into Enrichment Pipeline
**File**: `src/google_places_enricher.py`

- In `_merge_google_data()`, after setting `contact_info.website`:
  - Call `fetch_og_image(website_url)` if a website URL exists
  - Store result in `enhanced_data['og_image_url']`
- Handle failures gracefully (timeout, no og:image found, invalid URL)

### 4. Database Schema — Add `og_image_url` Column
**File**: `src/database.py`

- Add `og_image_url TEXT` column to the `restaurants` table CREATE statement
- Add migration: `ALTER TABLE restaurants ADD COLUMN og_image_url TEXT`
- Include `og_image_url` in `create_restaurant()` and `_row_to_restaurant()` methods

### 5. Frontend Type — Add `og_image_url` Field
**File**: `web/src/types/restaurant.ts`

- Add `og_image_url?: string | null` to the `Restaurant` interface
- Add `is_owner_photo?: boolean` to `RestaurantPhoto` interface

### 6. Frontend Image Selection — Priority System
**File**: `web/src/lib/images.ts`

Update `getRestaurantImage()` to use this priority:
```
1. First owner-attributed Google Places photo (photo.is_owner_photo === true)
2. og:image URL from restaurant website (restaurant.og_image_url)
3. First Google Places photo (current behavior)
4. image_url fallback (current behavior)
```

Update `getRestaurantImages()` to include og:image in the gallery if available.

### 7. Photo Proxy — Handle Direct URLs
**File**: `web/src/app/api/photos/[reference]/route.ts`

- og:image URLs are direct HTTP URLs — they don't need the Google proxy
- In `getRestaurantImage()`, return og:image URLs directly (they already start with `http`)
- The existing logic in `images.ts` line 23 already handles this: URLs starting with `http` are returned directly

### 8. Tests
**Files**:
- `tests/test_website_image_scraper.py` (new) — unit tests for og:image fetching with mocked HTTP
- `tests/test_google_places_enricher.py` (update existing) — test owner photo prioritization
- `web/src/lib/__tests__/images.test.ts` (update if exists) — test new priority logic

## Files to Modify
| File | Change |
|------|--------|
| `src/google_places_enricher.py` | Add authorAttributions to field mask, sort photos by owner priority |
| `src/website_image_scraper.py` | **New** — og:image scraper |
| `src/database.py` | Add `og_image_url` column + migration |
| `web/src/types/restaurant.ts` | Add `og_image_url`, `is_owner_photo` fields |
| `web/src/lib/images.ts` | Priority-based image selection |
| `tests/test_website_image_scraper.py` | **New** — scraper tests |
| `tests/test_google_places_enricher.py` | Owner photo priority tests |

## Verification
1. Run `python -m pytest tests/test_website_image_scraper.py -v` — og:image scraper tests
2. Run `python -m pytest tests/test_google_places_enricher.py -v` — enricher tests
3. Run `cd web && npm run test` — frontend tests
4. Manual: enrich a restaurant and verify owner photos are prioritized and og:image is fetched

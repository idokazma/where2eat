# Sprint 4: Critical Bug Fixes & Data Pipeline Repair
**Bug Report Remediation Phase 1 — "Get the App Working"**

## Overview
Address the 4 critical and 5 major bugs that make the production app completely non-functional. After this sprint, the app should display real restaurant data with working photos, correct names, and functional YouTube links.

## Goals
- [ ] Fix production API to serve restaurant data (BUG-01)
- [ ] Fix photo proxy URL mismatch so images load (BUG-02)
- [ ] Configure photo API key on Vercel (BUG-03)
- [ ] Rotate exposed Google API key and remove from data files (BUG-04)
- [ ] Eliminate hallucinated restaurant entries from data (BUG-05)
- [ ] Fix incorrect Google Places matches (BUG-06)
- [ ] Populate missing timestamps, quotes, and IDs (BUG-07, BUG-08, BUG-09)

## Estimated Duration
5–7 working days

---

## Technical Tasks

### 1. Fix Production Data Serving (BUG-01) — Priority P0

**Problem:** `web/src/app/api/restaurants/route.ts` reads from `data/restaurants/` (empty), while actual data is in `data/restaurants_backup/`.

**Tasks:**
- [ ] Decide on canonical data directory (recommend: keep `data/restaurants/`)
- [ ] Update `web/src/app/api/restaurants/route.ts` path resolution to be robust
  - Currently: `path.join(process.cwd(), '..', 'data', 'restaurants')`
  - Verify `process.cwd()` on Vercel serverless (it may not be `web/`)
  - Add fallback path resolution with logging:
    ```typescript
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'restaurants'),
      path.join(process.cwd(), '..', 'data', 'restaurants'),
    ];
    ```
- [ ] After cleaning data in Task 5, copy validated restaurants from `data/restaurants_backup/` to `data/restaurants/`
- [ ] Ensure `data/restaurants/*.json` files are committed to git (not gitignored)
- [ ] Add a health check endpoint `/api/health` that reports restaurant count

**Files to modify:**
- `web/src/app/api/restaurants/route.ts`
- `data/restaurants/` (populate with clean JSON files)
- `.gitignore` (verify `data/restaurants/` is not ignored)

**Tests:**
- [ ] Unit test: API returns `{ restaurants: [...], count: N }` where N > 0
- [ ] Integration test: `curl /api/restaurants` returns valid JSON with restaurants
- [ ] Test: Each restaurant in response has required fields (`name_hebrew`, `google_places.place_id`)

---

### 2. Fix Photo Proxy URL Path (BUG-02) — Priority P0

**Problem:** `getPhotoProxyUrl()` in `web/src/lib/images.ts` generates `/api/places/photo/{ref}` but the actual route is `/api/photos/{ref}`.

**Fix option A (recommended — fix the URL generator):**
- [ ] Update `web/src/lib/images.ts` line 60:
  ```typescript
  // BEFORE (broken):
  return `${base}/api/places/photo/${encodeURIComponent(photoReference)}?maxwidth=${maxWidth}`;

  // AFTER (correct):
  return `${base}/api/photos/${encodeURIComponent(photoReference)}?maxwidth=${maxWidth}`;
  ```

**Fix option B (alternative — add a redirect route):**
- [ ] Create `web/src/app/api/places/photo/[reference]/route.ts` that redirects to `/api/photos/[reference]`

**Tests:**
- [ ] Unit test: `getPhotoProxyUrl('ABC123')` returns `/api/photos/ABC123?maxwidth=800`
- [ ] Integration test: Photo proxy returns image data (HTTP 200, content-type: image/*)
- [ ] Visual test: Restaurant cards display actual photos instead of gradient fallbacks

**Files to modify:**
- `web/src/lib/images.ts`
- `web/src/lib/__tests__/images.test.ts` (add/update tests)

---

### 3. Configure Photo API Key on Vercel (BUG-03) — Priority P0

**Problem:** The photo proxy route at `web/src/app/api/photos/[reference]/route.ts` returns `{"error":"API key not configured"}` because `GOOGLE_PLACES_API_KEY` is not set in Vercel.

**Tasks:**
- [ ] Generate a new Google Places API key (since the old one was exposed — see Task 4)
- [ ] Set environment variable in Vercel dashboard:
  - Variable name: `GOOGLE_PLACES_API_KEY`
  - Scope: Production + Preview
- [ ] Also set `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` if needed for map features
- [ ] Redeploy after setting env vars
- [ ] Verify photos load on production after deploy

**Verification:**
- [ ] `curl https://where2eat-delta.vercel.app/api/photos/{reference}?maxwidth=400` returns HTTP 200 with image content-type
- [ ] Restaurant cards on live site show actual images

---

### 4. Rotate Exposed API Key & Remove from Data (BUG-04) — Priority P0

**Problem:** Google Places API key `AIzaSyCo7o6jQghstjLaPIdPIJUB7pL8j_e8lcQ` is hardcoded in every `photo_url` field across all 36 restaurant JSON files, committed to git.

**Tasks:**
- [ ] **Immediately** revoke/rotate the exposed key in Google Cloud Console
- [ ] Generate a new API key with proper restrictions:
  - Restrict to Google Places API and Maps JavaScript API only
  - Add HTTP referrer restrictions (your domains)
  - Set daily quota limits
- [ ] Write a cleanup script to remove `photo_url` fields from all restaurant JSON files (the proxy uses `photo_reference` instead):
  ```python
  # scripts/clean_api_keys.py
  import json, glob
  for f in glob.glob('data/restaurants_backup/*.json'):
      with open(f) as fh:
          data = json.load(fh)
      for photo in data.get('photos', []):
          if 'photo_url' in photo:
              del photo['photo_url']  # Proxy uses photo_reference
      with open(f, 'w') as fh:
          json.dump(data, fh, indent=2, ensure_ascii=False)
  ```
- [ ] Run the cleanup script on both `data/restaurants/` and `data/restaurants_backup/`
- [ ] Verify no API keys remain in any committed file: `grep -r "AIzaSy" data/`
- [ ] Add to `.gitignore` or pre-commit hook: pattern to block API key commits
- [ ] Update `web/src/app/api/photos/[reference]/route.ts` to verify it only uses server-side env var (already correct)

**Files to modify:**
- All `data/restaurants_backup/*.json` files
- All `data/restaurants/*.json` files (after population)
- `scripts/clean_api_keys.py` (new)
- `.gitignore` or `.pre-commit-config.yaml`

---

### 5. Eliminate Hallucinated Entries & Fix Google Places Matches (BUG-05, BUG-06) — Priority P1

**Problem:** ~22 of 36 "restaurant" entries are transcript sentence fragments, not real restaurants. Additionally, Google Places matched wrong businesses for many entries.

**This is the most labor-intensive task in the sprint.**

#### 5a. Improve AI Extraction Prompt
- [ ] Update `src/claude_restaurant_analyzer.py` line 259-301 extraction prompt to add stronger anti-hallucination guards:
  ```
  CRITICAL ANTI-HALLUCINATION RULES:
  1. A restaurant name MUST be a proper noun (business name), NOT a sentence fragment
  2. If a "name" contains more than 3 Hebrew words, it is likely a sentence fragment — SKIP IT
  3. If a "name" is a common Hebrew word (כל, שוק, דיוק, חיפה, תור), it is NOT a restaurant — SKIP IT
  4. Only extract names where the speaker clearly references a specific establishment
  5. Names like "השנה שלי שהיא מסעדה" are sentence fragments, NOT restaurant names
  6. If confidence is "low", DO NOT include the entry
  ```
- [ ] Add a post-processing validation step in the analyzer:
  ```python
  def _validate_restaurant_name(self, name: str) -> bool:
      """Reject names that are likely transcript fragments."""
      # Reject if > 4 words
      if len(name.split()) > 4:
          return False
      # Reject common Hebrew words that aren't restaurant names
      BLACKLIST = {'כל', 'כלל', 'שוק', 'דיוק', 'חיפה', 'תור', 'רים'}
      if name.strip() in BLACKLIST:
          return False
      # Reject if it looks like a sentence (contains verbs/conjunctions)
      SENTENCE_MARKERS = {'היא', 'הוא', 'שלי', 'שהיא', 'ולא', 'וזה', 'גם', 'בדיוק', 'יותר'}
      words = set(name.split())
      if len(words & SENTENCE_MARKERS) >= 2:
          return False
      return True
  ```
- [ ] Add a `confidence` threshold filter: only include `high` and `medium` confidence entries

#### 5b. Manually Curate the Existing Data
- [ ] Review all 36 entries and categorize as REAL or HALLUCINATED:

**REAL restaurants to keep (14):**
| # | Hebrew Name | English | City | Action |
|---|---|---|---|---|
| 1 | אלקבר | Al-Kaber | עין זיוון | Fix Google match |
| 2 | צ'קולי | Chakoli | תל אביב | Keep (Google: Chacoli is correct spelling) |
| 3 | גורמי סבזי | Gourmet Sabzi | תל אביב | Keep |
| 4 | הלנסן | Hallansan | תל אביב | Fix Google match (currently: HaSalon) |
| 5 | הסתקיה | Hastakia | ירושלים | Fix Google match (currently: Tsemach) |
| 6 | מרי פוסה | Mariposa | קיסריה | Keep |
| 7 | מיז'נה | Mijana | ערערה | Keep |
| 8 | מושיק | Moshik | תל אביב | Keep |
| 9 | פרינו | Prino | אשדוד | Fix Google match (currently: פרי מור) |
| 10 | סטודיו גורשה | Studio Gursha | תל אביב | Keep |
| 11 | צפרירים | Tsafririm | חיפה | Keep |
| 12 | השוארמות | HaShvarmot | TBD | Verify — could be a real chain |
| 13 | מקומון | Makomonon | TBD | Verify — could be a real place |
| 14 | שוק | Shuk | TBD | Verify — could be "שוק 34" (HaShuk 34) |

**HALLUCINATED entries to DELETE (22):**
All entries where `name_hebrew` is a sentence fragment (see BUG_REPORT.md BUG-05 table).

- [ ] Delete the 22 hallucinated JSON files from `data/restaurants_backup/`
- [ ] For the 14 real restaurants, re-run Google Places enrichment with corrected names
- [ ] Manually verify each Google Places match is correct (compare name, address, coordinates)

#### 5c. Re-run Google Places Enrichment for Mismatched Entries
- [ ] For restaurants with wrong Google matches, update `src/restaurant_location_collector.py` search queries to be more specific:
  - Include cuisine type in search: `"אלקבר" food truck עין זיוון`
  - Include "מסעדה" or "restaurant" qualifier
- [ ] Re-run enrichment on the 5-6 mismatched restaurants
- [ ] Manually verify the `google_places.google_name` matches the restaurant name

**Files to modify:**
- `src/claude_restaurant_analyzer.py` (prompt + validation)
- `data/restaurants_backup/*.json` (delete/update)
- `data/restaurants/*.json` (populate with clean data)
- `src/restaurant_location_collector.py` (search query improvements)

**Tests:**
- [ ] `test_validate_restaurant_name_rejects_fragments` — assert "השנה שלי" is rejected
- [ ] `test_validate_restaurant_name_accepts_real` — assert "צ'קולי" is accepted
- [ ] `test_extraction_filters_low_confidence` — assert low-confidence entries are excluded
- [ ] Manual verification: all 14 kept entries have correct Google Places matches

---

### 6. Add Missing Timestamps, Quotes, and IDs (BUG-07, BUG-08, BUG-09) — Priority P1

**Problem:** All restaurants are missing `mention_timestamp_seconds`, `engaging_quote`, and `id` fields.

#### 6a. Add Timestamp Extraction
- [ ] Update the AI extraction prompt to emphasize timestamp extraction:
  ```
  TIMESTAMP EXTRACTION:
  - Use the transcript segment timestamps to determine when each restaurant is first mentioned
  - Set mention_timestamp_seconds to the approximate second in the video
  - If transcript provides timing markers (e.g., "[5:32]"), use those
  - If no timing data available, set to null (not 0)
  ```
- [ ] For the current dataset (video `6jvskRWvQkg`), manually watch the video and note timestamps for the 14 real restaurants, or re-run the AI analyzer with timestamp-aware transcript data
- [ ] If using `youtube-transcript-api`, ensure segment-level timestamps are passed to the analyzer

#### 6b. Add Engaging Quotes
- [ ] The extraction prompt already asks for `engaging_quote` but the data has it as null
- [ ] Re-run analysis specifically asking for direct quotes from the hosts about each restaurant
- [ ] For the current 14 restaurants, manually extract quotes from the transcript or re-analyze

#### 6c. Add Unique IDs
- [ ] Generate stable unique IDs for each restaurant entry. Use a combination of video_id + name:
  ```python
  import hashlib
  def generate_restaurant_id(video_id: str, name_hebrew: str) -> str:
      raw = f"{video_id}_{name_hebrew}"
      return hashlib.md5(raw.encode()).hexdigest()[:12]
  ```
- [ ] Add `id` field to each restaurant JSON file
- [ ] Update the pipeline to auto-generate IDs for new restaurants

**Files to modify:**
- `src/claude_restaurant_analyzer.py` (prompt updates)
- `data/restaurants/*.json` (add id, timestamp, quote fields)
- `src/restaurant_pipeline.py` (add ID generation step)

**Tests:**
- [ ] `test_restaurant_has_id` — every restaurant in output has a non-null `id`
- [ ] `test_restaurant_ids_unique` — no duplicate IDs
- [ ] `test_timestamp_extraction` — at least some restaurants have `mention_timestamp_seconds > 0`
- [ ] `test_engaging_quote_present` — at least some restaurants have non-empty `engaging_quote`

---

## File Structure Changes
```
data/
├── restaurants/                          [POPULATE with clean data]
│   ├── 6jvskRWvQkg_chakoli.json         [CLEANED]
│   ├── 6jvskRWvQkg_gourmet_sabzi.json   [CLEANED]
│   ├── ... (14 validated files)
│   └── .gitkeep                          [KEEP]
├── restaurants_backup/                    [KEEP as archive]
scripts/
├── clean_api_keys.py                     [NEW]
src/
├── claude_restaurant_analyzer.py          [UPDATE prompt + validation]
├── restaurant_location_collector.py       [UPDATE search queries]
├── restaurant_pipeline.py                 [UPDATE add ID generation]
web/src/
├── lib/
│   ├── images.ts                          [FIX proxy URL path]
│   └── __tests__/images.test.ts           [ADD/UPDATE]
├── app/
│   └── api/
│       └── restaurants/route.ts           [FIX path resolution]
tests/
├── test_restaurant_extraction.py          [ADD validation tests]
```

## Testing Checklist
- [ ] Production API returns > 0 restaurants with valid data
- [ ] Every restaurant has `name_hebrew`, `id`, `google_places.place_id`
- [ ] No restaurant name is a sentence fragment (> 4 words)
- [ ] Restaurant photos load on the live site
- [ ] No API keys are present in any data files (`grep -r "AIzaSy" data/`)
- [ ] Google Places names approximately match restaurant names
- [ ] YouTube video link in restaurant data resolves to real video
- [ ] At least 10 restaurants have `mention_timestamp_seconds > 0`
- [ ] At least 10 restaurants have non-empty `engaging_quote`

## Success Metrics
- Production app displays 10+ restaurant cards with real names
- 80%+ of restaurants display actual photos (not gradient fallback)
- 0 exposed API keys in the codebase
- 0 hallucinated (sentence fragment) restaurant names
- 100% of Google Places matches verified correct

## Next Sprint Preview
Sprint 5 will address data type mismatches between backend and frontend, ensuring price ranges, status values, opinions, and menu items align with the TypeScript type system.

## Notes
- Rotate the API key IMMEDIATELY (BUG-04) — this is a security incident
- The hallucination cleanup (Task 5) is manual work that cannot be fully automated
- Consider re-running the full pipeline on video `6jvskRWvQkg` after prompt improvements
- Back up all data before making changes
- Test with `npm run build` in `web/` to catch TypeScript errors

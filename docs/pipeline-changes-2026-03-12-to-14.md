# Analysis Pipeline Changes — March 12–14, 2026

Comparison of the processing pipeline from 2 days ago (`ae68f13`) to current (`HEAD`). Covers 17 commits across 11 Python source files.

---

## 1. Two-Stage LLM Pipeline

**Before:** Single LLM call — one prompt extracts restaurants, quotes, opinions, and everything in one shot.

**Now:** Two-stage pipeline in `unified_restaurant_analyzer.py`:

- **Stage 1:** Identify restaurants + extract details (dishes, location, opinion). Explicitly told NOT to include `engaging_quote`.
- **Stage 2:** Separate LLM call dedicated to extracting **verbatim quotes** from the transcript for each restaurant found in Stage 1.

Quotes are matched back to restaurants via normalized Hebrew name matching (with partial-match fallback).

**Files:** `unified_restaurant_analyzer.py`

---

## 2. Timestamped Transcripts

**Before:** Plain transcript text sent to the LLM. Timestamps were estimated by the LLM based on position in the text ("30% through ≈ 1080 seconds").

**Now:** Transcript segments with `start` times are formatted as `[MM:SS] text [MM:SS] text...` before being sent to the LLM. Both analyzers gained new methods:

- `unified_restaurant_analyzer.py` → `_format_timestamped_transcript()`
- `claude_restaurant_analyzer.py` → `_build_timestamped_transcript()`

`backend_service.py` now passes `segments` through to the analyzer.

**Files:** `unified_restaurant_analyzer.py`, `claude_restaurant_analyzer.py`, `backend_service.py`

---

## 3. Timestamp Conversion (LLM → Seconds)

**Before:** LLM returned `mention_timestamp_seconds` as a numeric guess.

**Now:** LLM returns `mention_timestamp` as a `"MM:SS"` string referencing the `[MM:SS]` markers in the transcript. Python converts via `_mmss_to_seconds()`. The prompt instructs the LLM to find the marker where the **discussion begins** (often 30–60 seconds before the restaurant name is said).

**Files:** `unified_restaurant_analyzer.py`, `claude_restaurant_analyzer.py`

---

## 4. System Prompt — "Reviewed" vs "Mentioned"

**Before:** Prompt said _"Extract ALL restaurants mentioned by name"_ with confidence levels (high/medium/low).

**Now:** Enforces a critical distinction:

| | Reviewed (extract) | Mentioned (skip) |
|---|---|---|
| Definition | Hosts dedicate a segment, describe dishes, share opinions (30+ seconds) | Name-dropped, used as comparison, listed in passing |
| Example | "הלכנו למסעדת צ'קולי, הסטייק נמס בפה..." | "זה כמו ששמעתם על מסעדת X" |

Key prompt rules added:
- **Golden rule:** "If you cannot write at least 2–3 sentences about what the hosts said about the food, it was NOT reviewed."
- Each restaurant **must** have at least one specific dish AND a host opinion.
- Confidence levels removed; replaced by "quality over quantity — 5 well-reviewed > 15 noisy."
- `menu_items` must contain at least one dish, otherwise the restaurant was not reviewed.

**Files:** `unified_restaurant_analyzer.py`

---

## 5. Dedicated Quote Extraction Prompt (Stage 2)

**Before:** Quotes extracted in the same prompt as restaurant identification. System prompt said "capture the hosts' actual words or a close paraphrase."

**Now:** Dedicated Stage 2 system prompt with strict rules:

- **COPY-PASTE ONLY** — every word must appear word-for-word in the transcript
- First person only (`אכלתי`, `טעמתי`) — never third person (`המנחה אמר`)
- Verification step: "mentally check — can you point to the exact location?"
- Fallback: `"לא נמצא ציטוט ישיר"`

**Files:** `unified_restaurant_analyzer.py`

---

## 6. Google Places Enrichment — More Search Strategies

**Before:** 4 search strategies:
1. English name + city
2. Hebrew name + city
3. English name + "restaurant" + city
4. Just the name

**Now:** 9 search strategies:
1. Hebrew name + city *(most reliable for Israeli restaurants)*
2. Hebrew name + "מסעדת" + city
3. Hebrew name + cuisine + city
4. English name + city
5. English name + "restaurant" + city
6. Hebrew name + neighborhood
7. Cuisine + dish hint + city *(for garbled names)*
8. Just Hebrew name
9. Just English name

Also added:
- `locationBias` rectangle for Israel (lat 29–33.5, lng 34–35.9) in new Places API
- `region=il` + Israel center coordinates in legacy API

**Files:** `google_places_enricher.py`

---

## 7. Auto-Correct Garbled Restaurant Names

**Before:** Used whatever name the transcript ASR gave.

**Now:** When Google Places returns a Hebrew name with decent match confidence, the system **auto-corrects** the garbled transcript name (e.g., `"הדבר"` → `"דנבר"`). Uses `_strip_google_suffix()` to clean Google's business-type suffixes like `" - מסעדה"`, `" - ביסטרו"`.

**Files:** `google_places_enricher.py`

---

## 8. Photo URL Resolution

**Before:** Stored raw `photo_reference` strings in `image_url` (not directly displayable in `<img>` tags).

**Now:** New `_get_photo_url()` method resolves Google Places photo resource names (`places/PLACE_ID/photos/REF`) to actual image URLs via the media endpoint with `skipHttpRedirect=true`. `image_url` now stores a displayable URL.

**Files:** `google_places_enricher.py`, `backend_service.py`

---

## 9. Location Coordinate Validation

**Before:** Accepted any coordinates from Google Places.

**Now:** Cross-checks coordinates against expected geography. If the restaurant claims to be in an Israeli city but Google returns coordinates **outside Israel** (lat 29–33.5, lng 34–35.9), the coordinates are rejected and marked as `potential_wrong_match`. Checks against a list of 35+ known Israeli cities.

**Files:** `google_places_enricher.py`

---

## 10. Data Flattening for SQLite

**Before:** `city`, `neighborhood`, `address` stayed nested inside the `location` dict, causing them to be lost during SQLite storage.

**Now:** `backend_service.py` explicitly flattens:
- `location.city` → `city`
- `location.neighborhood` → `neighborhood`
- `location.full_address` → `address`
- `location.region` → `region`

**Files:** `backend_service.py`

---

## 11. Deduplication — Normalized Hebrew Names

**Before:** Simple lowercase string comparison of Hebrew names.

**Now:** `_normalize_hebrew_name()` performs:
- Strip common prefixes (`מסעדת`, `ביסטרו`, `בית קפה`, `בר`, `קפה`, `ה`)
- Normalize geresh variants (`ז'` → `ג'`, `צ'` → `צ`)
- Remove punctuation
- **Partial matching** — if one normalized name contains the other (and both ≥3 chars), they're treated as the same restaurant

**Files:** `unified_restaurant_analyzer.py`

---

## 12. Hallucination Detector — Truncated Name Detection

**Before:** Checked for sentence fragments, single characters, common Hebrew words.

**Now:** Added detection for **truncated first words** — e.g., `"פו"` is likely `"יפו"` missing its leading letter. First words ≤2 characters that aren't known prefixes (`אל`, `לה`, `דה`, `סן`) score 0.85 hallucination probability.

**Files:** `hallucination_detector.py`

---

## 13. yt-dlp Transcript Fallback Removed

**Before:** If `youtube-transcript-api` failed, fell back to `yt-dlp` to fetch transcripts.

**Now:** yt-dlp fallback **removed** from transcript collection. If the API fails, it returns `None`. This simplifies the transcript pipeline and removes a slow, unreliable fallback.

**Files:** `youtube_transcript_collector.py`

---

## 14. Videos Without Dates — Handling Changed

**Before:** Videos without `published_at` were **excluded** from the queue (unknown age).

**Now:**
- Videos without `published_at` are **included** (assumed recent — common with flat playlist extraction via yt-dlp)
- New `_resolve_video_date()` method fetches upload date for dateless videos using yt-dlp metadata
- New `update_published_at()` method on `VideoQueueManager` to backfill resolved dates
- `_sort_videos_by_date()` puts dateless videos at the **front** (assumed newest)
- Queue queries changed from `published_at IS NOT NULL AND published_at >= ?` to `(published_at IS NULL OR published_at = '' OR published_at >= ?)`

**Files:** `pipeline_scheduler.py`, `video_queue_manager.py`

---

## 15. New Database Fields

Added to `restaurants` table:

| Column | Type | Purpose |
|--------|------|---------|
| `is_closing` | INTEGER (0/1) | Permanent closure flag — set only when podcast explicitly says restaurant is shutting down |
| `engaging_quote` | TEXT | Verbatim quote from Stage 2 quote extraction |

`published_at` now propagated from episodes → restaurants during DB storage.

`get_restaurant()` now joins with `episodes` table to include `episode_info` (video_id, video_url, channel_name, etc.) in the response.

**Files:** `database.py`, `backend_service.py`

---

## 16. Pipeline Scheduler Observability

**Before:** Silent background operation — failures only visible in log files.

**Now:**
- `print()` statements with `[SCHEDULER]` prefix at each major step for real-time stdout visibility
- APScheduler error listener via `EVENT_JOB_ERROR | EVENT_JOB_EXECUTED` that surfaces job failures to both stdout and logger

**Files:** `pipeline_scheduler.py`

---

## Summary of Files Changed

| File | Lines Changed | Key Changes |
|------|--------------|-------------|
| `unified_restaurant_analyzer.py` | +440 | Two-stage pipeline, timestamped transcripts, new prompts, dedup |
| `google_places_enricher.py` | +200 | 9 search strategies, name correction, photo URLs, location validation |
| `claude_restaurant_analyzer.py` | +77 | Timestamped transcripts, timestamp instructions in prompts |
| `database.py` | +61 | `is_closing`, `engaging_quote` columns, episode join in get |
| `pipeline_scheduler.py` | +60 | Date resolution, dateless video handling, observability |
| `backend_service.py` | +28 | Segments passthrough, data flattening, photo URL, published_at |
| `youtube_transcript_collector.py` | -33 | Removed yt-dlp fallback |
| `video_queue_manager.py` | +20 | `update_published_at()`, dateless video inclusion |
| `hallucination_detector.py` | +10 | Truncated name detection |
| `openai_restaurant_analyzer.py` | +4 | Minor adjustments |
| `config.py` | +2 | Config tweak |

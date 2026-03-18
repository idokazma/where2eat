# Where2Eat Web App - Full Bug Report

**Date:** 2026-02-14
**Tested URL:** https://where2eat-delta.vercel.app/
**Source video:** "מסכמים את 2025 | מדברים מהבטן, פרק 139" (YouTube: 6jvskRWvQkg)
**Total restaurants in backup data:** 36
**Total restaurants served by production API:** 0

---

## CRITICAL BUGS

### BUG-01: Production API returns zero restaurants
- **Severity:** CRITICAL (app is completely empty)
- **File:** `web/src/app/api/restaurants/route.ts:5`
- **Description:** The API route reads from `data/restaurants/` which is an empty directory (only `.gitkeep`). All 36 restaurant JSON files are in `data/restaurants_backup/` instead. The production Vercel deployment serves no data.
- **Impact:** The entire app shows the empty state "לא נמצאו מסעדות" (No restaurants found) with no content visible to users.
- **Fix:** Either copy the backup data to `data/restaurants/`, or update the route to read from the correct directory.

### BUG-02: Photo proxy URL path mismatch (all photos 404)
- **Severity:** CRITICAL
- **File:** `web/src/lib/images.ts:60` vs `web/src/app/api/photos/[reference]/route.ts`
- **Description:** The `getPhotoProxyUrl()` function generates URLs at `/api/places/photo/{reference}`, but the actual API route is at `/api/photos/{reference}`. Every restaurant photo request returns a **404 error**.
- **Generated URL:** `/api/places/photo/{reference}?maxwidth=800`
- **Actual route:** `/api/photos/{reference}?maxwidth=800`
- **Impact:** Zero restaurant photos load. All cards and detail pages show gradient fallbacks instead of actual restaurant images.

### BUG-03: Photo proxy missing API key on Vercel
- **Severity:** CRITICAL
- **File:** `web/src/app/api/photos/[reference]/route.ts:3-6`
- **Description:** Even if the URL path were correct, the photo proxy returns `{"error":"API key not configured"}` (HTTP 500). The `GOOGLE_PLACES_API_KEY` environment variable is not set in the Vercel deployment.
- **Impact:** Photos cannot be served even with a correct proxy URL.

### BUG-04: Google API key exposed in restaurant data files
- **Severity:** CRITICAL (Security)
- **File:** All 36 files in `data/restaurants_backup/*.json`
- **Description:** Every `photo_url` field contains the raw Google Places API key: `key=AIzaSyCo7o6jQghstjLaPIdPIJUB7pL8j_e8lcQ`. This key is committed to the git repository.
- **Impact:** The API key can be extracted and abused by anyone with access to the repo. Google Places API calls are billed per use.

---

## MAJOR BUGS - Data Quality / Hallucinations

### BUG-05: ~22 of 36 restaurants are hallucinated (not real restaurant names)
- **Severity:** MAJOR
- **Description:** The AI analysis of the YouTube video produced numerous entries that are **sentence fragments from the transcript**, not actual restaurant names. Only ~14 of 36 entries are real restaurant names.
- **Hallucinated entries (not restaurants):**

| Hebrew Name | English (transliterated) | What it actually is |
|---|---|---|
| עצם הייתה לך | "Atzם Hyyth Lך" | Hebrew sentence fragment: "basically it was for you" |
| דיוק | "Dyvk" | Hebrew word: "precision/accuracy" |
| החצי שנה הפכה למסעדת | "Hhtzy Shnh Hpkh Lmsadt" | Fragment: "half the year became a restaurant" |
| השנה שלי היא גם לא ב | "Hshnh Shly Hya Gם La B" | Fragment: "my year is also not in" |
| השנה שלי שהיא מסעדה | "Hshnh Shly Shhya Msadh" | Fragment: "my year which is a restaurant" |
| השנה ולא בדיוק שף הש | "Hshnh Vla Bdyvk Shף Hsh" | Fragment: "the year and not exactly the chef" |
| השוארמות | "Hshvarmvt" | Fragment: "the shawarmas" (generic noun) |
| חיפה | "Hyph" | City name "Haifa" (not a restaurant) |
| כל | "Kl" | Hebrew word: "all/every" |
| כלל | "Kll" | Hebrew word: "general/altogether" |
| קיסריה א שזו | "Kysryh A Shzv" | Fragment: "Caesarea that this" |
| מקומון | "Mkvmvן" | Fragment: "local" (slang) |
| מרי פוסה בקיסריה א ש | "Mry Pvsh Bkysryh A Sh" | Duplicate fragment of Mariposa entry |
| ר הזה ולפתוח | "R Hzh Vlptvh" | Fragment: "this and to open" |
| ר מזכיר משהו כל | "R Mzkyr Mshhv Kl" | Fragment: "reminds something all" |
| רים וזה | "Ryם Vzh" | Fragment: "and this" |
| שנה יותר קונבנציונלי | "Shnh Yvtr Kvnbntzyvnly" | Fragment: "a more conventional year" |
| שוק | "Shvk" | Hebrew word: "market" |
| ספרירים בחיפה ביסטרו | "Spryryם Bhyph Bystrv" | Fragment with city name embedded |
| טפס פינצ'ו ספרדית קצ | "Tps Pynchv Sprdyt Ktz" | Fragment: "tapas pintxo Spanish short" |
| תור | "Tvr" | Hebrew word: "line/queue/turn" |
| וד לכל | "Vd Lkl" | Fragment: "and for all" |
| וד נוכל לפתוח | "Vd Nvkl Lptvh" | Fragment: "and we can open" |
| יע על | "Ya Al" | Fragment: unclear |
| יאן ארוש | "Yaן Arvsh" | Fragment: unclear |

- **Impact:** Users would see nonsensical "restaurant" names. This makes the entire app appear broken/unreliable.

### BUG-06: Massive Google Places name mismatches
- **Severity:** MAJOR
- **Description:** Even for the legitimate restaurant entries, Google Places enrichment matched to the **wrong businesses** in many cases:

| Restaurant Name | Google Places Matched To | Correct? |
|---|---|---|
| אלקבר (Al-Kaber) | אלקע בר - ELKA BAR | WRONG |
| הלנסן (Hallansan) | HaSalon by Chef Eyal Shani | WRONG |
| הסתקיה (Hastakia) | Tsemach | WRONG |
| פרינו (Prino) | פרי מור בעיר (Pri Mor Ba'Ir) | WRONG |
| חיפה (Hyph) | Honey Restaurant | WRONG |
| תור (Tvr) | Triger טריגר | WRONG |
| Multiple hallucinated names | HIBA Restaurant (5x), HaShuk 34 (5x) | WRONG |

- **Impact:** Users clicking "Navigate" would be sent to the wrong restaurant. Photos shown are from wrong businesses. Ratings and reviews are for different restaurants.

### BUG-07: All 36 restaurants missing `mention_timestamp_seconds`
- **Severity:** MAJOR
- **File:** All files in `data/restaurants_backup/`
- **Description:** Every restaurant has `mention_timestamp_seconds: null`. The YouTube link section ("הוזכר בפודקאסט") will never show a timed link. The timestamp display "צפה מ-X:XX" will never appear.
- **Impact:** Users cannot jump to the relevant part of the video where the restaurant was mentioned.

### BUG-08: All 36 restaurants missing `engaging_quote`
- **Severity:** MAJOR
- **File:** All files in `data/restaurants_backup/`
- **Description:** No restaurant has an `engaging_quote` field. The "מה המארח אמר" (What the host said) section on detail pages relies on this field.
- **Impact:** The quote section only falls back to `host_comments` (which is also missing for ~22 hallucinated entries).

### BUG-09: All 36 restaurants missing `id` field
- **Severity:** MAJOR
- **File:** All files in `data/restaurants_backup/`
- **Description:** No restaurant has an `id` field. The detail page fallback lookup (`r.id === restaurantId`) at `web/src/app/restaurant/[id]/page.tsx:73` will never match by ID.
- **Impact:** Restaurant detail page routing depends entirely on `google_places.place_id`, which may not exist for all entries.

---

## MODERATE BUGS - Data Type Mismatches

### BUG-10: `price_range` values are Hebrew, frontend expects English
- **Severity:** MODERATE
- **File:** Data files vs `web/src/components/restaurant/RestaurantCardNew.tsx:59-70`
- **Data values:** `"בינוני"`, `"יקר"`, `"יוקרתי"`, `"בינוני-יקר"`, `"לא צוין"`
- **Expected values:** `"budget"`, `"mid-range"`, `"expensive"`
- **Impact:** Price display (`₪`, `₪₪`, `₪₪₪`) never appears. Price range filter never matches any restaurants.

### BUG-11: `status` values are Hebrew, frontend expects English enum
- **Severity:** MODERATE
- **File:** Data files vs `web/src/app/restaurant/[id]/page.tsx:38-49`
- **Data values:** `"פתוח"` (open), `"לא צוין"` (not specified)
- **Expected values:** `"open"`, `"closed"`, `"new_opening"`, `"closing_soon"`, `"reopening"`
- **Impact:** Status badges (like "חדש!" for new openings) never appear.

### BUG-12: `host_opinion` values are Hebrew, frontend checks English
- **Severity:** MODERATE
- **File:** `web/src/components/restaurant/RestaurantCardNew.tsx:220`
- **Code:** `restaurant.host_opinion === 'positive'`
- **Data values:** `"חיובית"`, `"חיובית מאוד"`, `"לא צוין"`
- **Expected:** `"positive"`, `"negative"`, `"mixed"`, `"neutral"`
- **Impact:** Host quotes never display on restaurant cards because `"חיובית" !== "positive"`.

### BUG-13: `menu_items` is string array, frontend expects object array
- **Severity:** MODERATE
- **File:** Data files vs `web/src/app/restaurant/[id]/page.tsx:419-453`
- **Data format:** `["בייגל קריספי צ'יקן"]` (array of strings)
- **Expected format:** `[{ item_name: "...", description: "...", price: "...", recommendation_level: "..." }]`
- **Impact:** Menu items section would crash or display incorrectly. Accessing `item.item_name` on a string returns `undefined`.

### BUG-14: `food_trends` are identical across all restaurants
- **Severity:** MODERATE
- **File:** All files in `data/restaurants_backup/`
- **Description:** At least 10+ restaurants share the exact same `food_trends` array: `["פרסי פופולרי", "מסעדות בקיסריה", "אמריקאי פופולרי", "תאילנדי פופולרי", "מסעדות בחיפה"]`. These appear to be video-level trends incorrectly copied to each restaurant.
- **Impact:** Food trends are meaningless per-restaurant data.

---

## MINOR BUGS - Functional Issues

### BUG-15: Trending page time period tabs are non-functional
- **Severity:** MINOR
- **File:** `web/src/app/trending/page.tsx:39`
- **Description:** The time period tabs (שבוע/חודש/3 חודשים) update state but don't actually filter the data. `trendingRestaurants` is always `restaurants.slice(0, 20)` regardless of selected period.
- **Impact:** Users expect different results when switching time periods but always see the same list.

### BUG-16: Map page is a placeholder
- **Severity:** MINOR
- **File:** `web/src/app/map/page.tsx`
- **Description:** The map page shows only "מפה בקרוב" (Map coming soon) placeholder despite having coordinate data for restaurants.
- **Impact:** Navigation item "מפה" leads to empty placeholder.

### BUG-17: Distance calculation is mocked/disabled
- **Severity:** MINOR
- **File:** `web/src/components/feed/DiscoveryFeed.tsx:72-74`
- **Code comment:** `// For now, use a mock location since restaurants don't have coords`
- **Description:** Despite restaurants having `location.coordinates` with lat/lng, the distance calculation always sets `distanceMeters = undefined`.
- **Impact:** "Near me" toggle is non-functional for sorting by distance.

### BUG-18: Restaurant detail page fetches ALL restaurants to find one
- **Severity:** MINOR (Performance)
- **File:** `web/src/app/restaurant/[id]/page.tsx:68`
- **Description:** To display a single restaurant, the detail page fetches the entire restaurant list via `endpoints.restaurants.list()` and then filters client-side. Should use `endpoints.restaurants.byId(id)` instead.
- **Impact:** Unnecessary network traffic and slower page loads.

### BUG-19: All restaurants from single video source
- **Severity:** MINOR (Data completeness)
- **Description:** All 36 restaurant entries come from a single YouTube video (`6jvskRWvQkg`). The system appears to have only processed one video.
- **Impact:** Very limited restaurant coverage. Not representative of a discovery app.

### BUG-20: YouTube "Watch" button on cards has no timestamp
- **Severity:** MINOR
- **File:** `web/src/components/restaurant/RestaurantCardNew.tsx:101-103`
- **Description:** The Watch button opens `restaurant.episode_info.video_url` without appending `mention_timestamp_seconds`. Even if timestamps were available, the card's Watch button wouldn't use them (only the detail page constructs timed URLs).
- **Impact:** Users clicking Watch from a card start from the beginning of the video instead of the relevant mention.

### BUG-21: Duplicate restaurant entries
- **Severity:** MINOR
- **Description:** "מרי פוסה" (Mariposa) appears twice: once as a real entry and once as a hallucinated sentence fragment ("מרי פוסה בקיסריה א ש"). Both are mapped to different Google Places results.

---

## SUMMARY

| Category | Count |
|---|---|
| Critical bugs | 4 |
| Major bugs (data quality/hallucinations) | 5 |
| Moderate bugs (type mismatches) | 5 |
| Minor bugs (functional) | 7 |
| **Total** | **21** |

### Top Priority Fixes
1. **BUG-01:** Populate `data/restaurants/` with actual restaurant data
2. **BUG-05:** Re-run AI analysis with better prompt to avoid transcript fragment hallucinations
3. **BUG-02:** Fix photo proxy URL path from `/api/places/photo/` to `/api/photos/`
4. **BUG-04:** Remove exposed API key from data files, rotate the key
5. **BUG-10/11/12:** Normalize data values to match frontend enum expectations (English values)
6. **BUG-13:** Fix menu_items data format to match MenuItem type interface
7. **BUG-07/08:** Add timestamp extraction and engaging quotes to the AI analysis pipeline

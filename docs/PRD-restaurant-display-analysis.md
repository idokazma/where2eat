# Restaurant Display - Current State Analysis & Recommendations

## Executive Summary

This document analyzes the current restaurant display implementation in Where2Eat, identifies gaps between available data and what's actually shown to users, and provides recommendations for improvement. This analysis accompanies the [PRD for Restaurant Display Design](./PRD-restaurant-display.md).

---

## Current Component Inventory

The app currently has **three** restaurant display components and a detail page:

| Component | File | Role | Status |
|-----------|------|------|--------|
| `RestaurantCardNew` | `web/src/components/restaurant/RestaurantCardNew.tsx` | Modern feed card | Active, primary |
| `RestaurantCard` | `web/src/components/restaurant-card.tsx` | Older expandable card | Legacy, still referenced |
| `DiscoveryFeed` | `web/src/components/feed/DiscoveryFeed.tsx` | Feed wrapper | Active |
| Detail Page | `web/src/app/restaurant/[id]/page.tsx` | Full restaurant view | Active |

**Problem:** Two competing card components exist. `RestaurantCardNew` is the modern one used in the feed, but `RestaurantCard` (the older expandable one) has features the new one lacks (menu preview, contact info, special features). Neither is complete.

---

## Data Utilization Audit

### Available Fields vs. Actual Display

The `Restaurant` type in `web/src/types/restaurant.ts` defines 20+ fields. Here's how they're actually used:

#### Fully Utilized (shown in both card and detail)
| Field | Card | Detail | Notes |
|-------|------|--------|-------|
| `name_hebrew` | Title | Hero title | Core identifier |
| `cuisine_type` | Meta badge | Badge | Used for gradients too |
| `location.city` | Meta | Location section | Also used for filtering |
| `price_range` | Stats row | Badge | Converted to shekel symbols |
| `photos` | Hero image + count | Hero + gallery | Via proxy URLs |
| `episode_info.video_url` | Watch button | Episode section | YouTube link |

#### Partially Utilized (shown in one view only)
| Field | Where Shown | Where Missing | Impact |
|-------|-------------|---------------|--------|
| `name_english` | Detail page | Card | Low - Hebrew is primary |
| `host_comments` | Card (positive only) | - | **High** - quotes drive engagement |
| `engaging_quote` | Old card, Detail | **Modern card** | **High** - best content, not in feed |
| `host_opinion` | Card (emoji only) | Detail page styling | Medium - sentiment coloring |
| `rating.google_rating` | Card (small) | Detail (larger) | OK as-is |
| `mention_timestamp_seconds` | Old card | Detail | OK - detail is the right place |
| `menu_items` | Old card (3 items) | Detail (all) | **Medium** - preview in feed would help |
| `special_features` | Old card | Detail | Low priority for card |
| `contact_info` | Old card | Detail | OK - detail is the right place |
| `business_news` | Old card | **Missing from detail** | **Medium** - detail should show this |

#### Never Utilized (defined in type but never displayed)
| Field | Why It Matters | Recommendation |
|-------|----------------|----------------|
| `status` | Users need to know if a place is closed/new | **Show badge on card + detail hero** |
| `mention_context` | Distinguishes review vs news vs recommendation | **Show as badge/tag on card** |
| `mention_timestamps[]` | Multiple moments in video where restaurant discussed | **Show in detail YouTube section** |
| `food_trends` | Trending cuisine/food types | **Could power trending page** |
| `business_news` (detail) | Important updates about the restaurant | **Add to detail page** |

---

## Key Issues Found

### 1. Engaging Quote Not in Modern Card

The `RestaurantCardNew` component (the one actually shown in the feed) does NOT display `engaging_quote`. It only shows `host_comments` and only when `host_opinion === 'positive'`.

The `engaging_quote` field is specifically designed to be the most compelling snippet from the podcast. Not showing it in the feed is a major missed opportunity for engagement.

**Current code (RestaurantCardNew.tsx ~line 220):**
```tsx
// Only shows quote if host opinion is positive
{restaurant.host_opinion === 'positive' && restaurant.host_comments && (
  <p className="...">{restaurant.host_comments}</p>
)}
```

**Recommendation:** Show `engaging_quote` first, fall back to `host_comments`, and show for all opinion types (not just positive).

### 2. Status Field Ignored

The `status` field (`open`, `closed`, `new_opening`, `closing_soon`, `reopening`) is defined in the type and stored in the database but **never shown on cards**. The detail page calculates a `statusBadge` variable but doesn't consistently render it.

Users could visit a closed restaurant without knowing. New openings miss the excitement factor.

**Recommendation:** Add colored status badges to both card and detail:
- `new_opening` - green badge
- `closing_soon` - yellow/orange badge
- `closed` - red badge with reduced card opacity
- `reopening` - blue badge

### 3. Mention Timestamps Never Used

The `mention_timestamps[]` array contains multiple timestamps with context, key points, and mention types. This rich data is completely unused. Only the single `mention_timestamp_seconds` is used on the detail page.

**Example data available:**
```json
{
  "timestamp": "05:23",
  "context": "Host discusses the hummus plate",
  "mention_type": "review",
  "key_points": ["best hummus in Tel Aviv", "fresh daily"]
}
```

**Recommendation:** Display these as clickable timestamp links in the YouTube Episode section of the detail page, allowing users to jump to specific discussion points.

### 4. Favorite ID Inconsistency

- `RestaurantCard` (old): Uses `restaurant.name_hebrew` as favorite key
- `RestaurantCardNew` (modern): Uses `restaurant.google_places?.place_id`
- Detail page: Uses `google_places?.place_id`

If a user favorites a restaurant via the old card, it won't appear as favorited in the new card or detail page.

**Recommendation:** Standardize on `google_places.place_id` with fallback to `id`.

### 5. Data Loading Inefficiency

The detail page (`app/restaurant/[id]/page.tsx`) fetches ALL restaurants, then filters client-side to find the one matching the ID. With a growing database, this becomes increasingly slow.

**Recommendation:** Use the `GET /api/restaurants/:id` endpoint directly instead of fetching the full list.

### 6. Distance Feature Incomplete

The `DiscoveryFeed` component accepts a `distanceMeters` prop and has a Haversine calculation utility, but the distance is never actually passed to cards because the geolocation coordinates aren't connected to the distance calculation in the feed.

**Recommendation:** Connect `useGeolocation` hook output to the distance calculation in `DiscoveryFeed` and display distance badges on cards.

---

## What Each View Currently Looks Like

### Modern Card (RestaurantCardNew) - Current Layout

```
+------------------------------------------+
| [Photo from Google Places]               |
|                        [Episode badge]   |
|                        [Photo count]     |
|                        [Distance badge]  |
+------------------------------------------+
| Restaurant Name (Hebrew)                 |
| City | Neighborhood | Cuisine | Price    |
| "Host quote..." (only if positive)       |
|                                          |
| [Rating] [Save] [Watch] [Navigate]      |
+------------------------------------------+
```

**What's missing:** Status badge, engaging quote (uses host_comments instead), mention context tag.

### Detail Page - Current Layout

```
+------------------------------------------+
| [Hero Image with gradient]               |
| [Back] [Share] [Save] [Photo count]      |
| Restaurant Name                          |
| English Name                             |
| [Cuisine] [Price] [Rating]              |
+------------------------------------------+
| [Navigate] [Call] [Website]              |
+------------------------------------------+
| Rating: 4.5/5 (234 reviews)             |
+------------------------------------------+
| Episode: Video Title                     |
| Watch from 05:23                         |
+------------------------------------------+
| "Host quote..."                          |
+------------------------------------------+
| Location: Address, City                  |
+------------------------------------------+
| Hours: [operating hours]                 |
+------------------------------------------+
| Menu Items:                              |
| - Item 1 (price) [recommendation]       |
| - Item 2 (price) [recommendation]       |
+------------------------------------------+
| Special Features: [tag] [tag] [tag]      |
+------------------------------------------+
| [Open in Google Maps]                    |
+------------------------------------------+
```

**What's missing:** Status badges (calculated but not shown), business news section, mention timestamps array, mention context badge, food trends, photo gallery (only hero image, no browsable gallery).

---

## Recommendations Summary

### High Priority (Impact on user engagement)

1. **Show `engaging_quote` in feed cards** - This is the most compelling content and it's hidden
2. **Add status badges** - Users need to know about closures and new openings
3. **Show `mention_timestamps[]` in detail** - Let users jump to specific podcast moments
4. **Fix favorite ID inconsistency** - Broken cross-component favorite state

### Medium Priority (Quality improvements)

5. **Add `business_news` to detail page** - Already shown in old card, missing from detail
6. **Show `mention_context` as badges** - Distinguish reviews from news from recommendations
7. **Complete distance calculation** - Feature is half-built, just needs wiring
8. **Optimize detail page data fetching** - Use single-restaurant API endpoint

### Lower Priority (Polish)

9. **Consolidate card components** - Remove old `RestaurantCard`, merge unique features into `RestaurantCardNew`
10. **Add `food_trends` display** - Could enhance trending page
11. **Add pagination/virtualization** - Performance for large restaurant lists
12. **Improve image loading** - Add WebP support, better blur-up placeholders

---

## Data Completeness Across Real Restaurants

Based on sample data files in `data/restaurants_backup/`, typical data completeness:

| Field Category | Typical Fill Rate | Notes |
|----------------|------------------|-------|
| Name (Hebrew) | ~100% | Always present |
| City/Location | ~95% | Rarely missing |
| Cuisine Type | ~90% | AI extraction is reliable |
| Host Comments | ~85% | Most episodes have quotes |
| Engaging Quote | ~60% | Not always extracted |
| Google Rating | ~70% | Requires Places API enrichment |
| Photos | ~70% | Requires Places API enrichment |
| Menu Items | ~50% | Depends on podcast content |
| Business Hours | ~65% | From Google Places |
| Phone/Website | ~55% | From Google Places |
| Special Features | ~40% | Depends on podcast discussion |
| Business News | ~20% | Rare, episode-specific |
| Mention Timestamps | ~30% | Newer analysis feature |

**Key takeaway:** The card design must handle missing data gracefully. At minimum, ~30% of restaurants will lack photos, ratings, or detailed menu items. The PRD's edge case handling and fallback system addresses this directly.

---

## Technical Debt

1. **Two card components** - `RestaurantCard` (old) and `RestaurantCardNew` should be consolidated
2. **Client-side filtering** - All restaurants loaded upfront, filtered in browser
3. **No server-side rendering for detail page** - Could use Next.js SSR for SEO
4. **Image proxy pattern** - Works but could use Next.js Image optimization
5. **Hardcoded translations** - Some Hebrew strings are inline rather than in translation files
6. **No error boundaries** - Missing data could cause component crashes

---

## Mapping PRD Sections to Current Code

| PRD Section | Current Implementation | Gap |
|-------------|----------------------|-----|
| Card hero image | `RestaurantCardNew` image section | Mostly complete, add status badge |
| Card engaging quote | Missing from modern card | **Major gap** |
| Card stats row | Rating + actions in card | Add host opinion + price consistently |
| Detail hero | Detail page hero section | Add status badge rendering |
| Detail quick actions | Action buttons exist | Sticky behavior not implemented |
| Detail host opinion | Quote section exists | Add sentiment coloring, use engaging_quote |
| Detail YouTube section | Episode badge with single timestamp | **Add timestamp links from array** |
| Detail menu items | Full menu display exists | Add recommendation level styling |
| Detail business hours | Basic hours display | Add open/closed status indicator |
| Detail photo gallery | Only hero image | **No gallery component yet** |
| Detail additional episodes | Not implemented | **New feature needed** |

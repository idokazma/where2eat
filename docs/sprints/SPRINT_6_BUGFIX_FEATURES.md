# Sprint 6: Feature Completion & Polish
**Bug Report Remediation Phase 3 — "Make Everything Work Properly"**

## Overview
Address the 7 minor bugs involving non-functional features, placeholder pages, and performance issues. Implement the trending time filter, map view, distance sorting, timed YouTube links on cards, and optimize the restaurant detail page loading pattern.

## Goals
- [ ] Implement trending time period filtering (BUG-15)
- [ ] Build interactive map page with restaurant pins (BUG-16)
- [ ] Enable real distance calculation and "Near Me" sorting (BUG-17)
- [ ] Optimize restaurant detail page to fetch single restaurant (BUG-18)
- [ ] Process additional video sources for broader coverage (BUG-19)
- [ ] Add timestamp to Watch button on restaurant cards (BUG-20)
- [ ] Remove duplicate restaurant entries (BUG-21)

## Estimated Duration
5–7 working days

## Dependencies
- Sprint 4 completed (clean data, working photos)
- Sprint 5 completed (normalized data types)
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` set in Vercel for map functionality

---

## Technical Tasks

### 1. Implement Trending Time Period Filtering (BUG-15) — Priority P1

**Problem:** Trending page tabs (שבוע/חודש/3 חודשים) change state but don't filter data. `trendingRestaurants` is always `restaurants.slice(0, 20)`.

**Tasks:**
- [ ] Add `analysis_date` awareness to filtering logic
- [ ] Update `web/src/app/trending/page.tsx`:
  ```typescript
  const getDateThreshold = (period: TimePeriod): Date => {
    const now = new Date();
    switch (period) {
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case '3months':
        return new Date(now.setMonth(now.getMonth() - 3));
    }
  };

  const trendingRestaurants = useMemo(() => {
    const threshold = getDateThreshold(timePeriod);
    const filtered = restaurants.filter((r) => {
      const analysisDate = r.episode_info?.analysis_date;
      if (!analysisDate) return false;
      return new Date(analysisDate) >= threshold;
    });
    // Sort by rating or recency
    return filtered
      .sort((a, b) => (b.rating?.google_rating ?? 0) - (a.rating?.google_rating ?? 0))
      .slice(0, 20);
  }, [restaurants, timePeriod]);
  ```
- [ ] Add empty state for when no restaurants match the time filter:
  ```typescript
  {trendingRestaurants.length === 0 && (
    <div className="text-center py-12">
      <p className="text-[var(--color-ink-muted)]">אין מסעדות טרנדיות בתקופה זו</p>
    </div>
  )}
  ```
- [ ] Consider adding a "trending score" based on: recency + rating + number of mentions

**Files to modify:**
- `web/src/app/trending/page.tsx`

**Tests:**
- [ ] Unit test: `getDateThreshold('week')` returns date 7 days ago
- [ ] Component test: changing time period re-filters the restaurant list
- [ ] Edge case: all restaurants older than 1 week shows empty state for "week" tab

---

### 2. Build Interactive Map Page (BUG-16) — Priority P1

**Problem:** Map page is a placeholder with "מפה בקרוב" text, despite restaurants having latitude/longitude coordinates.

**Tasks:**

#### 2a. Choose map library
- [ ] Install Google Maps or Leaflet (Leaflet is free, no API key needed for tiles):
  ```bash
  cd web
  npm install leaflet react-leaflet
  npm install -D @types/leaflet
  ```
  Or for Google Maps:
  ```bash
  npm install @react-google-maps/api
  ```

#### 2b. Build the MapView component
- [ ] Create `web/src/components/map/MapView.tsx`:
  ```typescript
  // Key features:
  // - Center on Israel (lat: 31.5, lng: 34.8, zoom: 8)
  // - Pin for each restaurant with coordinates
  // - Popup/tooltip on pin click showing: name, cuisine, rating
  // - Click popup to navigate to restaurant detail page
  // - Cluster nearby pins when zoomed out
  // - "Center on me" button using geolocation API
  ```
- [ ] Create `web/src/components/map/RestaurantPin.tsx`:
  ```typescript
  // Custom pin marker with:
  // - Color based on cuisine type (reuse gradient colors)
  // - Size based on rating
  // - Tooltip with restaurant name
  ```

#### 2c. Update the map page
- [ ] Replace `web/src/app/map/page.tsx` placeholder with actual MapView:
  ```typescript
  export default function MapPage() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

    useEffect(() => {
      fetch(endpoints.restaurants.list())
        .then(res => res.json())
        .then(data => setRestaurants(data.restaurants || []));
    }, []);

    // Filter restaurants that have coordinates
    const mappableRestaurants = restaurants.filter(
      r => r.location?.coordinates?.latitude && r.location?.coordinates?.longitude
    );

    return (
      <PageLayout title="מפה" showHeader showBottomNav>
        <MapView restaurants={mappableRestaurants} />
      </PageLayout>
    );
  }
  ```
- [ ] Handle Next.js SSR: Leaflet requires `dynamic(() => import(...), { ssr: false })` since it uses `window`
- [ ] Add loading state while restaurants fetch

#### 2d. Map interaction features
- [ ] Clicking a restaurant pin opens a bottom sheet with restaurant summary
- [ ] "Filter by visible area" option — only show restaurants in current map bounds
- [ ] City-level quick navigation buttons (תל אביב, ירושלים, חיפה)

**Files to create/modify:**
- `web/src/components/map/MapView.tsx` (new)
- `web/src/components/map/RestaurantPin.tsx` (new)
- `web/src/app/map/page.tsx` (replace placeholder)
- `web/package.json` (add leaflet or google maps dependency)

**Tests:**
- [ ] Map renders without crash
- [ ] Restaurants with coordinates appear as pins
- [ ] Clicking a pin shows restaurant info
- [ ] Map is centered on Israel on load
- [ ] SSR: Map component doesn't crash during server-side rendering

---

### 3. Enable Distance Calculation & "Near Me" Sorting (BUG-17) — Priority P1

**Problem:** `DiscoveryFeed.tsx:72-74` has a comment "use a mock location" and always sets `distanceMeters = undefined`, despite restaurants having coordinates.

**Tasks:**
- [ ] Update `web/src/components/feed/DiscoveryFeed.tsx` to use actual restaurant coordinates:
  ```typescript
  // BEFORE (line 72-74):
  // For now, use a mock location since restaurants don't have coords
  distanceMeters = undefined;

  // AFTER:
  if (showDistances && userCoords && restaurant.location?.coordinates) {
    const { latitude, longitude } = restaurant.location.coordinates;
    if (latitude && longitude) {
      distanceMeters = calculateDistance(
        userCoords.lat, userCoords.lng,
        latitude, longitude
      );
    }
  }
  ```
- [ ] Add distance-based sorting when "Near Me" is active:
  ```typescript
  // Sort restaurants by distance when in nearby mode
  const sortedRestaurants = useMemo(() => {
    if (!showDistances || !userCoords) return restaurants;
    return [...restaurants].sort((a, b) => {
      const distA = a.location?.coordinates
        ? calculateDistance(userCoords.lat, userCoords.lng,
            a.location.coordinates.latitude, a.location.coordinates.longitude)
        : Infinity;
      const distB = b.location?.coordinates
        ? calculateDistance(userCoords.lat, userCoords.lng,
            b.location.coordinates.latitude, b.location.coordinates.longitude)
        : Infinity;
      return distA - distB;
    });
  }, [restaurants, showDistances, userCoords]);
  ```
- [ ] Display distance on restaurant cards (e.g., "1.2 ק"מ")
- [ ] Verify `useGeolocation` hook works and requests permission properly

**Files to modify:**
- `web/src/components/feed/DiscoveryFeed.tsx`
- `web/src/components/restaurant/DistanceBadge.tsx` (verify it displays correctly)
- `web/src/hooks/useLocationFilter.ts` (verify geolocation integration)

**Tests:**
- [ ] Unit test: `calculateDistance(32.07, 34.78, 32.08, 34.79)` returns reasonable meters (~1.4km)
- [ ] Component test: With userCoords set, distance badges appear on cards
- [ ] Restaurants are sorted closest-first in nearby mode
- [ ] Without geolocation permission, graceful fallback (no crash)

---

### 4. Optimize Restaurant Detail Page Loading (BUG-18) — Priority P2

**Problem:** Detail page fetches ALL restaurants via `endpoints.restaurants.list()` then filters client-side. Should use a direct lookup.

**Tasks:**

#### 4a. Add individual restaurant API route
- [ ] Create `web/src/app/api/restaurants/[id]/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from 'next/server';
  import fs from 'fs/promises';
  import path from 'path';

  const dataDir = path.join(process.cwd(), '..', 'data', 'restaurants');

  export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;

    try {
      const files = await fs.readdir(dataDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
        const restaurant = JSON.parse(content);
        if (restaurant.google_places?.place_id === id || restaurant.id === id) {
          return NextResponse.json(restaurant);
        }
      }
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    } catch {
      return NextResponse.json({ error: 'Failed to load restaurant' }, { status: 500 });
    }
  }
  ```

#### 4b. Update detail page to use direct endpoint
- [ ] Update `web/src/app/restaurant/[id]/page.tsx`:
  ```typescript
  // BEFORE:
  const response = await fetch(endpoints.restaurants.list());
  const data = await response.json();
  const found = data.restaurants.find(r => r.google_places?.place_id === restaurantId);

  // AFTER:
  const response = await fetch(endpoints.restaurants.byId(restaurantId));
  if (response.ok) {
    const found = await response.json();
    setRestaurant(found);
  } else {
    setError('המסעדה לא נמצאה');
  }
  ```

**Files to create/modify:**
- `web/src/app/api/restaurants/[id]/route.ts` (new)
- `web/src/app/restaurant/[id]/page.tsx` (update fetch logic)

**Tests:**
- [ ] `GET /api/restaurants/{placeId}` returns the correct restaurant
- [ ] `GET /api/restaurants/nonexistent` returns 404
- [ ] Detail page loads faster (no full list download)

---

### 5. Process Additional Video Sources (BUG-19) — Priority P2

**Problem:** All 36 restaurants come from a single YouTube video. The app needs more content.

**Tasks:**
- [ ] Identify 5-10 additional Hebrew food podcast videos to process:
  - Same channel: "בית הפודיום - פרקים מלאים" (more episodes)
  - Other channels: "סוגרים חשבון", "בא לי לאכול", "ביקורת אוכל"
- [ ] Run the full pipeline on each video:
  ```bash
  python scripts/main.py 'https://www.youtube.com/watch?v=VIDEO_ID'
  ```
- [ ] Apply Sprint 4 validation to filter out hallucinations
- [ ] Apply Sprint 5 normalization to align data types
- [ ] Run Google Places enrichment on new restaurants:
  ```bash
  python src/restaurant_location_collector.py --batch data/restaurants/
  ```
- [ ] Target: at least 50 total validated restaurants from 5+ episodes

**Goal:** Diverse restaurant content across multiple cities, cuisines, and episodes.

---

### 6. Add Timed YouTube Link to Card Watch Button (BUG-20) — Priority P2

**Problem:** Card Watch button uses raw `video_url` without `mention_timestamp_seconds`. Only the detail page constructs timed URLs.

**Tasks:**
- [ ] Update `web/src/components/restaurant/RestaurantCardNew.tsx`:
  ```typescript
  const handleWatchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (restaurant.episode_info?.video_url) {
      const ts = restaurant.mention_timestamp_seconds;
      const url = ts && ts > 0
        ? `${restaurant.episode_info.video_url}${restaurant.episode_info.video_url.includes('?') ? '&' : '?'}t=${ts}`
        : restaurant.episode_info.video_url;
      window.open(url, '_blank');
    }
  };
  ```
- [ ] Extract the timed URL logic into a shared utility:
  ```typescript
  // web/src/lib/youtube.ts
  export function getTimedYouTubeUrl(videoUrl: string, timestampSeconds?: number | null): string {
    if (!timestampSeconds || timestampSeconds <= 0) return videoUrl;
    const separator = videoUrl.includes('?') ? '&' : '?';
    return `${videoUrl}${separator}t=${timestampSeconds}`;
  }
  ```
- [ ] Use `getTimedYouTubeUrl` in both `RestaurantCardNew.tsx` and `restaurant/[id]/page.tsx`
- [ ] Also update `EpisodeBadge.tsx` if it has a direct YouTube link

**Files to create/modify:**
- `web/src/lib/youtube.ts` (new utility)
- `web/src/components/restaurant/RestaurantCardNew.tsx`
- `web/src/app/restaurant/[id]/page.tsx`
- `web/src/components/restaurant/EpisodeBadge.tsx`

**Tests:**
- [ ] `getTimedYouTubeUrl('https://youtube.com/watch?v=abc', 332)` → `'...?v=abc&t=332'`
- [ ] `getTimedYouTubeUrl('https://youtube.com/watch?v=abc', null)` → `'...?v=abc'`
- [ ] `getTimedYouTubeUrl('https://youtu.be/abc', 60)` → `'...abc?t=60'`

---

### 7. Deduplicate Restaurant Entries (BUG-21) — Priority P3

**Problem:** "מרי פוסה" (Mariposa) appears twice: once as real entry and once as hallucinated fragment.

**Tasks:**
- [ ] This should already be handled by Sprint 4 Task 5 (hallucination cleanup)
- [ ] Add deduplication check to the pipeline as a safety net:
  ```python
  # src/claude_restaurant_analyzer.py - enhance _deduplicate_restaurants()
  def _deduplicate_restaurants(self, restaurants: list) -> list:
      seen = {}
      unique = []
      for r in restaurants:
          # Key on Hebrew name (normalized: strip whitespace, lowercase)
          key = r.get('name_hebrew', '').strip()
          if key in seen:
              # Keep the one with more data (more non-null fields)
              existing = seen[key]
              if self._data_completeness(r) > self._data_completeness(existing):
                  seen[key] = r
                  unique = [x for x in unique if x.get('name_hebrew', '').strip() != key]
                  unique.append(r)
          else:
              seen[key] = r
              unique.append(r)
      return unique

  def _data_completeness(self, r: dict) -> int:
      """Count non-null fields as a proxy for data quality."""
      return sum(1 for v in r.values() if v is not None and v != '' and v != [])
  ```
- [ ] Add Google Places place_id deduplication (same place_id = same restaurant)
- [ ] Run deduplication on existing data files

**Tests:**
- [ ] `test_dedup_keeps_more_complete` — when two entries have same name, keep the one with more fields
- [ ] `test_dedup_by_place_id` — same place_id is also detected as duplicate

---

## File Structure Changes
```
web/src/
├── lib/
│   ├── youtube.ts                         [NEW - timed URL utility]
│   └── __tests__/youtube.test.ts          [NEW - tests]
├── components/
│   ├── map/
│   │   ├── MapView.tsx                    [NEW - map component]
│   │   └── RestaurantPin.tsx              [NEW - custom pin]
│   ├── restaurant/
│   │   ├── RestaurantCardNew.tsx          [UPDATE - timed Watch link]
│   │   └── EpisodeBadge.tsx              [UPDATE - timed link]
│   └── feed/
│       └── DiscoveryFeed.tsx              [UPDATE - real distance calc]
├── app/
│   ├── map/page.tsx                       [REPLACE placeholder]
│   ├── trending/page.tsx                  [UPDATE time filtering]
│   ├── restaurant/[id]/page.tsx           [UPDATE direct fetch]
│   └── api/
│       └── restaurants/[id]/route.ts      [NEW - single restaurant]
src/
├── claude_restaurant_analyzer.py          [UPDATE - deduplication]
```

## Testing Checklist
- [ ] Trending page: switching time period changes displayed restaurants
- [ ] Map page: shows interactive map with restaurant pins
- [ ] Map page: clicking a pin shows restaurant summary
- [ ] Map page: pins have correct positions matching restaurant addresses
- [ ] Near Me: with location permission, restaurants are sorted by distance
- [ ] Near Me: distance badges show on cards (e.g., "1.2 ק"מ")
- [ ] Detail page: loads single restaurant (network tab shows 1 small request, not full list)
- [ ] Watch button: opens YouTube at correct timestamp
- [ ] No duplicate restaurant entries in the feed
- [ ] Mobile: all features work on mobile viewport
- [ ] RTL: map controls and tooltips respect RTL layout
- [ ] Performance: Lighthouse score > 85 on mobile

## Success Metrics
- Trending time filter produces different results for each period
- Map page shows 10+ pins with correct locations
- Distance calculation accurate within 100m (verified with Google Maps)
- Restaurant detail page load time < 500ms (down from fetching all restaurants)
- 50+ unique restaurants from 5+ video sources
- YouTube links open at correct timestamp for restaurants that have one
- 0 duplicate entries in the feed

## Notes
- Leaflet is recommended over Google Maps for the map page: it's free, open-source, and doesn't require an API key for tile rendering. Use OpenStreetMap tiles.
- For Google Maps integration later, the `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` env var is already configured
- The individual restaurant API route (`/api/restaurants/[id]`) still reads from files — a database migration would be a future optimization
- When processing additional videos (Task 5), run in batches of 2-3 to avoid rate limiting from YouTube transcript API (30s cooldown)
- Test distance sorting with coordinates in different Israeli regions (north, center, south)
- The map component MUST be loaded with `dynamic(() => import(...), { ssr: false })` to avoid Leaflet's `window` dependency during SSR

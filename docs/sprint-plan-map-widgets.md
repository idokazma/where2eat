# Sprint Plan: Map Widgets & Location Features

## Overview

Four new features for the `/map` page, built incrementally across 4 sprints.
Each sprint delivers a working, testable increment.

**Branch:** `claude/map-widgets-location-features-h0qU0`
**Current stack:** Leaflet 1.9.4, react-leaflet 5.0, Framer Motion 12.25, @use-gesture/react 10.3, react-window 2.2

---

## Sprint 1: User Location Dot & Geolocation Enhancements
**Goal:** Show a persistent, animated blue dot for the user's real-time position on the map.

### Tasks

#### 1.1 Extend `useGeolocation` hook with `watchPosition`
- **File:** `web/src/hooks/useGeolocation.ts`
- Add `watchPosition()` method that returns a cleanup function
- Uses `navigator.geolocation.watchPosition()` to continuously stream coords
- Add `accuracy` field to the state (from `position.coords.accuracy`)
- Add `isWatching` boolean state
- Add `stopWatching()` to clear the watch
- **Test:** `web/src/hooks/__tests__/useGeolocation.test.ts`
  - Test `watchPosition` calls the browser API
  - Test state updates on position change
  - Test cleanup on `stopWatching()`
  - Test error handling (permission denied, unavailable)

#### 1.2 Create `UserLocationMarker` component
- **File:** `web/src/components/map/UserLocationMarker.tsx`
- Renders a Leaflet `CircleMarker` (solid blue dot, r=8) at the user's coordinates
- Renders a `Circle` (translucent blue, based on `accuracy` meters) for accuracy radius
- CSS `@keyframes pulse` animation on the dot (scale 1 -> 1.4 -> 1, opacity cycle)
- Uses `useMap()` from react-leaflet to access the map instance
- Props: `coords: {lat, lng}`, `accuracy?: number`
- **Test:** `web/src/components/__tests__/user-location-marker.test.tsx`
  - Test renders CircleMarker at given coords
  - Test accuracy circle renders when accuracy provided
  - Test does not render when coords are null

#### 1.3 Integrate into MapView
- **File:** `web/src/components/map/MapView.tsx`
- Replace the existing `LocationButton` component:
  - On click, start `watchPosition` (instead of one-shot `getCurrentPosition`)
  - Show `UserLocationMarker` when coords are available
  - Button toggles between "track me" and "stop tracking" states
  - `flyTo` user location on first position acquisition
- Add a `userCoords` prop to MapView (passed down from MapPage)
- **Test:** Update existing MapView tests if any; add integration test

#### 1.4 Update MapPage to manage geolocation state
- **File:** `web/src/app/map/page.tsx`
- Use `useGeolocation` hook at the page level
- Pass `userCoords` and `accuracy` down to `MapView`
- Store user coords in state for later use by Sprint 2 (distance calculations)

### Definition of Done
- Blue pulsing dot visible on the map at the user's real location
- Accuracy circle shows around the dot
- Button toggles tracking on/off
- Works on Chrome Android, Chrome desktop, Safari (iOS limited to one-shot)
- Tests pass

---

## Sprint 2: Smart Zoom to 10 Closest Restaurants
**Goal:** On geolocation, auto-zoom the map to show the 10 nearest restaurants around the user.

### Tasks

#### 2.1 Create `geo-utils.ts` distance utility
- **File:** `web/src/lib/geo-utils.ts`
- Implement `haversineDistance(coord1, coord2): number` (returns km)
  - Uses the Haversine formula with Earth radius 6371 km
- Implement `sortByDistance(restaurants, userCoords): SortedRestaurant[]`
  - Takes array of restaurants with coords + user coords
  - Returns restaurants sorted by distance (ascending), with `distance` field attached
- Implement `getNClosest(restaurants, userCoords, n): SortedRestaurant[]`
  - Calls `sortByDistance`, returns first `n` items
- Implement `getBoundsForPoints(points): LatLngBounds`
  - Computes a Leaflet-compatible bounding box from an array of coordinates
- **Test:** `web/src/lib/__tests__/geo-utils.test.ts`
  - Test haversine accuracy (known distances: Tel Aviv -> Jerusalem ~54km)
  - Test sorting order is correct
  - Test getNClosest returns exactly N items (or fewer if not enough)
  - Test edge cases: empty array, single restaurant, user at same location

#### 2.2 Create `useNearestRestaurants` hook
- **File:** `web/src/hooks/useNearestRestaurants.ts`
- Input: `restaurants[]`, `userCoords | null`, `count = 10`
- Output: `{ nearest: SortedRestaurant[], bounds: LatLngBounds | null }`
- Memoized with `useMemo` to avoid recalculating on every render
- Returns all restaurants (unsorted) if `userCoords` is null
- **Test:** `web/src/hooks/__tests__/useNearestRestaurants.test.ts`
  - Test returns 10 nearest when user has coords
  - Test returns all when userCoords is null
  - Test recalculates when restaurants or coords change

#### 2.3 Integrate smart zoom into MapView
- **File:** `web/src/components/map/MapView.tsx`
- Replace the existing `fitBounds` (all restaurants) logic:
  - If `userCoords` available: `fitBounds` to the 10 nearest + user location point
  - If no `userCoords`: fall back to current behavior (show all)
  - Include the user's position in the bounds calculation so the user dot is always visible
  - Add padding: `[50, 50]` on top/sides, `[50, 200]` on bottom (reserve space for Sprint 4 bottom sheet)
- Add max zoom cap of 16 to prevent over-zooming when restaurants cluster

#### 2.4 Show distance badges on markers
- **File:** `web/src/components/map/MapView.tsx`
- When `userCoords` is available, show distance in the marker popup (e.g., "1.2 ק״מ ממך")
- Add distance to popup content below the city name
- **Test:** Verify popup shows distance when user location is known

### Definition of Done
- Opening map with location permission → zooms to show 10 nearest restaurants + user dot
- Without location → shows all restaurants (current behavior)
- Distance displayed in each popup
- Tests pass for geo-utils (haversine accuracy within 1% of known distances)

---

## Sprint 3: Hot-to-Cold Pin Colors by Video Publish Date
**Goal:** Color each restaurant marker on a gradient from hot (red) to cold (blue) based on the recency of the video that mentioned it.

### Tasks

#### 3.1 Create color interpolation utility
- **File:** `web/src/lib/color-utils.ts`
- Implement `dateToHeatColor(publishDate, minDate, maxDate): string`
  - Maps a date to a hex color on a gradient:
    - Hot (newest): `#ef4444` (red)
    - Warm: `#f97316` (orange)
    - Mild: `#eab308` (yellow)
    - Cool: `#22c55e` (green)
    - Cold (oldest): `#3b82f6` (blue)
  - Uses HSL interpolation (hue from 0 → 220) for smooth gradient
  - No external dependency (pure JS HSL math, ~20 lines)
- Implement `getDateRange(restaurants): { min: Date, max: Date }`
  - Scans all restaurants for `episode_info.published_at`
  - Returns the min and max dates for normalization
- **Test:** `web/src/lib/__tests__/color-utils.test.ts`
  - Test newest date returns red
  - Test oldest date returns blue
  - Test midpoint returns intermediate color
  - Test single-date dataset returns a sensible default
  - Test missing `published_at` returns neutral gray

#### 3.2 Update `createCustomIcon` for heat-based coloring
- **File:** `web/src/components/map/MapView.tsx`
- Modify `createCustomIcon` signature:
  - Add `heatColor: string` parameter
  - Keep `isFavorite` logic (favorites still get heart icon)
  - The marker body color comes from `heatColor` instead of `host_opinion`
- Compute date range once at the MapView level using `getDateRange()`
- For each restaurant, call `dateToHeatColor(restaurant.episode_info?.published_at, min, max)`
- Restaurants without a publish date get a neutral gray marker

#### 3.3 Add heat legend overlay
- **File:** `web/src/components/map/HeatLegend.tsx`
- A small overlay positioned bottom-left (above the existing counter badge)
- Shows a horizontal gradient bar from red → blue
- Labels: "חדש" (new) on the red end, "ישן" (old) on the blue end
- Compact design: ~120px wide, ~40px tall, semi-transparent background
- Only visible when there are markers on the map
- **Test:** `web/src/components/__tests__/heat-legend.test.tsx`
  - Test renders gradient bar
  - Test shows Hebrew labels

#### 3.4 Add toggle: heat mode vs. opinion mode
- **File:** `web/src/app/map/page.tsx`
- Add a toggle button in the top controls area (next to the "saved" toggle)
- Two modes: "לפי תאריך" (by date) / "לפי דעת המנחה" (by host opinion)
- Pass the active mode down to MapView
- MapView uses the mode to decide which coloring strategy to apply
- Default: heat mode (by date)
- **Test:** Test toggle switches between modes

### Definition of Done
- Map markers colored on a gradient from red (recent videos) to blue (old videos)
- Legend overlay explains the color scale
- Toggle to switch back to host-opinion coloring
- Restaurants without dates shown in gray
- Tests pass for color interpolation accuracy

---

## Sprint 4: Bottom Sheet with Restaurant List & Map Sync
**Goal:** A draggable bottom sheet showing the nearest restaurants in a scrollable list. Scrolling the list highlights markers on the map. Tapping markers scrolls the list. Haptic feedback on item focus.

### Tasks

#### 4.1 Create `MapBottomSheet` component (structure + drag)
- **File:** `web/src/components/map/MapBottomSheet.tsx`
- Built with Framer Motion (`motion.div`) + `@use-gesture/react` (already installed)
- Three snap states:
  - **Collapsed** (peek): ~80px visible — shows drag handle + "X מסעדות קרובות"
  - **Half**: ~40% viewport height — shows list
  - **Expanded**: ~85% viewport height — full scrollable list
- Drag handle: horizontal bar at top (4px tall, 40px wide, rounded, gray)
- Drag gesture via `useDrag` from @use-gesture/react
- Snap to nearest state on drag end (spring animation via Framer Motion)
- Sheet positioned `absolute` within the map container, `z-index: 1000`
- RTL layout with `dir="rtl"`
- **Test:** `web/src/components/__tests__/map-bottom-sheet.test.tsx`
  - Test renders in collapsed state initially
  - Test shows restaurant count
  - Test renders restaurant list items

#### 4.2 Create `RestaurantListItem` component
- **File:** `web/src/components/map/RestaurantListItem.tsx`
- Compact card for each restaurant in the bottom sheet list:
  - Restaurant name (Hebrew, bold)
  - Cuisine type + city (one line, muted)
  - Google rating (star + number) if available
  - Distance from user (e.g., "1.2 ק״מ") if user location available
  - Heat color dot (small circle matching the marker color)
  - Favorite heart icon if saved
- `isHighlighted` prop: when true, shows a colored left border + subtle background
- `onClick` handler for tapping to highlight on map
- Compact height: ~72px per item for comfortable scrolling
- **Test:** `web/src/components/__tests__/restaurant-list-item.test.tsx`
  - Test renders name, cuisine, rating
  - Test highlighted state applies visual changes
  - Test onClick fires callback

#### 4.3 Virtualized scrollable list inside sheet
- **File:** `web/src/components/map/MapBottomSheet.tsx` (continued)
- Use `react-window` (already installed) `FixedSizeList` for virtualization
  - Item height: 72px
  - Smooth scrolling performance even with hundreds of restaurants
- List sorted by distance (nearest first) when user location available
- `scrollToItem(index)` exposed via ref for external control (map marker tap)
- Handle scroll/drag gesture conflict:
  - When list is at scroll top and user drags down → drag the sheet
  - When list is scrolled down → scroll the list (not the sheet)
  - Use `onScroll` to track scroll offset, conditionally enable sheet drag

#### 4.4 Bidirectional map ↔ list synchronization
- **File:** `web/src/app/map/page.tsx` + `MapView.tsx` + `MapBottomSheet.tsx`
- Lift `selectedRestaurantId` state to `MapPage`
- **List → Map sync:**
  - Track which item is in the "focus zone" (center of the visible list area)
  - On scroll, update `selectedRestaurantId` based on the centered item
  - MapView reacts: highlighted marker gets enlarged icon (scale 1.3x) + bounce animation
  - Map pans smoothly to keep the highlighted marker visible (using `panTo` with animation)
- **Map → List sync:**
  - On marker click in MapView, set `selectedRestaurantId`
  - BottomSheet receives the ID, calls `scrollToItem()` to bring that restaurant into view
  - Expand sheet to half-state if collapsed
- Debounce scroll-triggered updates to ~100ms to prevent rapid state changes

#### 4.5 Highlighted marker animation
- **File:** `web/src/components/map/MapView.tsx`
- When a restaurant is selected:
  - Scale marker to 1.3x (modify the `L.divIcon` size to 42x52)
  - Add a pulsing ring around it (CSS animation on a `L.circleMarker` behind the icon)
  - Bring marker to front (`marker.setZIndexOffset(1000)`)
- When deselected, return to normal size
- Use `useEffect` to react to `selectedRestaurantId` changes

#### 4.6 Haptic feedback on item focus change
- **File:** `web/src/lib/haptics.ts`
- Create a utility:
  ```ts
  export function triggerHaptic(style: 'light' | 'medium' = 'light') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(style === 'light' ? 8 : 15);
    }
  }
  ```
- Call `triggerHaptic('light')` when the focused restaurant changes during scroll
- Throttle to max once per 100ms to prevent battery drain
- Graceful no-op on iOS Safari and desktop (no vibration motor)
- **Test:** `web/src/lib/__tests__/haptics.test.ts`
  - Test calls `navigator.vibrate` when available
  - Test does not throw when `vibrate` is unavailable
  - Test throttling works (multiple rapid calls only trigger once per 100ms)

#### 4.7 Adjust map layout for bottom sheet
- **File:** `web/src/app/map/page.tsx`
- Map fills full viewport height (behind the bottom sheet)
- Bottom sheet overlays the map with `pointer-events: none` on the transparent area
- Move the existing "saved" toggle and controls above the sheet's collapsed peek area
- Add bottom padding to `fitBounds` calls to account for the sheet height (~100px)
- Hide the existing "X מסעדות על המפה" badge (replaced by sheet header)

### Definition of Done
- Bottom sheet drags between collapsed/half/expanded with spring animation
- Restaurant list scrolls smoothly (virtualized) sorted by distance
- Scrolling the list highlights the corresponding marker on the map
- Tapping a marker scrolls the list to that restaurant
- Short haptic buzz on Android when focus changes
- No gesture conflicts between list scroll and sheet drag
- RTL layout works correctly
- Tests pass for all new components

---

## Sprint Summary

| Sprint | Features | New Files | Modified Files | New Deps | Est. Complexity |
|--------|----------|-----------|----------------|----------|-----------------|
| **1** | User location dot | 2 new components, 1 test | `useGeolocation.ts`, `MapView.tsx`, `map/page.tsx` | None | Low |
| **2** | Smart zoom to 10 nearest | 1 util, 1 hook, 2 tests | `MapView.tsx`, `map/page.tsx` | None | Low-Medium |
| **3** | Hot/cold pin colors | 1 util, 1 component, 2 tests | `MapView.tsx`, `map/page.tsx` | None | Medium |
| **4** | Bottom sheet + sync + haptics | 3 components, 1 util, 4 tests | `MapView.tsx`, `map/page.tsx` | None | High |

All features use existing dependencies (Leaflet, Framer Motion, @use-gesture/react, react-window). No new npm packages required.

### File Inventory

**New files to create:**
```
web/src/components/map/UserLocationMarker.tsx      (Sprint 1)
web/src/components/map/HeatLegend.tsx              (Sprint 3)
web/src/components/map/MapBottomSheet.tsx           (Sprint 4)
web/src/components/map/RestaurantListItem.tsx       (Sprint 4)
web/src/lib/geo-utils.ts                           (Sprint 2)
web/src/lib/color-utils.ts                         (Sprint 3)
web/src/lib/haptics.ts                             (Sprint 4)
web/src/hooks/useNearestRestaurants.ts             (Sprint 2)
web/src/hooks/__tests__/useGeolocation.test.ts     (Sprint 1)
web/src/hooks/__tests__/useNearestRestaurants.test.ts (Sprint 2)
web/src/lib/__tests__/geo-utils.test.ts            (Sprint 2)
web/src/lib/__tests__/color-utils.test.ts          (Sprint 3)
web/src/lib/__tests__/haptics.test.ts              (Sprint 4)
web/src/components/__tests__/user-location-marker.test.tsx  (Sprint 1)
web/src/components/__tests__/heat-legend.test.tsx   (Sprint 3)
web/src/components/__tests__/map-bottom-sheet.test.tsx (Sprint 4)
web/src/components/__tests__/restaurant-list-item.test.tsx (Sprint 4)
```

**Existing files modified:**
```
web/src/hooks/useGeolocation.ts                    (Sprint 1)
web/src/components/map/MapView.tsx                 (Sprints 1, 2, 3, 4)
web/src/app/map/page.tsx                           (Sprints 1, 2, 3, 4)
```

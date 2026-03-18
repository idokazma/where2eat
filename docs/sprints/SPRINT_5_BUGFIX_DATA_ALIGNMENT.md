# Sprint 5: Data Type Alignment & Frontend Hardening
**Bug Report Remediation Phase 2 — "Make the Data Match the UI"**

## Overview
Resolve all 5 moderate bugs where the backend data format diverges from frontend TypeScript types. Normalize enum values, fix data structure mismatches, and add validation layers so the app renders every field correctly.

## Goals
- [ ] Normalize `price_range` to English enum values (BUG-10)
- [ ] Normalize `status` to English enum values (BUG-11)
- [ ] Normalize `host_opinion` to English enum values (BUG-12)
- [ ] Fix `menu_items` data format from string[] to MenuItem[] (BUG-13)
- [ ] De-duplicate `food_trends` per restaurant (BUG-14)
- [ ] Add a data validation layer to the API route
- [ ] Add frontend fallback/normalization for legacy data

## Estimated Duration
3–4 working days

## Dependencies
Sprint 4 must be completed first (clean data in `data/restaurants/`).

---

## Technical Tasks

### 1. Define Canonical Data Schema & Mapping Tables — Priority P0

Before modifying data or code, establish the exact mapping between Hebrew values (from the AI analyzer) and English values (expected by the frontend TypeScript types).

#### 1a. Price Range Mapping
| AI Output (Hebrew) | Frontend Enum | Display |
|---|---|---|
| `"זול"`, `"תקציבי"` | `"budget"` | ₪ |
| `"בינוני"`, `"בינוני-יקר"` | `"mid-range"` | ₪₪ |
| `"יקר"`, `"יוקרתי"` | `"expensive"` | ₪₪₪ |
| `"לא צוין"`, `null` | `"not_mentioned"` | (hidden) |

#### 1b. Status Mapping
| AI Output (Hebrew) | Frontend Enum | Badge |
|---|---|---|
| `"פתוח"`, `"open"` | `"open"` | (none) |
| `"סגור"`, `"closed"` | `"closed"` | "סגור" (gray) |
| `"חדש"`, `"פתיחה חדשה"` | `"new_opening"` | "חדש!" (green) |
| `"נסגר בקרוב"` | `"closing_soon"` | "נסגר בקרוב" (red) |
| `"נפתח מחדש"` | `"reopening"` | "נפתח מחדש" (blue) |
| `"לא צוין"`, `null` | `null` | (none) |

#### 1c. Host Opinion Mapping
| AI Output (Hebrew) | Frontend Enum | Effect |
|---|---|---|
| `"חיובית מאוד"`, `"חיובית"` | `"positive"` | Quote shows on card |
| `"שלילית"` | `"negative"` | Warning indicator |
| `"מעורבת"` | `"mixed"` | Neutral display |
| `"ניטרלית"`, `"לא צוין"` | `"neutral"` | No special display |

- [ ] Create mapping file: `src/data_normalizer.py`
- [ ] Create TypeScript mapping: `web/src/lib/data-normalizer.ts`

**Files to create:**
- `src/data_normalizer.py`
- `web/src/lib/data-normalizer.ts`

---

### 2. Fix Price Range Values (BUG-10) — Priority P0

**Problem:** Data has Hebrew values (`"בינוני"`, `"יקר"`) but frontend `getPriceDisplay()` expects `"budget"`, `"mid-range"`, `"expensive"`.

#### 2a. Backend Fix — Normalize at the analyzer output
- [ ] Update `src/claude_restaurant_analyzer.py` prompt to output English enum values:
  ```
  "price_range": "budget" | "mid-range" | "expensive" | "not_mentioned"
  (Use English values only. Map: זול→budget, בינוני→mid-range, יקר→expensive)
  ```
- [ ] Add post-processing normalizer in `src/data_normalizer.py`:
  ```python
  PRICE_RANGE_MAP = {
      'זול': 'budget', 'תקציבי': 'budget',
      'בינוני': 'mid-range', 'בינוני-יקר': 'mid-range',
      'יקר': 'expensive', 'יוקרתי': 'expensive',
      'לא צוין': 'not_mentioned',
  }

  def normalize_price_range(value: str | None) -> str | None:
      if not value:
          return None
      return PRICE_RANGE_MAP.get(value, value)
  ```

#### 2b. Frontend Fallback — Handle legacy Hebrew values gracefully
- [ ] Update `getPriceDisplay()` in `RestaurantCardNew.tsx` and `restaurant/[id]/page.tsx`:
  ```typescript
  function getPriceDisplay(priceRange?: string | null): string {
    const normalized = normalizePriceRange(priceRange);
    switch (normalized) {
      case 'budget': return '₪';
      case 'mid-range': return '₪₪';
      case 'expensive': return '₪₪₪';
      default: return '';
    }
  }

  // In web/src/lib/data-normalizer.ts:
  const PRICE_MAP: Record<string, string> = {
    'budget': 'budget', 'mid-range': 'mid-range', 'expensive': 'expensive',
    'זול': 'budget', 'תקציבי': 'budget',
    'בינוני': 'mid-range', 'בינוני-יקר': 'mid-range',
    'יקר': 'expensive', 'יוקרתי': 'expensive',
  };

  export function normalizePriceRange(value?: string | null): string | null {
    if (!value) return null;
    return PRICE_MAP[value] ?? null;
  }
  ```

#### 2c. Migrate existing data files
- [ ] Run normalization script on all `data/restaurants/*.json`:
  ```python
  # scripts/normalize_data.py
  for file in restaurant_files:
      data['price_range'] = normalize_price_range(data.get('price_range'))
  ```

**Files to modify:**
- `src/claude_restaurant_analyzer.py` (prompt)
- `src/data_normalizer.py` (new)
- `web/src/lib/data-normalizer.ts` (new)
- `web/src/components/restaurant/RestaurantCardNew.tsx`
- `web/src/app/restaurant/[id]/page.tsx`
- `scripts/normalize_data.py` (new)
- `data/restaurants/*.json` (all files)

**Tests:**
- [ ] `test_normalize_price_range_hebrew_to_english` — "בינוני" → "mid-range"
- [ ] `test_normalize_price_range_passthrough` — "budget" → "budget"
- [ ] `test_normalize_price_range_null` — null → null
- [ ] Frontend test: `getPriceDisplay('mid-range')` returns '₪₪'
- [ ] Frontend test: `getPriceDisplay('בינוני')` returns '₪₪' (fallback)

---

### 3. Fix Status Values (BUG-11) — Priority P1

**Problem:** Data has `"פתוח"` but frontend `getStatusBadge()` expects `"new_opening"`, `"closed"`, etc.

- [ ] Add status normalization to `src/data_normalizer.py`:
  ```python
  STATUS_MAP = {
      'פתוח': 'open', 'open': 'open',
      'סגור': 'closed', 'closed': 'closed',
      'חדש': 'new_opening', 'פתיחה חדשה': 'new_opening',
      'נסגר בקרוב': 'closing_soon',
      'נפתח מחדש': 'reopening',
      'לא צוין': None,
  }
  ```
- [ ] Add frontend fallback in `web/src/lib/data-normalizer.ts`:
  ```typescript
  export function normalizeStatus(value?: string | null): string | null {
    if (!value) return null;
    const STATUS_MAP: Record<string, string> = {
      'פתוח': 'open', 'סגור': 'closed',
      'חדש': 'new_opening', 'פתיחה חדשה': 'new_opening',
      'נסגר בקרוב': 'closing_soon', 'נפתח מחדש': 'reopening',
    };
    return STATUS_MAP[value] ?? value;
  }
  ```
- [ ] Update `getStatusBadge()` in `web/src/app/restaurant/[id]/page.tsx` to use normalizer
- [ ] Migrate data files

**Tests:**
- [ ] `test_normalize_status_open` — "פתוח" → "open"
- [ ] `test_status_badge_new_opening` — "new_opening" shows green badge

---

### 4. Fix Host Opinion Values (BUG-12) — Priority P1

**Problem:** `RestaurantCardNew.tsx:220` checks `restaurant.host_opinion === 'positive'` but data has Hebrew `"חיובית"`.

- [ ] Add host opinion normalization to `src/data_normalizer.py`:
  ```python
  OPINION_MAP = {
      'חיובית מאוד': 'positive', 'חיובית': 'positive',
      'שלילית': 'negative',
      'מעורבת': 'mixed',
      'ניטרלית': 'neutral',
      'לא צוין': 'neutral',
  }
  ```
- [ ] Add frontend fallback in `web/src/lib/data-normalizer.ts`:
  ```typescript
  export function normalizeHostOpinion(value?: string | null): string | null {
    if (!value) return null;
    const OPINION_MAP: Record<string, string> = {
      'חיובית מאוד': 'positive', 'חיובית': 'positive',
      'שלילית': 'negative', 'מעורבת': 'mixed',
      'ניטרלית': 'neutral', 'לא צוין': 'neutral',
    };
    return OPINION_MAP[value] ?? value;
  }
  ```
- [ ] Update `RestaurantCardNew.tsx:220`:
  ```typescript
  // BEFORE:
  {restaurant.host_comments && restaurant.host_opinion === 'positive' && (

  // AFTER:
  {restaurant.host_comments && normalizeHostOpinion(restaurant.host_opinion) === 'positive' && (
  ```
- [ ] Migrate data files
- [ ] Also update the AI prompt to output English values going forward

**Tests:**
- [ ] `test_normalize_opinion_hebrew` — "חיובית" → "positive"
- [ ] Frontend test: Card renders host quote when opinion is "חיובית"
- [ ] Frontend test: Card renders host quote when opinion is "positive"

---

### 5. Fix Menu Items Format (BUG-13) — Priority P1

**Problem:** Data has `menu_items: ["בייגל קריספי צ'יקן"]` (strings) but frontend expects `MenuItem[]` objects with `item_name`, `description`, `price`, `recommendation_level`.

#### 5a. Backend — Normalize menu items at the analyzer
- [ ] Update AI prompt to output structured menu items:
  ```
  "menu_items": [
    {
      "item_name": "שם המנה",
      "description": "תיאור קצר",
      "price": "85₪" or null,
      "recommendation_level": "highly_recommended" | "recommended" | "mentioned"
    }
  ]
  ```
- [ ] Add post-processing normalizer in `src/data_normalizer.py`:
  ```python
  def normalize_menu_items(items: list) -> list:
      """Convert string items to MenuItem objects."""
      if not items:
          return []
      result = []
      for item in items:
          if isinstance(item, str):
              result.append({
                  'item_name': item,
                  'description': '',
                  'price': None,
                  'recommendation_level': 'mentioned'
              })
          elif isinstance(item, dict):
              result.append(item)
      return result
  ```

#### 5b. Frontend — Add type guard for menu items
- [ ] Add normalization in `web/src/lib/data-normalizer.ts`:
  ```typescript
  interface MenuItem {
    item_name: string;
    description?: string;
    price?: string | null;
    recommendation_level?: string;
  }

  export function normalizeMenuItems(items?: unknown[]): MenuItem[] {
    if (!items || items.length === 0) return [];
    return items.map(item => {
      if (typeof item === 'string') {
        return { item_name: item, description: '', price: null, recommendation_level: 'mentioned' };
      }
      return item as MenuItem;
    });
  }
  ```
- [ ] Update `web/src/app/restaurant/[id]/page.tsx` to use normalizer before rendering menu items

#### 5c. Migrate data files
- [ ] Run normalizer on existing data files to convert string arrays to object arrays

**Tests:**
- [ ] `test_normalize_menu_items_strings` — `["pizza"]` → `[{item_name: "pizza", ...}]`
- [ ] `test_normalize_menu_items_objects` — already-correct objects pass through
- [ ] `test_normalize_menu_items_empty` — `[]` → `[]`
- [ ] Frontend test: Menu section renders without crash for both string and object data

---

### 6. De-duplicate Food Trends Per Restaurant (BUG-14) — Priority P2

**Problem:** All restaurants share identical `food_trends` arrays because the video-level trends were copied to each restaurant.

- [ ] Update the AI analyzer to extract restaurant-specific trends (not video-level):
  ```
  "food_trends": List of food trends SPECIFIC TO THIS RESTAURANT only.
  Do not repeat video-level trends across all restaurants.
  Examples: "פרסי חדש בתל אביב", "טעימות שף" — relate to the specific restaurant.
  If no specific trends, use an empty array [].
  ```
- [ ] In the pipeline, separate video-level trends from restaurant-level trends:
  ```python
  # Episode-level trends go in episode_info
  # Restaurant-level trends stay in restaurant.food_trends
  ```
- [ ] Clean existing data: if all restaurants have identical trends, move them to a separate `episode_trends` field and set `food_trends` to `[]` for each restaurant
- [ ] Update frontend if it displays food_trends anywhere (currently not prominently displayed, but clean data is important)

**Tests:**
- [ ] `test_food_trends_not_identical` — when processing multiple restaurants, they shouldn't all share the same trends
- [ ] Verify at least 3 restaurants have distinct food_trends (or empty)

---

### 7. Create Unified Normalization Pipeline — Priority P1

Tie all normalizers together in a single pass:

#### 7a. Backend script
- [ ] Create `scripts/normalize_data.py`:
  ```python
  """Normalize all restaurant data files to match frontend type expectations."""
  from src.data_normalizer import (
      normalize_price_range, normalize_status,
      normalize_host_opinion, normalize_menu_items
  )

  def normalize_restaurant(data: dict) -> dict:
      data['price_range'] = normalize_price_range(data.get('price_range'))
      data['status'] = normalize_status(data.get('status'))
      data['host_opinion'] = normalize_host_opinion(data.get('host_opinion'))
      data['menu_items'] = normalize_menu_items(data.get('menu_items', []))
      # Remove photo_url (use photo_reference via proxy)
      for photo in data.get('photos', []):
          photo.pop('photo_url', None)
      return data
  ```
- [ ] Run on all data files after each pipeline execution

#### 7b. API route normalization layer
- [ ] Optionally add normalization in `web/src/app/api/restaurants/route.ts` as a safety net:
  ```typescript
  const normalized = restaurants.map(normalizeRestaurant);
  return NextResponse.json({ restaurants: normalized, count: normalized.length });
  ```
  This ensures even un-migrated data renders correctly.

**Files to create/modify:**
- `src/data_normalizer.py` (new — central Python normalizer)
- `web/src/lib/data-normalizer.ts` (new — frontend normalizer)
- `scripts/normalize_data.py` (new — batch migration script)
- `web/src/app/api/restaurants/route.ts` (optional safety normalization)

---

## File Structure Changes
```
src/
├── data_normalizer.py                     [NEW - Python normalization]
scripts/
├── normalize_data.py                      [NEW - batch migration]
web/src/
├── lib/
│   ├── data-normalizer.ts                 [NEW - TS normalization]
│   └── __tests__/data-normalizer.test.ts  [NEW - tests]
├── components/
│   └── restaurant/
│       └── RestaurantCardNew.tsx           [UPDATE - use normalizer]
├── app/
│   ├── restaurant/[id]/page.tsx           [UPDATE - use normalizer]
│   └── api/restaurants/route.ts           [UPDATE - safety normalization]
data/
├── restaurants/*.json                      [UPDATE - all normalized]
tests/
├── test_data_normalizer.py                [NEW - Python normalizer tests]
```

## Testing Checklist
- [ ] All price ranges display correctly (₪/₪₪/₪₪₪)
- [ ] Status badges render for appropriate statuses
- [ ] Host opinion quotes appear on restaurant cards
- [ ] Menu items render without crash for both string and object data
- [ ] Food trends are restaurant-specific (not all identical)
- [ ] Price filter on homepage actually filters restaurants
- [ ] Legacy Hebrew values handled gracefully (no blank/broken display)
- [ ] TypeScript build passes: `cd web && npm run build`
- [ ] All existing tests pass: `cd web && npm run test`
- [ ] Python tests pass: `python -m pytest tests/`

## Success Metrics
- 100% of restaurants with price data show ₪ symbols
- 100% of restaurants with positive opinions show host quotes on cards
- 0 runtime crashes from type mismatches
- Menu items section renders correctly for all restaurants
- `npm run build` completes with 0 TypeScript errors

## Next Sprint Preview
Sprint 6 will address the remaining minor functional bugs: implement the trending time filter, map page, distance calculation, and performance improvements.

## Notes
- The normalization approach is **dual-layer**: fix at the source (Python analyzer) AND at the frontend (TypeScript). This ensures backward compatibility with any old data files.
- Run `npm run build` after every code change to catch TypeScript errors early
- The batch migration script should be idempotent (safe to run multiple times)
- Consider adding a JSON schema validator to the data pipeline

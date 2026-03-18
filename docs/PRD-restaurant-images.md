# PRD: Restaurant Image Integration & Visual Enhancement

**Author:** Claude Code
**Date:** 2026-02-11
**Status:** Approved
**Priority:** High

---

## Problem Statement

The Where2Eat app currently displays restaurants without any photos. All restaurant cards and detail pages show plain cuisine-based gradient backgrounds instead of actual restaurant imagery. This makes the experience feel generic, lifeless, and unengaging — users cannot visually assess restaurants before clicking through.

**The irony:** Google Places photo data is already collected and returned by the API (`photos` array with up to 3 URLs per restaurant), but the frontend completely ignores it. The infrastructure is ready; the wiring is missing.

## Goals

1. **Display restaurant photos everywhere** — feed cards, detail pages, trending, saved
2. **Create visual hierarchy** — featured restaurants get hero treatment, regular cards get thumbnails
3. **Graceful degradation** — keep cuisine gradients as beautiful fallbacks when no photo exists
4. **Performance-first** — lazy loading, blurred placeholders, proper image sizing
5. **Engaging detail pages** — photo gallery, parallax hero, visual storytelling

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Visual engagement (time on page) | Baseline | +40% |
| Restaurant detail page visits from feed | Baseline | +25% |
| User-perceived quality (qualitative) | "Looks like a prototype" | "Feels like a real app" |

## Non-Goals

- Uploading custom images (admin feature for later)
- Image CDN/proxy setup (use Google Places URLs directly for now)
- Image moderation or content filtering
- User-generated photos

---

## Current State

### What exists:
- **API returns `photos` array**: `[{ photo_reference, photo_url, width, height }]` (up to 3 per restaurant)
- **`OptimizedImage` component**: Lazy loading, shimmer effect, fallback handling — fully built, barely used
- **`VisualRestaurantCard`**: Image-heavy card variant — built but unused in production
- **`RestaurantCardNew`**: Accepts `imageUrl` prop — never receives one
- **Cuisine gradient CSS**: Beautiful fallback backgrounds for 8 cuisine types

### What's broken:
- Frontend TypeScript types don't include `photos` field
- `HomePageNew` → `DiscoveryFeed` → `RestaurantCardNew` never passes image data
- Restaurant detail page has zero image display
- No photo gallery component exists
- Google Places API key is exposed in photo URLs (security concern)

---

## Sprint 1: Image Foundation & Feed Cards

**Theme:** "Every restaurant gets a face"
**Scope:** Wire up photo data flow and display images on all card variants

### 1.1 Type System Update
- Add `photos` array to `Restaurant` TypeScript interface
- Add `image_url` optional field
- Create `RestaurantPhoto` type: `{ photo_reference: string; photo_url: string; width: number; height: number }`

### 1.2 Photo URL Proxy (Security)
- Create Next.js API route `/api/photos/[reference]` that proxies Google Places photo requests
- Keep API key server-side only
- Add cache headers (photos rarely change)
- Create `getRestaurantPhotoUrl()` utility that returns proxy URL

### 1.3 Discovery Feed Cards with Images
- Pass `photos[0].photo_url` as `imageUrl` to `RestaurantCardNew`
- Use `OptimizedImage` component for proper lazy loading
- Maintain cuisine gradient as fallback when no photo exists
- Subtle dark overlay gradient on image for text readability
- Show photo count badge (e.g., "3 photos") on cards with multiple photos

### 1.4 Featured Carousel with Real Images
- Wire `FeaturedCarousel` into the home page hero section
- Use top-rated restaurants with photos as featured items
- `VisualRestaurantCard` already supports images — just pass the data

### 1.5 Trending & Saved Pages
- Pass photo URLs to cards on `/trending` page
- Pass photo URLs to cards on `/saved` page
- Consistent image experience across all list views

### 1.6 Image Utility Helper
- `getRestaurantImage(restaurant)` — returns best available photo URL or null
- `getRestaurantImages(restaurant)` — returns all photo URLs
- `getCuisineGradient(cuisineType)` — existing logic, extracted to reusable utility

### Sprint 1 Deliverables:
- [ ] Updated TypeScript types with photo fields
- [ ] Photo proxy API route
- [ ] Image utility functions
- [ ] Feed cards display restaurant photos
- [ ] Featured carousel with real images on home page
- [ ] Trending page cards with images
- [ ] Saved page cards with images
- [ ] Graceful gradient fallback preserved

---

## Sprint 2: Detail Page Overhaul & Visual Polish

**Theme:** "Tell the restaurant's story"
**Scope:** Rich detail page with photo gallery, visual enhancements across the app

### 2.1 Restaurant Detail Page — Hero Image
- Replace gradient hero with full-width photo (blurred background + sharp foreground)
- Parallax scroll effect on hero image
- Floating restaurant name overlay with glassmorphism
- Breadcrumb back navigation overlaid on hero

### 2.2 Photo Gallery Component
- Horizontal scrollable photo strip below the hero
- Tap to open fullscreen lightbox gallery
- Swipe between photos in lightbox
- Photo counter indicator (1/3, 2/3, etc.)
- Pinch-to-zoom on mobile

### 2.3 Detail Page Content Refresh
- Section cards with subtle shadows and rounded corners
- Info chips: cuisine type, price range, rating — visual badges
- Menu items section with better visual hierarchy
- Host opinion section with quote styling and episode thumbnail
- Map preview snippet with restaurant pin
- Contact actions as icon buttons (call, navigate, website)

### 2.4 Skeleton Loading States
- Image-aware skeleton for feed cards (show image placeholder area)
- Detail page skeleton with hero placeholder
- Shimmer animation on all skeleton elements

### 2.5 Empty & Error States
- "No photo available" elegant placeholder with cuisine icon
- Broken image graceful fallback
- Network error states for image loading

### Sprint 2 Deliverables:
- [ ] Hero image on restaurant detail page
- [ ] Photo gallery with lightbox
- [ ] Refreshed detail page layout
- [ ] Image-aware loading skeletons
- [ ] Empty/error states for images
- [ ] Visual polish pass on all pages

---

## Technical Architecture

### Photo Data Flow (After Implementation)

```
Google Places API → photos array in restaurant JSON
    ↓
Express/FastAPI API → returns photos in response
    ↓
Next.js Frontend → extracts photos from restaurant data
    ↓
getRestaurantImage() utility → returns proxy URL or null
    ↓
OptimizedImage component → lazy loads with shimmer
    ↓
User sees restaurant photo (or cuisine gradient fallback)
```

### Photo Proxy Route

```
GET /api/photos/[reference]?maxwidth=800
    ↓
Server reads GOOGLE_PLACES_API_KEY from env
    ↓
Fetches https://maps.googleapis.com/maps/api/place/photo
    ↓
Streams response with cache headers (7 day cache)
    ↓
Returns image binary to client
```

### Component Hierarchy

```
HomePageNew
├── FeaturedCarousel (top-rated with photos)
│   └── VisualRestaurantCard (imageUrl from photos[0])
│       └── OptimizedImage
└── DiscoveryFeed
    └── RestaurantCardNew (imageUrl from photos[0])
        └── OptimizedImage (lazy, shimmer, fallback)

RestaurantDetailPage
├── HeroImage (photos[0], parallax)
│   └── OptimizedImage (priority loading)
├── PhotoGallery (all photos)
│   └── OptimizedImage[] (lazy)
│   └── LightboxGallery (fullscreen)
├── InfoSection
├── MenuSection
├── HostOpinionSection
└── ContactSection
```

### New Files

| File | Purpose |
|------|---------|
| `web/src/lib/images.ts` | Photo URL utilities (getRestaurantImage, proxy URL builder) |
| `web/src/app/api/photos/[reference]/route.ts` | Google Places photo proxy |
| `web/src/components/restaurant/PhotoGallery.tsx` | Horizontal photo strip + lightbox |
| `web/src/components/restaurant/HeroImage.tsx` | Detail page hero with parallax |

### Modified Files

| File | Changes |
|------|---------|
| `web/src/types/restaurant.ts` | Add RestaurantPhoto type, photos field |
| `web/src/components/restaurant/RestaurantCardNew.tsx` | Use OptimizedImage, accept photo data |
| `web/src/components/feed/DiscoveryFeed.tsx` | Pass photo URLs to cards |
| `web/src/app/page.tsx` / `HomePageNew.tsx` | Add featured carousel, pass photos |
| `web/src/app/restaurant/[id]/page.tsx` | Hero image, gallery, layout refresh |
| `web/src/app/trending/page.tsx` | Pass photos to cards |
| `web/src/app/saved/page.tsx` | Pass photos to cards |
| `web/src/components/skeletons/` | Update for image placeholders |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Google Places photo URLs expire | Photo proxy caches for 7 days; URLs are refreshed on enrichment |
| API key exposure in photo URLs | Proxy route keeps key server-side |
| Large images slow page load | OptimizedImage handles lazy loading; maxwidth=800 in proxy |
| Restaurants without photos look worse next to ones with | Cuisine gradients are visually appealing fallbacks |
| Too many API calls to Google | Proxy caching reduces redundant fetches |

---

## Timeline

| Sprint | Duration | Focus |
|--------|----------|-------|
| Sprint 1 | Foundation | Types, proxy, feed cards, images everywhere |
| Sprint 2 | Polish | Detail page hero, gallery, lightbox, skeletons |

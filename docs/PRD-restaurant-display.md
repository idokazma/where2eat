# PRD: Restaurant Display Design - Card & Detail Views

## Overview

This PRD defines how restaurants should be displayed in the Where2Eat app across two primary views:
1. **Restaurant Card** - The compact, scrollable feed view for discovery
2. **Restaurant Detail Page** - The full immersive experience when viewing a single restaurant

The design must balance rich media (photos, quotes, ratings) with information density while maintaining excellent performance and RTL Hebrew support. Since restaurants are sourced from YouTube podcast discussions, the design should highlight the social proof and storytelling aspects that make this app unique.

---

## Goals

### Primary Goals
- **Visual Discovery First**: Lead with imagery and compelling quotes to drive engagement
- **Build Trust**: Surface social proof (host opinions, ratings, quotes) prominently
- **Reduce Decision Friction**: Show only essential info on cards, provide depth on detail page
- **Drive Engagement**: Make it easy to watch the source YouTube segment where the restaurant was mentioned

### Secondary Goals
- **Handle Data Variability**: Gracefully handle missing data (no image, no rating, no host opinion)
- **Mobile-First RTL**: Optimized for Hebrew-reading mobile users
- **Performance**: Fast load times with progressive image loading
- **Accessibility**: Proper semantic HTML, ARIA labels, keyboard navigation

---

## Restaurant Card Specification

### Visual Hierarchy (Top to Bottom)

```
+-----------------------------------------+
|   [Image with overlay badges]           | <- Hero image (16:9 or 4:3)
|   * Status badge (top-right)            |
|   * Cuisine badge (bottom-left)         |
+-----------------------------------------+
| "Quote from host..." (truncated)        | <- Engaging quote (2 lines max)
+-----------------------------------------+
| Restaurant Name (Hebrew)                | <- Name (1 line, bold)
| City - Neighborhood                     | <- Location (1 line, muted)
+-----------------------------------------+
| Rating 4.5 (234) - Price - Host: +1     | <- Stats row
+-----------------------------------------+
```

### Required Fields

| Field | Fallback Behavior | Notes |
|-------|------------------|-------|
| `name_hebrew` | Use `name_english` | Primary identifier |
| `cuisine_type` | Show generic badge | For visual categorization |
| `city` | Hide location row | Essential for filtering |
| `image_url` or `photos[0]` | Use placeholder gradient with cuisine emoji | Visual is critical |

### Optional Fields (Display if Available)

| Field | Display Logic | Visual Treatment |
|-------|---------------|------------------|
| `engaging_quote` | Show if present, max 2 lines with ellipsis | Italic text, quote marks, prominent |
| `host_opinion` | Show as indicator: positive, negative, mixed/neutral | In stats row |
| `google_rating` | Show if `google_user_ratings_total > 0` | Star icon + number |
| `neighborhood` | Show after city with bullet separator | Muted text |
| `status` | Show badge only for: `new_opening`, `closing_soon`, `reopening` | Colored badge overlay |
| `price_range` | Convert to shekel symbols | In stats row |

### Layout Specifications

**Card Dimensions:**
- Width: Full container width minus 16px padding (mobile)
- Height: Auto (min 320px, max 420px)
- Aspect Ratio: Image should be 16:9 or 4:3, approximately 40-50% of card height

**Image Section:**
- Image: Cover fit, center crop, lazy loaded
- Overlay gradient: Linear gradient from transparent to rgba(0,0,0,0.3) for badge readability
- Status badge: Top-right (top-left in RTL), 8px margin, small pill badge
- Cuisine badge: Bottom-left (bottom-right in RTL), 8px margin, semi-transparent backdrop

**Quote Section:**
- Max 2 lines, `line-clamp-2` with ellipsis
- Font: Italic, 14-15px, medium weight
- Color: Foreground muted (gray-700 dark mode: gray-300)
- Padding: 12px horizontal, 10px top, 6px bottom
- Show Hebrew quote marks
- Hide entire section if no `engaging_quote`

**Name & Location Section:**
- Name: Font size 18px, bold (600), 1 line with ellipsis
- Location: Font size 14px, regular, muted color
- Padding: 6px top, 12px horizontal

**Stats Row:**
- Font size: 13px
- Items separated by bullets
- Icons: 16px size, inline with text
- Padding: 8px top, 12px horizontal, 12px bottom
- Order (RTL): Host opinion - Price - Rating

### Interaction States

| State | Visual Change |
|-------|--------------|
| **Hover** (desktop) | Subtle scale (1.02), shadow increase, cursor pointer |
| **Tap** (mobile) | Quick scale down (0.98), then navigate |
| **Loading** | Skeleton loader matching card structure |
| **Image loading** | Blur-up: show blurred placeholder then sharp image |
| **Error** | Show placeholder with retry option |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| No image | Use gradient background with large cuisine emoji |
| No engaging quote | Remove quote section entirely, image becomes larger |
| No rating | Hide rating, keep price and host opinion if available |
| No host opinion | Hide host opinion indicator |
| No price data | Hide price indicator |
| Very long name | Truncate with ellipsis after 1 line |
| Status = "closed" | Show "closed" badge in red, reduce card opacity to 0.7 |
| No neighborhood | Just show city |
| No city | Show "unknown location" |

### Accessibility
- Semantic HTML: `<article>` for card, `<img>` with alt text
- Alt text format: "Image of [restaurant name] - [cuisine type]" (in Hebrew)
- ARIA label: "Restaurant card: [name], [city], rating [rating]" (in Hebrew)
- Keyboard: Focusable with visible focus ring, Enter/Space to open

---

## Restaurant Detail Page Specification

### Page Structure (Sections in Order)

```
1. Hero Section (image + overlay info)
2. Quick Actions Bar (save, share, directions, call)
3. Host Opinion & Quote (prominent callout)
4. YouTube Episode Section (watch button, timestamp links)
5. About & Features
6. Menu Items (if available)
7. Location & Contact
8. Business Hours
9. Photo Gallery
10. Additional Episodes (if mentioned in multiple episodes)
```

### 1. Hero Section

**Layout:**
- Full-width hero image (16:9, max height 400px on mobile)
- Dark gradient overlay (bottom 60% of image, rgba(0,0,0,0.6))
- Content overlaid on bottom portion

**Content (overlaid on image):**
- Restaurant name (Hebrew) - 28px, bold, white, drop shadow
- Location: City, Neighborhood - 16px, white with opacity 0.9
- Status badge (if applicable) - top-right corner
- Quick stats row:
  - Google rating + review count
  - Price range
  - Cuisine type badge

**Edge Cases:**
- No image: Use blurred gradient background (derived from cuisine color palette)
- Closed restaurant: Red "permanently closed" banner across top

### 2. Quick Actions Bar

**Fixed bar below hero (sticky on scroll):**

| Action | Icon | Condition | Behavior |
|--------|------|-----------|----------|
| Save | Heart (outline/filled) | Always | Toggle favorite, persist to local storage |
| Share | Share icon | Always | Native share sheet or copy link |
| Directions | Navigation icon | If `latitude` + `longitude` available | Open Google Maps with coordinates |
| Call | Phone icon | If `contact_phone` available | `tel:` link |
| Website | Globe icon | If `contact_website` available | Open external link |

- Layout: Flex row, evenly spaced, 56px height
- Style: Large touch targets (48x48px min), icon + label below
- Background: Subtle card with border

### 3. Host Opinion & Quote Section

**Prominent card with colored accent:**

```
+--------------------------------------------+
| What the host thinks                       | <- Section header
+--------------------------------------------+
|                                            |
| [Large accent quote in italics]            | <- engaging_quote
|                                            |
| -- Host name (episode title)               | <- Attribution
|                                            |
| Opinion: [Positive badge]                  | <- host_opinion
|                                            |
| [Additional host comments if present]      | <- host_comments
|                                            |
+--------------------------------------------+
```

**Styling:**
- Background: Subtle colored tint based on opinion (green for positive, yellow for mixed, red for negative, gray for neutral)
- Border-right (RTL: border-left): 4px solid accent color
- Font: Quote in 18-20px italic, medium weight
- Padding: 20px all sides

**Edge Cases:**
- No engaging_quote: Use first sentence of host_comments
- No host_opinion: Show as neutral
- No host data at all: Hide entire section

### 4. YouTube Episode Section

**Card with video thumbnail and action:**

```
+--------------------------------------------+
| Appeared in episode                        | <- Section header
+--------------------------------------------+
| [Video thumbnail]  |  Episode Title        |
|                    |  Channel Name          |
| [Play icon]        |  Analysis Date         |
|                    |                        |
|                    |  [Watch Episode] CTA   |
+--------------------------------------------+
| Jump to exact moment:                      |
| * 05:23 - Review & recommendation          | <- Timestamp links
| * 12:45 - Menu discussion                  |
| * 18:10 - Business news                    |
+--------------------------------------------+
```

**Functionality:**
- Video thumbnail: Extract from YouTube API or use default
- "Watch Episode" button: Opens YouTube video URL
- Timestamp links: Open YouTube at specific time (`video_url + &t=XXs`)
- Each timestamp shows: time + context from `mention_timestamps[].context`

**Data Mapping:**
- Use `video_url`, `video_id`
- Use `mention_timestamps[]` array for multiple mentions
- Fall back to `mention_timestamp_seconds` if array not available
- Show `mention_context` as badge (e.g., "recommendation", "new opening", "review")

**Edge Cases:**
- No video_url: Hide entire section
- No timestamps: Just show "Watch Episode" button without timestamp list
- Multiple episodes: Show first one here, list others at bottom

### 5. About & Features

**Simple list layout:**

```
+--------------------------------------------+
| About                                      |
+--------------------------------------------+
| [Cuisine type in Hebrew]                   |
| [Business news if recent]                  |
|                                            |
| Special Features:                          |
| * Special feature 1                        |
| * Special feature 2                        |
| * Special feature 3                        |
+--------------------------------------------+
```

- Show `cuisine_type` translated to Hebrew
- Show `business_news` if present, with date
- List `special_features[]` as bullet points
- Hide section if no features and no business news

### 6. Menu Items Section

**Card-based layout with recommendation indicators:**

```
+--------------------------------------------+
| Recommended Menu                           | <- Section header
+--------------------------------------------+
| [fire] Dish Name                    45NIS  | <- Highly recommended
|    Short description...                    |
+--------------------------------------------+
| [star] Another Dish                 38NIS  | <- Recommended
|    Description here...                     |
+--------------------------------------------+
| * Regular Item                      32NIS  | <- Mentioned
|    Description...                          |
+--------------------------------------------+
```

**Item Structure (from `menu_items[]`):**
- `item_name` - Bold, 16px
- `price` - Aligned left (RTL: right), muted
- `description` - Regular, 14px, muted, 2 lines max
- `recommendation_level` - Visual indicator:
  - `highly_recommended` - fire icon + yellow/orange background tint
  - `recommended` - star icon + subtle highlight
  - `mentioned` - Regular bullet
  - `not_recommended` - thumbs down + red tint (rare)

**Edge Cases:**
- No menu_items: Hide entire section
- No prices: Hide price column
- No descriptions: Show just name + price

### 7. Location & Contact

**Two-column layout (stack on small mobile):**

```
+--------------------------------------------+
| Location & Contact                         |
+--------------------------------------------+
| [pin] Address                              |
|    City, Neighborhood                      |
|    [Open in Maps] button                   |
|                                            |
| [phone] Phone number                       |
|    [Call] button                            |
|                                            |
| [globe] Website URL                        |
|    [Visit Website] button                  |
+--------------------------------------------+
```

- Show `address`, `city`, `neighborhood`
- Link to Google Maps: Use `google_url` if available, else construct from coordinates
- Show `contact_phone` as clickable `tel:` link
- Show `contact_website` as external link
- All icons should be 20px, inline with text

**Edge Cases:**
- No address: Show just city + neighborhood
- No coordinates: Disable directions button
- No phone: Hide phone row
- No website: Hide website row

### 8. Business Hours

**Table or accordion layout:**

```
+--------------------------------------------+
| Opening Hours                              |
| Currently: Open/Closed                     | <- open_now status
+--------------------------------------------+
| Sunday        09:00 - 23:00               |
| Monday        09:00 - 23:00               |
| Tuesday       09:00 - 23:00               |
| Wednesday     09:00 - 23:00               |
| Thursday      09:00 - 01:00               |
| Friday        Closed                       |
| Saturday      17:00 - 23:00               |
+--------------------------------------------+
```

- Use `business_hours.weekday_text[]` from Google Places
- Highlight current day with bold + accent color
- Show "Currently Open" or "Currently Closed" with green/red indicator dot
- Fall back to `contact_hours` if Google Places hours unavailable

**Edge Cases:**
- No hours data: Show "Opening hours not available"
- 24/7: Show "Open 24/7"
- Temporarily closed: Show red banner

### 9. Photo Gallery

**Masonry or horizontal scroll grid:**

```
+-------------------------------------------------+
| Photos                                          |
+-------------------------------------------------+
| [img] [img] [img]                               | <- Primary row (3 images)
| [img] [img] [img] [img] [+12]                   | <- Secondary row with overflow
+-------------------------------------------------+
```

- Show first 7-8 images from `photos[]`
- If more than 8, show "+N" overlay on last image
- Clicking opens lightbox gallery with all photos
- Use `photo_url` or construct from `photo_reference`
- Lazy load images with blur-up placeholder

**Edge Cases:**
- Only 1 image: Show as single large image
- No additional photos: Show just hero image again or hide section
- Failed image load: Show placeholder with error icon

### 10. Additional Episodes

**If restaurant mentioned in multiple episodes:**

```
+-------------------------------------------------+
| Also appeared in these episodes                 |
+-------------------------------------------------+
| * Episode Title 1 (Date) [Watch]               |
| * Episode Title 2 (Date) [Watch]               |
| * Episode Title 3 (Date) [Watch]               |
+-------------------------------------------------+
```

- Simple list with links to YouTube
- Show analysis date for each mention
- Max 5 additional episodes, then "and X more episodes" link to full list

---

## Design Principles

### RTL-First Hebrew Interface
- All layouts must work perfectly in RTL mode
- Icons that indicate direction (arrows, chevrons) must flip in RTL
- Text alignment: right-aligned for Hebrew, left-aligned for English
- Padding/margins: Use logical properties (`padding-inline-start` vs `padding-left`)

### Mobile-First, Touch-Optimized
- Minimum touch target: 48x48px for all interactive elements
- Generous padding around tappable areas
- Avoid hover-dependent interactions
- Bottom navigation for primary actions (not top)

### Performance
- Lazy load all images below the fold
- Use Next.js Image component with blur placeholders
- Limit initial render to above-the-fold content
- Virtualize long lists (if showing many restaurants)

### Hebrew Typography
- Primary font: System font stack with Hebrew support
- Font sizes optimized for Hebrew characters (slightly larger than English equivalents)
- Line height: 1.6-1.8 for readability
- Avoid all-caps (Hebrew doesn't have caps)

### Visual Hierarchy
- Use size, weight, color, and spacing to create hierarchy
- Most important info first (F-pattern for scanning)
- Group related information together
- Use whitespace generously

### Accessibility
- Semantic HTML5 elements
- ARIA labels in Hebrew for screen readers
- Color contrast ratio: minimum 4.5:1 for text
- Keyboard navigation support
- Focus indicators clearly visible

---

## Data Dependencies

### Restaurant Card - Required Data

**Critical (cannot render card without):**
- `name_hebrew` OR `name_english`
- `cuisine_type` (for fallback emoji/badge)

**Strongly Recommended (card is weak without):**
- `image_url` or `photos[0]`
- `city`
- `engaging_quote` or `host_comments`

**Optional Enhancement:**
- `google_rating` + `google_user_ratings_total`
- `host_opinion`
- `price_range`
- `neighborhood`
- `status`

### Restaurant Detail Page - Required Data

**Critical:**
- `name_hebrew` OR `name_english`
- `cuisine_type`
- `city`

**Strongly Recommended:**
- `image_url` or `photos[0]`
- `video_url` or `video_id`
- `engaging_quote` or `host_comments`
- `host_opinion`
- `address` or (`latitude` + `longitude`)

**Optional Enhancement:**
- `menu_items[]`
- `special_features[]`
- `business_hours`
- `contact_phone`
- `contact_website`
- `mention_timestamps[]`
- `business_news`
- `photos[]` (additional photos)
- `google_place_id` / `google_url`

### Data Quality Indicators

**For each restaurant, track data completeness score:**

```
Completeness Score = (filled_fields / total_available_fields) * 100

Tiers:
- 90-100%: "Rich" - Show badge or prioritize in feed
- 70-89%: "Complete" - Standard display
- 50-69%: "Basic" - Show with disclaimers
- Below 50%: "Incomplete" - Consider hiding or deprioritizing
```

---

## Acceptance Criteria

### Restaurant Card
- [ ] Card displays with image, name, location, and quote (when available)
- [ ] Status badges render correctly for new_opening, closing_soon, reopening
- [ ] Cuisine badge appears on all cards
- [ ] Rating displays only when google_user_ratings_total > 0
- [ ] Host opinion indicator shows correctly for all opinion types
- [ ] Price range converts to shekel symbols
- [ ] Missing image shows gradient placeholder with cuisine emoji
- [ ] Missing quote removes quote section and adjusts layout
- [ ] Card is tappable/clickable with proper touch feedback
- [ ] Hover state works on desktop
- [ ] Hebrew text is right-aligned and renders correctly
- [ ] Long restaurant names truncate with ellipsis
- [ ] Closed restaurants show with reduced opacity and "closed" badge
- [ ] Cards lazy load images as user scrolls
- [ ] Skeleton loader shows during initial load

### Restaurant Detail Page
- [ ] Hero image loads with proper gradient overlay
- [ ] Restaurant name and location display prominently on hero
- [ ] Quick action bar shows with all available actions (save, share, directions, call, website)
- [ ] Save/favorite functionality toggles correctly
- [ ] Share button opens native share sheet (mobile) or copies link
- [ ] Directions button opens Google Maps with correct coordinates
- [ ] Host opinion section displays with colored accent based on sentiment
- [ ] Engaging quote shows with proper formatting and attribution
- [ ] YouTube episode section shows video thumbnail and watch button
- [ ] Timestamp links open YouTube video at correct time
- [ ] Menu items display with proper recommendation indicators
- [ ] Menu item prices align correctly in RTL layout
- [ ] Business hours show current status (open/closed) with indicator
- [ ] Current day is highlighted in hours table
- [ ] Photo gallery shows all available images with lightbox on click
- [ ] Additional episodes section shows when restaurant mentioned multiple times
- [ ] All sections gracefully hide when data is missing
- [ ] Page is fully responsive from 320px to desktop
- [ ] All interactive elements have min 48x48px touch targets
- [ ] Page loads with progressive enhancement (hero first, then sections)
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader announces page sections correctly in Hebrew
- [ ] Back button returns to feed at same scroll position

### Cross-Cutting
- [ ] All text is properly localized (Hebrew primary, English fallback)
- [ ] RTL layout works correctly across all components
- [ ] Images have proper alt text in Hebrew
- [ ] Loading states show for all async content
- [ ] Error states display user-friendly messages in Hebrew
- [ ] Color contrast meets WCAG AA standards (4.5:1 minimum)
- [ ] Components use shadcn/ui primitives where applicable
- [ ] Styling uses Tailwind CSS 4 classes
- [ ] No console errors or warnings
- [ ] Performance: First Contentful Paint < 1.5s, TTI < 3s

---

## Out of Scope

This PRD does **NOT** cover:

- **Filtering & Sorting UI**: Separate PRD needed for filter bar, sort options, search
- **Map View**: Integration of restaurants into map interface
- **Comparison Feature**: Side-by-side restaurant comparison
- **User Reviews**: User-generated content, ratings, comments
- **Reservation System**: Booking or reservation functionality
- **Social Features**: User profiles, following, social feed
- **Admin/Edit Interface**: CMS for editing restaurant data
- **Analytics Events**: Tracking/logging of user interactions
- **Internationalization**: English translation toggle (Hebrew only for now)
- **Offline Support**: PWA, offline caching, service workers
- **Push Notifications**: Alerts for new restaurants, price drops, etc.
- **Related Restaurants**: "You might also like" recommendations algorithm

---

## Implementation Notes

### Suggested Component Structure

```
web/src/components/restaurant/
├── RestaurantCard.tsx           # Feed card component
├── RestaurantCardSkeleton.tsx   # Loading skeleton
├── RestaurantDetail.tsx         # Main detail page wrapper
├── RestaurantHero.tsx           # Hero section
├── QuickActionsBar.tsx          # Action buttons
├── HostOpinionSection.tsx       # Host quote/opinion
├── YouTubeEpisodeSection.tsx    # Video + timestamps
├── MenuItemsList.tsx            # Menu display
├── BusinessHours.tsx            # Hours table
├── PhotoGallery.tsx             # Image gallery with lightbox
└── RestaurantLocationMap.tsx    # Embedded mini map
```

### API Endpoint Requirements

**Existing endpoints to use:**
- `GET /api/restaurants/:id` - Fetch full restaurant data
- `GET /api/restaurants` - Fetch list for feed

**May need to add:**
- `GET /api/restaurants/:id/episodes` - All episodes featuring this restaurant
- `POST /api/restaurants/:id/favorite` - Toggle favorite status

### Testing Requirements
- Unit tests for each component with Jest + React Testing Library
- Test all edge cases (missing data scenarios)
- Snapshot tests for layout consistency
- Visual regression tests for RTL layout
- Accessibility tests with jest-axe
- Performance tests (bundle size, render time)

---

## Questions for Discussion

1. **Image Strategy**: Should we implement progressive image loading (LQIP) or use a consistent placeholder? Should we generate blurred placeholders at build time?

2. **Quote Attribution**: Should we show podcast/host name with the quote on the card, or save it for the detail page?

3. **Closed Restaurants**: Should we hide closed restaurants from feed entirely, show them with reduced prominence, or let users filter?

4. **Multiple Episodes**: If restaurant appears in 5+ episodes, how should we prioritize which episode to show first (most recent, highest rating, most engaging)?

5. **Menu Data**: Menu items often incomplete/outdated. Should we show partial menu or hide entirely until validated?

6. **Price Data Conflict**: If `price_range` (from AI) conflicts with `price_level` (from Google), which takes precedence?

7. **Photo Copyright**: Restaurant photos from Google Places have attribution requirements. How do we handle attribution in the gallery?

8. **Offline Behavior**: Should favorited restaurants be cached for offline viewing?

---

**Dependencies:**
- Requires Google Places API for business hours and photos
- Requires YouTube Data API for video thumbnails
- Requires restaurant data enrichment pipeline to be complete

# Mobile UI Implementation Plan

**Date**: 2026-01-25
**Status**: Completed

## Overview

This plan outlines the implementation of responsive mobile UI for Where2Eat while maintaining full desktop support.

## Architecture Decision

**Approach**: Progressive Enhancement with Responsive Design
- Mobile-first CSS with Tailwind breakpoints
- Shared components with responsive variants where possible
- Separate mobile-specific components only when UX differs significantly
- Desktop sidebar hidden on mobile, replaced with bottom navigation

## Implementation Checklist

### Phase 1: Navigation (Critical)

- [x] **1.1 Create MobileBottomNav component**
  - File: `web/src/components/mobile/mobile-bottom-nav.tsx`
  - 5-tab bottom navigation (Overview, Search, Map, Favorites, Trends)
  - Touch-friendly 56px touch targets
  - Safe area inset support for notched devices
  - Hidden on desktop (md:hidden)

- [x] **1.2 Update SideNav for responsive behavior**
  - Add `hidden md:flex` to hide on mobile
  - Keep existing desktop functionality

- [x] **1.3 Update layout.tsx**
  - Add MobileBottomNav component
  - Add `pb-20 md:pb-0` to main content for bottom nav clearance
  - Conditional rendering based on viewport

### Phase 2: Mobile Components

- [x] **2.1 Create MobileRestaurantCard**
  - File: `web/src/components/mobile/mobile-restaurant-card.tsx`
  - Larger touch targets (44px+ for all interactive elements)
  - Simplified layout for small screens
  - Direct action buttons (directions, call)
  - Swipe-friendly design

- [x] **2.2 Create MobileFilterSheet**
  - File: `web/src/components/mobile/mobile-filter-sheet.tsx`
  - Bottom sheet modal for filters
  - Large, touch-friendly filter buttons
  - Quick filter chips
  - Clear visual feedback for active filters

### Phase 3: CSS & Utilities

- [x] **3.1 Add mobile utilities to globals.css**
  - Safe area inset utilities (.pb-safe, .pt-safe)
  - Touch target utilities (.touch-target, .touch-target-lg)
  - Bottom nav clearance (.pb-nav)
  - Hide scrollbar utility (.scrollbar-hide)
  - Mobile slide-up animation

### Phase 4: Integration

- [x] **4.1 Update translations**
  - Add mobile-specific translation keys
  - Add navigation labels

- [ ] **4.2 Update master-dashboard.tsx**
  - Use MobileRestaurantCard on mobile
  - Use MobileFilterSheet on mobile
  - Responsive grid/list layouts

### Phase 5: Testing

- [ ] **5.1 Device Testing**
  - iPhone SE (375px)
  - iPhone 14 (390px)
  - Android (360px)
  - Tablet (768px)
  - Desktop (1280px+)

## File Structure

```
web/src/components/
├── mobile/
│   ├── mobile-bottom-nav.tsx     # Bottom tab navigation
│   ├── mobile-restaurant-card.tsx # Touch-optimized card
│   └── mobile-filter-sheet.tsx   # Filter bottom sheet
├── side-nav.tsx                  # Desktop sidebar (updated)
└── restaurant-card.tsx           # Desktop card (unchanged)
```

## Responsive Breakpoints Used

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Default | 0-639px | Mobile styles |
| sm | 640px+ | Small tablets |
| md | 768px+ | Tablets, show desktop UI |
| lg | 1024px+ | Desktop |
| xl | 1280px+ | Large desktop |

## Key Design Decisions

1. **Bottom Navigation on Mobile**: Thumb-zone accessible, standard mobile pattern
2. **Sidebar on Desktop**: Keep existing desktop experience
3. **Card Variations**: Mobile card is simplified, desktop card has full details
4. **Filter Sheet on Mobile**: Full-screen bottom sheet vs inline filters on desktop
5. **Touch Targets**: Minimum 44x44px on mobile, 48x48px for primary actions

## Success Criteria

- [ ] Mobile Lighthouse score > 90
- [ ] All touch targets >= 44px
- [ ] No horizontal scroll on mobile
- [ ] Desktop functionality unchanged
- [ ] RTL support maintained
- [ ] Reduced motion preferences respected

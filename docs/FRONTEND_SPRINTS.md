# Where2Eat Frontend Development Sprints

## Overview

This document organizes the UI redesign into actionable sprints. Each sprint is designed to be completed independently while building toward the complete redesign.

**Total Sprints:** 6
**Sprint Length:** Flexible (based on team capacity)
**Goal:** Transform Where2Eat into a world-class restaurant discovery platform

---

## Sprint 0: Setup & Foundation
**Theme:** Prepare the development environment

### Tasks

| # | Task | Assignee | Status |
|---|------|----------|--------|
| 0.1 | Review `WEBSITE_DESIGN_PLAN.md` and `FRONTEND_IMPLEMENTATION_GUIDE.md` | Team | ⬜ |
| 0.2 | Set up feature branch for redesign | Lead | ⬜ |
| 0.3 | Install any missing dependencies (framer-motion if needed) | Dev | ⬜ |
| 0.4 | Create component storybook or testing page | Dev | ⬜ |
| 0.5 | Set up visual regression testing (optional) | QA | ⬜ |

### Acceptance Criteria
- [ ] All team members have reviewed design docs
- [ ] Feature branch created and pushed
- [ ] Dev environment working for all team members
- [ ] Testing strategy defined

### Deliverables
- Feature branch: `feature/ui-redesign`
- Updated `package.json` if dependencies added

---

## Sprint 1: Design System & Theme
**Theme:** Build the visual foundation

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 1.1 | Update Tailwind config with custom animations | `tailwind.config.ts` | High |
| 1.2 | Add new utility classes to globals.css | `globals.css` | High |
| 1.3 | Create `Skeleton` component | `components/ui/skeleton.tsx` | High |
| 1.4 | Create `SentimentBadge` component | `components/sentiment-badge.tsx` | Medium |
| 1.5 | Test dark mode with new colors | All | Medium |
| 1.6 | Verify RTL layout with new styles | All | Medium |

### Code Snippets

**1.1 - Tailwind Config Updates:**
```typescript
// Add to tailwind.config.ts
animation: {
  'heart-pop': 'heartPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  'slide-up': 'slideUp 0.3s ease-out',
  'fade-in': 'fadeIn 0.2s ease-out',
  'shimmer': 'shimmer 2s linear infinite',
}
```

**1.2 - New Utility Classes:**
```css
/* Add to globals.css */
.card-interactive { /* hover effects */ }
.sentiment-positive { /* green badge */ }
.sentiment-negative { /* red badge */ }
.filter-chip { /* horizontal filter pills */ }
.skeleton-shimmer { /* loading animation */ }
```

### Acceptance Criteria
- [ ] All animations defined and working
- [ ] Skeleton component renders shimmer effect
- [ ] SentimentBadge shows 4 states correctly
- [ ] Dark mode tested and approved
- [ ] RTL layout verified in Hebrew

### Deliverables
- Updated `tailwind.config.ts`
- Updated `globals.css`
- New `components/ui/skeleton.tsx`
- New `components/sentiment-badge.tsx`

### Testing
```bash
npm run dev
# Navigate to test page and verify:
# 1. Animations are smooth (60fps)
# 2. Dark mode toggle works
# 3. RTL text alignment correct
```

---

## Sprint 2: Restaurant Card Redesign
**Theme:** The core user experience

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 2.1 | Redesign card layout with hero image area | `restaurant-card.tsx` | High |
| 2.2 | Implement price indicator component | `restaurant-card.tsx` | High |
| 2.3 | Add favorite button with heart animation | `restaurant-card.tsx` | High |
| 2.4 | Create expandable content section | `restaurant-card.tsx` | High |
| 2.5 | Add skeleton loading state for cards | `restaurant-card.tsx` | Medium |
| 2.6 | Create `ImageWithFallback` component | `components/image-with-fallback.tsx` | Medium |
| 2.7 | Style action buttons (Watch, Map, Google) | `restaurant-card.tsx` | Medium |

### Card Component Structure
```
┌─────────────────────────────────┐
│ [Hero Image / Gradient]         │  ← 40% height
│ [Favorite ♥]        [Status]    │
│ [Restaurant Name - bottom]      │
├─────────────────────────────────┤
│ [Cuisine] [Location] [Price ₪₪] │  ← Meta row
│ [Sentiment Badge 👍]  [Expand ▼]│
│ "Host comment preview..."       │
├─────────────────────────────────┤ ← Expanded only
│ [Full comment blockquote]       │
│ [Address details]               │
│ [Menu items grid]               │
│ [Special features badges]       │
│ [Contact info row]              │
│ [Action buttons]                │
└─────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Card displays hero image area with gradient overlay
- [ ] Favorite heart animates on click (pop effect)
- [ ] Price shows ₪ symbols with active/inactive states
- [ ] Sentiment badge uses correct colors
- [ ] Card expands/collapses smoothly
- [ ] Fallback gradient shows when no image
- [ ] Action buttons work (Watch, Map, Google)
- [ ] Card has hover lift effect

### Deliverables
- Redesigned `components/restaurant-card.tsx`
- New `components/image-with-fallback.tsx`
- Card skeleton in `components/ui/skeleton.tsx`

### Testing
```bash
# Test scenarios:
# 1. Card with all data fields
# 2. Card with minimal data (no image, no menu)
# 3. Card with closed restaurant status
# 4. Favorite toggle (add/remove)
# 5. Mobile responsiveness
```

---

## Sprint 3: Search & Filter Experience
**Theme:** Help users find restaurants fast

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 3.1 | Create `FilterChips` component | `components/filter-chips.tsx` | High |
| 3.2 | Redesign search bar with new styling | `unified-search.tsx` | High |
| 3.3 | Add horizontal scroll for filter chips | `filter-chips.tsx` | High |
| 3.4 | Add "Clear All" filter button | `filter-chips.tsx` | Medium |
| 3.5 | Add filter count badges | `filter-chips.tsx` | Medium |
| 3.6 | Add search suggestions dropdown | `unified-search.tsx` | Low |
| 3.7 | Add recent searches display | `unified-search.tsx` | Low |

### Filter Chip Categories
```typescript
const CUISINE_FILTERS = [
  { id: 'italian', label: 'איטלקי', icon: '🍕' },
  { id: 'asian', label: 'אסייאתי', icon: '🍜' },
  { id: 'israeli', label: 'ישראלי', icon: '🥙' },
  // ...
]

const OPINION_FILTERS = [
  { id: 'positive', label: 'מומלץ', icon: '👍' },
  { id: 'mixed', label: 'מעורב', icon: '🤔' },
  { id: 'negative', label: 'לא מומלץ', icon: '👎' },
]

const PRICE_FILTERS = [
  { id: 'budget', label: '₪', count: 45 },
  { id: 'mid', label: '₪₪', count: 120 },
  { id: 'expensive', label: '₪₪₪', count: 30 },
]
```

### Search Bar Layout
```
┌─────────────────────────────────────────┐
│ 🔍  חיפוש מסעדות, מטבחים, מיקומים...    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ [×נקה] [👍מומלץ] [🍕איטלקי] [📍ת"א] >>> │ ← scrollable
└─────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Filter chips scroll horizontally on mobile
- [ ] Active filters show highlighted state
- [ ] Clear button removes all filters
- [ ] Filter counts update dynamically
- [ ] Search input has focus styling
- [ ] Chips have click feedback animation

### Deliverables
- New `components/filter-chips.tsx`
- Updated `components/unified-search.tsx`

### Testing
```bash
# Test scenarios:
# 1. Select multiple filters
# 2. Clear all filters
# 3. Scroll chips on mobile (< 768px)
# 4. Filter combination updates results
# 5. Keyboard navigation of filters
```

---

## Sprint 4: Navigation & Layout
**Theme:** Improve site-wide navigation

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 4.1 | Create sticky header with blur effect | `master-dashboard.tsx` | High |
| 4.2 | Update tab navigation styling | `master-dashboard.tsx` | High |
| 4.3 | Add mobile bottom navigation | `components/bottom-nav.tsx` | High |
| 4.4 | Add favorites badge counter | `master-dashboard.tsx` | Medium |
| 4.5 | Improve tab transition animations | `master-dashboard.tsx` | Medium |
| 4.6 | Add breadcrumb for nested views | `components/breadcrumb.tsx` | Low |

### Bottom Navigation Layout (Mobile)
```
┌─────────────────────────────────────────┐
│ [🏠]      [🔍]      [🗺️]     [❤️ 3]    │
│ סקירה    חיפוש     מפה     מועדפים    │
└─────────────────────────────────────────┘
```

### Header Layout
```
┌─────────────────────────────────────────────────┐
│ 🍽️ Where2Eat    [Search...]      [❤️ Favorites] │
├─────────────────────────────────────────────────┤
│ [סקירה] [חיפוש] [מפה] [ציר זמן] [אנליטיקה]      │
│    ▔▔▔▔▔                                        │ ← active underline
└─────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [ ] Header sticks on scroll with backdrop blur
- [ ] Active tab has colored underline indicator
- [ ] Bottom nav shows on mobile, hides on desktop
- [ ] Favorites counter updates in real-time
- [ ] Tab switch has fade transition

### Deliverables
- Updated `components/master-dashboard.tsx`
- New `components/bottom-nav.tsx`
- Optional: `components/breadcrumb.tsx`

### Testing
```bash
# Test scenarios:
# 1. Scroll page - header stays sticky
# 2. Switch tabs - transitions are smooth
# 3. Mobile view shows bottom nav
# 4. Add favorite - counter increments
# 5. Deep link to specific tab works
```

---

## Sprint 5: Analytics & Data Viz
**Theme:** Make data beautiful

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 5.1 | Create `StatsCard` component | `components/stats-card.tsx` | High |
| 5.2 | Redesign analytics dashboard layout | `trending-analytics.tsx` | High |
| 5.3 | Add chart color consistency | `trending-analytics.tsx` | Medium |
| 5.4 | Add animated number counters | `stats-card.tsx` | Medium |
| 5.5 | Improve chart tooltips | `trending-analytics.tsx` | Low |
| 5.6 | Add export functionality icon | `trending-analytics.tsx` | Low |

### Stats Card Usage
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <StatsCard
    title="סה״כ מסעדות"
    value={195}
    icon={Utensils}
    trend={{ value: 12, isPositive: true }}
  />
  <StatsCard
    title="מומלצות"
    value={127}
    subtitle="65% מהמסעדות"
    icon={ThumbsUp}
  />
  // ...
</div>
```

### Analytics Layout
```
┌───────────────────────────────────────────────┐
│ [📊 Overview Stats - 4 cards in row]          │
├──────────────────────┬────────────────────────┤
│ [Top Cuisines Chart] │ [Locations Chart]      │
├──────────────────────┼────────────────────────┤
│ [Opinion Distribution] [Timeline Chart]       │
└──────────────────────┴────────────────────────┘
```

### Acceptance Criteria
- [ ] Stats cards display with icons and trends
- [ ] Charts use consistent color palette
- [ ] Charts are responsive
- [ ] Numbers animate on load
- [ ] Tooltips show on hover

### Deliverables
- New `components/stats-card.tsx`
- Updated `components/trending-analytics.tsx`

---

## Sprint 6: Polish & Performance
**Theme:** Final touches and optimization

### Tasks

| # | Task | File(s) | Priority |
|---|------|---------|----------|
| 6.1 | Add page transition animations | Layout files | Medium |
| 6.2 | Optimize image loading (lazy load) | All image uses | High |
| 6.3 | Add error boundary components | `components/error-boundary.tsx` | High |
| 6.4 | Add empty state designs | Various | Medium |
| 6.5 | Performance audit (Lighthouse) | - | High |
| 6.6 | Accessibility audit (axe) | - | High |
| 6.7 | Cross-browser testing | - | High |
| 6.8 | Mobile device testing | - | High |

### Empty State Examples
```tsx
// No search results
<EmptyState
  icon={SearchX}
  title="לא נמצאו תוצאות"
  description="נסה לחפש עם מילות מפתח אחרות"
  action={<Button onClick={clearFilters}>נקה חיפוש</Button>}
/>

// No favorites
<EmptyState
  icon={Heart}
  title="אין מועדפים"
  description="לחץ על הלב כדי לשמור מסעדות"
/>
```

### Performance Targets
| Metric | Target | How to Measure |
|--------|--------|----------------|
| Lighthouse Performance | > 90 | Chrome DevTools |
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 3s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Accessibility Score | > 95 | axe DevTools |

### Acceptance Criteria
- [ ] Lighthouse score > 90
- [ ] No accessibility errors (axe)
- [ ] Works on Chrome, Safari, Firefox
- [ ] Works on iOS Safari, Android Chrome
- [ ] All empty states designed
- [ ] Error states handle API failures

### Deliverables
- Performance report
- Accessibility report
- Cross-browser test results
- New `components/empty-state.tsx`
- New `components/error-boundary.tsx`

---

## Sprint Summary

| Sprint | Theme | Key Deliverables | Dependencies |
|--------|-------|------------------|--------------|
| 0 | Setup | Branch, environment | None |
| 1 | Foundation | Theme, Skeleton, SentimentBadge | Sprint 0 |
| 2 | Cards | RestaurantCard redesign | Sprint 1 |
| 3 | Search | FilterChips, Search bar | Sprint 1 |
| 4 | Navigation | Header, Bottom nav | Sprint 1 |
| 5 | Analytics | StatsCard, Charts | Sprint 1 |
| 6 | Polish | Performance, A11y | All |

### Recommended Sprint Order
```
Sprint 0 → Sprint 1 → Sprint 2 ─┬─→ Sprint 6
                                │
                      Sprint 3 ─┤
                                │
                      Sprint 4 ─┤
                                │
                      Sprint 5 ─┘
```

Sprints 2-5 can run in parallel after Sprint 1 is complete.

---

## Definition of Done

A sprint is complete when:

1. ✅ All tasks marked complete
2. ✅ Code reviewed and merged
3. ✅ No TypeScript errors
4. ✅ No console errors
5. ✅ Responsive design verified (mobile + desktop)
6. ✅ RTL layout verified
7. ✅ Dark mode verified
8. ✅ Basic accessibility checked
9. ✅ Demo to stakeholders

---

## Resource Links

- Design Plan: `docs/WEBSITE_DESIGN_PLAN.md`
- Implementation Guide: `docs/FRONTEND_IMPLEMENTATION_GUIDE.md`
- Tailwind Docs: https://tailwindcss.com/docs
- Radix UI: https://www.radix-ui.com/primitives
- Lucide Icons: https://lucide.dev/icons

---

## Notes for Team

1. **Start small** - Get Sprint 1 right before moving on
2. **Mobile first** - Always test on mobile during development
3. **Commit often** - Small, focused commits are easier to review
4. **Ask questions** - If a design decision is unclear, ask before implementing
5. **Document changes** - Update this file as you complete tasks

---

*Last updated: January 2026*

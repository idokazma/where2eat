# Where2Eat Frontend Redesign v2

## Design Specification Document

**Version:** 2.0
**Date:** January 2026
**Status:** Planning

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Design Principles](#2-design-principles)
3. [Typography System](#3-typography-system)
4. [Color System](#4-color-system)
5. [Spacing & Layout](#5-spacing--layout)
6. [Navigation Architecture](#6-navigation-architecture)
7. [Component Library](#7-component-library)
8. [Location UX System](#8-location-ux-system)
9. [Screen Specifications](#9-screen-specifications)
10. [Animation & Motion](#10-animation--motion)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Vision & Goals

### The Vision

**"Eater meets TikTok for Israeli food culture"**

A mobile-first, feed-driven discovery experience with bold editorial typography, urban energy, and podcast-centric content. Every interaction feels like scrolling through a curated food magazine that knows what's hot right now.

### Core Identity

| Attribute | Definition |
|-----------|------------|
| **Positioning** | "Food discovery as entertainment" — playful, visual, social-media-like browsing |
| **Aesthetic** | Editorial/Magazine — bold typography, asymmetric layouts, like Eater |
| **Voice** | Bold, urban, opinionated |
| **Language** | Hebrew-first |

### Target Audience (Priority Order)

1. **Primary:** Food enthusiasts who follow specific podcasts/hosts
2. **Secondary:** Casual browsers looking for "where to eat tonight"

### Key Problems to Solve

| Current State | Target State |
|---------------|--------------|
| Looks like shadcn starter project | Feels designed and intentional |
| Desktop sidebar on mobile | Mobile-first bottom navigation |
| Lots of unnecessary text | Visual hierarchy speaks |
| Episode info hidden | Episode prominently featured |
| Search-first | Discovery/trending-first |
| Generic component feel | Bold editorial character |

---

## 2. Design Principles

### 2.1 Mobile-First

Every design decision starts with the 375px viewport. Desktop is an enhancement, not the base.

```
Mobile (375px) → Tablet (768px) → Desktop (1280px+)
```

### 2.2 Content Density

**Less text, more visual hierarchy.**

- Use typography scale to convey importance
- Icons and badges over labels where possible
- Progressive disclosure — details on demand

### 2.3 Thumb-Friendly

Bottom 60% of screen is the "thumb zone" — primary actions live here.

```
┌─────────────────────┐
│                     │  ← Secondary actions
│   Content Area      │
│                     │
├─────────────────────┤
│   Thumb Zone        │  ← Primary interactions
│   [Bottom Nav]      │
└─────────────────────┘
```

### 2.4 Episode-Centric

Every restaurant connects to its source. The podcast episode is always visible and tappable.

### 2.5 Delightful Motion

Animations serve purpose: feedback, orientation, delight. Never decorative-only.

---

## 3. Typography System

### Font Stack

```css
:root {
  /* Display & Body — Bold headlines, urban character */
  --font-display: 'Heebo', sans-serif;
  --font-body: 'Heebo', sans-serif;

  /* Mono — Code, data */
  --font-mono: 'Geist Mono', monospace;
}
```

### Why Heebo?

- Native Hebrew font with excellent weight range (100-900)
- Urban, modern character without being sterile
- Strong readability at all sizes
- Better personality than Rubik/Assistant

### Type Scale

```css
:root {
  /* Display */
  --text-display-xl: 3rem;      /* 48px — Hero headlines */
  --text-display-lg: 2.25rem;   /* 36px — Section headers */
  --text-display-md: 1.75rem;   /* 28px — Card titles */

  /* Body */
  --text-body-lg: 1.125rem;     /* 18px — Lead text */
  --text-body-md: 1rem;         /* 16px — Body text */
  --text-body-sm: 0.875rem;     /* 14px — Secondary text */
  --text-body-xs: 0.75rem;      /* 12px — Captions, badges */

  /* Line Heights */
  --leading-tight: 1.1;         /* Headlines */
  --leading-snug: 1.3;          /* Subheads */
  --leading-normal: 1.5;        /* Body */
  --leading-relaxed: 1.7;       /* Long-form */
}
```

### Weight System

| Weight | Name | Usage |
|--------|------|-------|
| 900 | Black | Hero headlines, impact moments |
| 700 | Bold | Section headers, emphasis |
| 500 | Medium | Subheads, labels |
| 400 | Regular | Body text |
| 300 | Light | Large display text (subtle) |

---

## 4. Color System

### Primary Palette

```css
:root {
  /* Core Colors */
  --color-ink: #1A1A1A;           /* Primary text, headers */
  --color-ink-muted: #6B6B6B;     /* Secondary text */
  --color-ink-subtle: #9A9A9A;    /* Tertiary text */

  /* Backgrounds */
  --color-paper: #FAFAF8;         /* Page background */
  --color-surface: #F5F4F0;       /* Card backgrounds */
  --color-surface-elevated: #FFFFFF; /* Elevated cards, modals */

  /* Accent Colors */
  --color-accent: #E63B2E;        /* Primary action, Eater-red */
  --color-accent-hover: #CC3428;  /* Hover state */
  --color-accent-subtle: #FEF2F1; /* Accent backgrounds */

  /* Secondary Accent */
  --color-gold: #D4A84B;          /* Highlights, badges, premium */
  --color-gold-subtle: #FDF8EC;   /* Gold backgrounds */

  /* Semantic Colors */
  --color-positive: #1D9E6C;      /* Positive opinions, success */
  --color-positive-subtle: #E8F7F0;
  --color-negative: #D64545;      /* Negative opinions, errors */
  --color-negative-subtle: #FDEDED;
  --color-neutral: #6B6B6B;       /* Neutral states */

  /* Borders */
  --color-border: #E8E7E3;        /* Default borders */
  --color-border-strong: #D4D3CF; /* Emphasized borders */
}
```

### Dark Mode Palette

```css
[data-theme="dark"] {
  --color-ink: #F5F4F0;
  --color-ink-muted: #A0A0A0;
  --color-ink-subtle: #6B6B6B;

  --color-paper: #0D0D0D;
  --color-surface: #1A1A1A;
  --color-surface-elevated: #252525;

  --color-accent: #FF5A4D;
  --color-accent-hover: #FF7166;
  --color-accent-subtle: #2A1A18;

  --color-border: #2A2A2A;
  --color-border-strong: #3A3A3A;
}
```

### Color Usage Guidelines

| Element | Color Token |
|---------|-------------|
| Page background | `--color-paper` |
| Card background | `--color-surface` |
| Modal/sheet background | `--color-surface-elevated` |
| Primary text | `--color-ink` |
| Secondary text | `--color-ink-muted` |
| Placeholder text | `--color-ink-subtle` |
| Primary buttons | `--color-accent` |
| Episode badges | `--color-gold` |
| Positive opinion | `--color-positive` |
| Negative opinion | `--color-negative` |

---

## 5. Spacing & Layout

### Spacing Scale

```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
}
```

### Border Radius

```css
:root {
  --radius-sm: 0.375rem;   /* 6px — small chips */
  --radius-md: 0.75rem;    /* 12px — cards, buttons */
  --radius-lg: 1rem;       /* 16px — modals, sheets */
  --radius-xl: 1.5rem;     /* 24px — hero cards */
  --radius-full: 9999px;   /* Pills, avatars */
}
```

### Z-Index Scale

```css
:root {
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-toast: 700;
}
```

---

## 6. Navigation Architecture

### Mobile Navigation (Primary)

**Bottom Tab Bar** — Always visible, thumb-friendly

```
┌─────────────────────────────────────────────┐
│                                             │
│              [Content Area]                 │
│                                             │
├─────────────────────────────────────────────┤
│  🏠      🔥       🗺️       ❤️       ≡      │
│ בית   טרנדי     מפה     שמורים    עוד     │
└─────────────────────────────────────────────┘
```

#### Tab Definitions

| Tab | Icon | Label | Screen |
|-----|------|-------|--------|
| Home | Home | בית | Discovery feed |
| Trending | Flame | טרנדי | What's hot |
| Map | Map | מפה | Geographic browse |
| Saved | Heart | שמורים | Favorites |
| More | Menu | עוד | Settings, profile, admin |

#### Bottom Bar Specs

```css
.bottom-nav {
  height: 64px;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface-elevated);
  border-top: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
}

.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  min-width: 64px;
}

.bottom-nav-item.active {
  color: var(--color-accent);
}
```

### Header (Sticky)

```
┌─────────────────────────────────────────────┐
│  Where2Eat              🔍        ⚙️        │
└─────────────────────────────────────────────┘
```

### Desktop Navigation

On desktop (1024px+), show horizontal nav in header instead of bottom bar:

```
┌─────────────────────────────────────────────────────────────┐
│  Where2Eat    [בית] [טרנדי] [מפה] [שמורים]    🔍    ⚙️    │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Component Library

### 7.1 Restaurant Card

The hero component. Episode-prominent, works with or without images.

#### With Image Variant

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │        [RESTAURANT IMAGE]       │ │  16:10 aspect ratio
│ │                                 │ │
│ │  ┌──────────┐      ┌────────┐  │ │
│ │  │🎙️ פרק 234│      │ 350 מ׳ │  │ │  Badges overlay
│ │  └──────────┘      └────────┘  │ │
│ └─────────────────────────────────┘ │
│                                     │
│  חומוס הכרמל                        │  Bold headline
│  תל אביב • פלורנטין • הומוס • ₪₪    │  Meta line
│                                     │
│  "הכי טוב בעיר, חובה"              │  Host quote (optional)
│                                     │
│  ┌────────┐  ┌────────┐  ┌──────┐ │
│  │⭐ 4.6  │  │   ❤️   │  │  ▶️  │ │  Action row
│  └────────┘  └────────┘  └──────┘ │
└─────────────────────────────────────┘
```

#### Without Image Variant (Typography Card)

Uses gradient background based on cuisine type when no image available.

#### Cuisine Gradient Map

```typescript
const cuisineGradients: Record<string, string> = {
  'הומוס': 'linear-gradient(135deg, #E8D5B7 0%, #C4A77D 100%)',
  'שווארמה': 'linear-gradient(135deg, #D4956A 0%, #A66B4A 100%)',
  'אסיאתי': 'linear-gradient(135deg, #2D5A4A 0%, #1A3D32 100%)',
  'איטלקי': 'linear-gradient(135deg, #C75146 0%, #8B3A33 100%)',
  'דגים': 'linear-gradient(135deg, #4A7B9D 0%, #2D5A73 100%)',
  'בשרים': 'linear-gradient(135deg, #6B3A3A 0%, #4A2828 100%)',
  'קינוחים': 'linear-gradient(135deg, #D4A5B9 0%, #A67A8E 100%)',
  'default': 'linear-gradient(135deg, #6B6B6B 0%, #4A4A4A 100%)',
};
```

### 7.2 Episode Badge

Prominent, tappable, connects to source.

```css
.episode-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-gold);
  color: #1A1A1A;
  border-radius: var(--radius-sm);
  font-size: var(--text-body-xs);
  font-weight: 500;
}
```

### 7.3 Filter Bar

Horizontal scrollable chips.

```
┌─────────────────────────────────────────────────────────────────┐
│ [📍 קרוב אליי] [🏙️ תל אביב ▼] [🍽️ סוג ▼] [💰 מחיר ▼] [⭐ ▼]  │
└─────────────────────────────────────────────────────────────────┘
```

#### Filter Chip States

```css
/* Inactive */
.filter-chip {
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--text-body-sm);
}

/* Active */
.filter-chip.active {
  background: var(--color-ink);
  border-color: var(--color-ink);
  color: var(--color-paper);
}

/* With selection */
.filter-chip.selected {
  background: var(--color-accent-subtle);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
```

### 7.4 Bottom Sheet

For pickers, details, expanded content.

```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface-elevated);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: var(--space-4);
  padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  max-height: 85vh;
  overflow-y: auto;
  z-index: var(--z-modal);
}
```

---

## 8. Location UX System

### 8.1 Two-Mode Architecture

| Mode | Trigger | Behavior |
|------|---------|----------|
| **קרוב אליי** | Toggle chip | GPS-based, shows distance, sorts by proximity |
| **City/Neighborhood** | Cascading picker | Manual selection, filters results |

Only one mode active at a time.

### 8.2 "Near Me" Flow

```
[📍 קרוב אליי]     →    [📍 מאתר...]    →    [📍 קרוב אליי ✓]
   (inactive)            (loading)              (active)
```

**States:**
- Inactive: Outline chip
- Loading: Spinner + "מאתר מיקום..."
- Active: Filled chip with checkmark
- Error: Toast "לא ניתן לאתר מיקום"

**When Active:**
- Cards show distance badge: "350 מ׳"
- Results sorted by proximity
- Map centers on user location

### 8.3 City/Neighborhood Picker

**Bottom Sheet UI — Step 1 (Cities):**

```
┌──────────────────────────────────┐
│  ────────                        │
│                                  │
│  🏙️ בחר מיקום                    │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🔍 חפש עיר או שכונה...     │  │
│  └────────────────────────────┘  │
│                                  │
│  📍 אחרון: פלורנטין, תל אביב     │
│                                  │
│  ── ערים פופולריות ──            │
│                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ת״א   │ │ירושלים│ │חיפה  │     │
│  └──────┘ └──────┘ └──────┘     │
│                                  │
└──────────────────────────────────┘
```

**Step 2 (Neighborhoods):**

```
┌──────────────────────────────────┐
│  ← תל אביב                       │
│                                  │
│  ── שכונות ──                    │
│                                  │
│  ┌──────────┐ ┌──────────┐      │
│  │פלורנטין  │ │נווה צדק  │      │
│  └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐      │
│  │לב העיר   │ │רוטשילד   │      │
│  └──────────┘ └──────────┘      │
│                                  │
│  ┌────────────────────────────┐  │
│  │     ✓ כל תל אביב           │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

### 8.4 Location Data Structure

```typescript
interface LocationFilter {
  mode: 'nearby' | 'manual' | null;

  // For 'nearby' mode
  userCoords?: {
    lat: number;
    lng: number;
  };
  maxDistanceKm?: number;

  // For 'manual' mode
  city?: string;
  neighborhood?: string;
}
```

### 8.5 Smart Defaults

1. **First visit:** No location filter (show all)
2. **Return visit:** Restore last used location from localStorage
3. **IP-based suggestion:** Show "נראה שאתה ב..." prompt (optional enhancement)

---

## 9. Screen Specifications

### 9.1 Home Screen (בית)

The discovery feed. Trending-first, episode-prominent.

```
┌──────────────────────────────────┐
│  Where2Eat              🔍  ⚙️   │
├──────────────────────────────────┤
│  [Filter Bar - horizontal scroll]│
├──────────────────────────────────┤
│  🔥 חם השבוע            ראה הכל → │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ →  │
│  └────┘ └────┘ └────┘ └────┘    │
├──────────────────────────────────┤
│  📺 חדש מ: פודי פרק 248          │
│  ┌────────────────────────────┐  │
│  │  [Episode Hero Card]       │  │
│  │  6 מסעדות חדשות            │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  🍴 גילויים                      │
│  ┌────────────────────────────┐  │
│  │  [Restaurant Card]         │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │  [Restaurant Card]         │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  🏠    🔥    🗺️    ❤️    ≡      │
└──────────────────────────────────┘
```

### 9.2 Restaurant Detail Screen

```
┌──────────────────────────────────┐
│  ←                          ❤️   │
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │       [HERO IMAGE]         │  │
│  └────────────────────────────┘  │
│                                  │
│  חומוס הכרמל                     │
│  ⭐ 4.6 (234) • תל אביב • ₪₪    │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 🎙️ מתוך: פודי פרק 234      │  │
│  │ "הכי טוב שאכלתי השנה"      │  │
│  │ ▶️ צפה בקטע (12:34)        │  │
│  └────────────────────────────┘  │
│                                  │
│  ── מה מומלץ ──                  │
│  • חומוס מסבחה ⭐               │
│  • פול מדמס                     │
│                                  │
│  ── מאפיינים ──                  │
│  [ישיבה בחוץ] [חניה] [ויגן]     │
│                                  │
│  ── פרטי התקשרות ──              │
│  📍 רח׳ הכרמל 45, תל אביב       │
│  📞 03-123-4567                  │
│                                  │
│  ┌────────────────────────────┐  │
│  │      🗺️ נווט למסעדה        │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

### 9.3 Map Screen (מפה)

```
┌──────────────────────────────────┐
│  מפה                    [List]   │
├──────────────────────────────────┤
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │       [MAP VIEW]          │  │
│  │        📍 📍               │  │
│  │     📍    📍 📍            │  │
│  │                            │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  ────────  (drag up to expand)   │
│  12 מסעדות באזור                 │
│  ┌────────────────────────────┐  │
│  │  [Compact Card]            │  │
│  └────────────────────────────┘  │
├──────────────────────────────────┤
│  🏠    🔥    🗺️    ❤️    ≡      │
└──────────────────────────────────┘
```

---

## 10. Animation & Motion

### Timing Functions

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Animation Catalog

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Card entry | Fade up (0, 20px → 0, 0) | 300ms | ease-out |
| Card tap | Scale (1 → 0.98 → 1) | 100ms | ease-in-out |
| Bottom sheet open | Slide up + backdrop fade | 300ms | spring |
| Tab switch | Crossfade | 150ms | ease-in-out |
| Filter chip toggle | Background + color | 150ms | ease-in-out |
| Save heart | Scale pop + particle | 400ms | spring |

### Stagger Pattern

```css
.card-list > * {
  animation: fadeUp 300ms var(--ease-out) backwards;
}

.card-list > *:nth-child(1) { animation-delay: 0ms; }
.card-list > *:nth-child(2) { animation-delay: 50ms; }
.card-list > *:nth-child(3) { animation-delay: 100ms; }

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Implementation Plan

### Phase 1: Foundation

| Task | Files |
|------|-------|
| Typography system | `globals.css`, font loading |
| Color tokens | `globals.css` |
| Spacing scale | `globals.css` |
| Base layout components | `Container`, `Stack`, `Grid` |
| Bottom navigation | `BottomNav.tsx` |
| Header | `Header.tsx` |

### Phase 2: Core Components

| Task | Files |
|------|-------|
| Restaurant card (with image) | `RestaurantCard.tsx` |
| Restaurant card (typography) | `RestaurantCard.tsx` |
| Episode badge | `EpisodeBadge.tsx` |
| Filter chip | `FilterChip.tsx` |
| Filter bar | `FilterBar.tsx` |
| Bottom sheet base | `BottomSheet.tsx` |

### Phase 3: Location System

| Task | Files |
|------|-------|
| Location filter state | `useLocationFilter.ts` |
| "Near Me" toggle | `NearMeToggle.tsx` |
| City picker sheet | `CityPicker.tsx` |
| Neighborhood picker | `NeighborhoodPicker.tsx` |
| Distance badges | `DistanceBadge.tsx` |
| Geolocation hook | `useGeolocation.ts` |

### Phase 4: Screens

| Task | Files |
|------|-------|
| Home feed | `app/page.tsx` |
| Trending section | `TrendingSection.tsx` |
| Latest episode section | `LatestEpisode.tsx` |
| Restaurant detail | `app/restaurant/[id]/page.tsx` |
| Saved screen | `app/saved/page.tsx` |
| Map screen | `app/map/page.tsx` |

### Phase 5: Polish

| Task | Files |
|------|-------|
| Entry animations | Various |
| Loading states | Skeleton components |
| Empty states | Various |
| Error states | Various |
| Dark mode | Theme system |
| Accessibility audit | All components |

### File Structure

```
web/src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   ├── restaurant/[id]/page.tsx
│   ├── saved/page.tsx
│   ├── map/page.tsx
│   └── trending/page.tsx
├── components/
│   ├── ui/
│   ├── layout/
│   ├── restaurant/
│   ├── filters/
│   ├── feed/
│   └── map/
├── hooks/
│   ├── useLocationFilter.ts
│   ├── useGeolocation.ts
│   ├── useRestaurants.ts
│   └── useFavorites.ts
├── lib/
├── styles/
│   └── globals.css
└── types/
```

---

## Component Checklist

### Must Have (P0)
- [ ] BottomNav
- [ ] Header
- [ ] RestaurantCard
- [ ] EpisodeBadge
- [ ] FilterBar
- [ ] FilterChip
- [ ] BottomSheet
- [ ] LocationFilter
- [ ] Home feed layout
- [ ] Restaurant detail page

### Should Have (P1)
- [ ] TrendingSection
- [ ] LatestEpisode
- [ ] SavedScreen
- [ ] Loading skeletons
- [ ] Empty states
- [ ] Entry animations

### Nice to Have (P2)
- [ ] Dark mode
- [ ] Map screen
- [ ] Share functionality
- [ ] Search with autocomplete

---

*Document version 2.0 — January 2026*

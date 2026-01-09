# Sprint 1: Foundation & Layout System
**Design Upgrade: Visual-First Immersive Discovery**

## Overview
Establish the foundational architecture for the visual-first design system, focusing on layout, image optimization, and core UI components.

## Goals
- ✅ Set up masonry grid layout system
- ✅ Implement image optimization infrastructure
- ✅ Install and configure new dependencies
- ✅ Create image-first card components
- ✅ Update color system and typography
- ✅ Establish new spacing and sizing standards

## Dependencies to Install
```bash
cd web
npm install --save react-masonry-css
npm install --save react-intersection-observer
npm install --save clsx
npm install --save @tabler/icons-react  # Additional icons for visual richness
```

## Technical Tasks

### 1. Update Design System (`web/src/app/globals.css`)
- [ ] Refine color palette for visual-first approach
  - Vibrant gradient overlays
  - Image-friendly neutrals
  - High-contrast text on images
- [ ] Enhance typography for larger imagery
  - Bolder headlines (700-900 weights)
  - Better text shadows for image overlays
  - Responsive font scaling
- [ ] Add new utility classes
  - `.masonry-grid` - Grid container
  - `.masonry-item` - Individual items
  - `.image-overlay` - Gradient overlays
  - `.aspect-*` - Aspect ratio utilities

### 2. Create Image Component (`web/src/components/optimized-image.tsx`)
- [ ] Wrapper around next/image
- [ ] Blur placeholder support
- [ ] Lazy loading with intersection observer
- [ ] Error fallback images
- [ ] Shimmer loading effect

### 3. Create New Card Component (`web/src/components/visual-restaurant-card.tsx`)
- [ ] Large hero image (70% of card space)
- [ ] Gradient overlay for text readability
- [ ] Floating badge indicators
- [ ] Image-first information hierarchy
- [ ] Hover state with scale transform
- [ ] Support for varying aspect ratios (1:1, 4:3, 16:9)

### 4. Implement Masonry Layout (`web/src/components/masonry-restaurant-grid.tsx`)
- [ ] Responsive column counts (1/2/3/4 based on viewport)
- [ ] Gap system (16-24px)
- [ ] Smooth transitions on resize
- [ ] Integration with existing restaurant data
- [ ] Loading state with skeleton cards

### 5. Create Bento Box Homepage Hero (`web/src/components/bento-hero.tsx`)
- [ ] Asymmetric grid layout (Apple-style)
- [ ] Featured restaurants in varying sizes
- [ ] Stats overlay on images
- [ ] Animated entrance

### 6. Update Master Dashboard Layout
- [ ] Replace standard grid with masonry layout option
- [ ] Add layout toggle (Grid/Masonry/List)
- [ ] Preserve existing functionality
- [ ] Smooth transition between layouts

### 7. Image Infrastructure
- [ ] Create placeholder image generator utility
- [ ] Add blur-hash generation for restaurant images
- [ ] Set up default fallback images by cuisine type
- [ ] Optimize next.config.js for image domains

## Design Specifications

### Color System Updates
```css
/* Visual-First Palette */
--visual-primary: oklch(0.65 0.25 25);        /* Warm Coral-Red */
--visual-secondary: oklch(0.7 0.2 75);       /* Golden Yellow */
--visual-accent: oklch(0.6 0.15 145);        /* Fresh Green */
--visual-dark: oklch(0.2 0.05 265);          /* Deep Blue-Black */

/* Image Overlays */
--overlay-dark: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
--overlay-warm: linear-gradient(135deg, rgba(249,112,102,0.6), rgba(251,191,36,0.4));
--overlay-cool: linear-gradient(135deg, rgba(59,130,246,0.5), rgba(99,102,241,0.4));
```

### Typography Scale
```css
/* Headlines on Images */
.image-headline {
  font-size: clamp(1.5rem, 4vw, 2.5rem);
  font-weight: 800;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
  letter-spacing: -0.02em;
}

/* Card Titles */
.card-title {
  font-size: clamp(1.25rem, 3vw, 1.75rem);
  font-weight: 700;
  line-height: 1.25;
}
```

### Spacing System
```css
/* Increased spacing for visual breathing room */
--space-card-padding: 0;               /* Images go edge-to-edge */
--space-content-padding: 1.5rem;       /* Content inside cards */
--space-grid-gap: 1.5rem;              /* Gap between cards */
--space-section-gap: 4rem;             /* Between sections */
```

### Card Sizes
```css
/* Masonry card heights (natural flow) */
.masonry-item {
  margin-bottom: 1.5rem;
}

/* Aspect ratios for variety */
.aspect-square { aspect-ratio: 1 / 1; }
.aspect-portrait { aspect-ratio: 3 / 4; }
.aspect-landscape { aspect-ratio: 4 / 3; }
.aspect-wide { aspect-ratio: 16 / 9; }
```

## File Structure Changes
```
web/src/
├── components/
│   ├── visual-restaurant-card.tsx         [NEW]
│   ├── masonry-restaurant-grid.tsx        [NEW]
│   ├── optimized-image.tsx                [NEW]
│   ├── bento-hero.tsx                     [NEW]
│   ├── layout-toggle.tsx                  [NEW]
│   └── ui/
│       └── skeleton-card.tsx              [NEW]
├── lib/
│   ├── image-utils.ts                     [NEW]
│   └── placeholder-generator.ts           [NEW]
└── app/
    └── globals.css                        [UPDATE]
```

## Testing Checklist
- [ ] Masonry grid renders correctly on mobile (1 column)
- [ ] Masonry grid renders correctly on tablet (2 columns)
- [ ] Masonry grid renders correctly on desktop (3-4 columns)
- [ ] Images load progressively with blur effect
- [ ] Fallback images display when no image available
- [ ] Text on images remains readable (contrast check)
- [ ] Layout doesn't shift during image load (CLS check)
- [ ] Cards maintain aspect ratios across viewport sizes
- [ ] Performance: Images lazy load outside viewport
- [ ] Accessibility: Alt text on all images

## Success Metrics
- First Contentful Paint (FCP) < 1.5s
- Cumulative Layout Shift (CLS) < 0.1
- Images display blur placeholder immediately
- Grid adapts smoothly on window resize
- All existing functionality preserved

## Next Sprint Preview
Sprint 2 will add:
- 3D card tilt effects on hover
- Swipeable carousels for featured collections
- Parallax scrolling effects
- Enhanced map integration
- Mobile gesture interactions

## Notes
- Prioritize mobile-first responsive behavior
- Maintain RTL support for Hebrew text
- Keep existing filter/search functionality intact
- Test with actual restaurant images from database
- Consider creating demo images if database lacks photos

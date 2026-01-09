# Sprint 2: Interactive Features & 3D Effects
**Design Upgrade: Visual-First Immersive Discovery**

## Overview
Add immersive interactions, 3D effects, and dynamic UI elements that make the discovery experience engaging and memorable.

## Goals
- ✅ Implement 3D card tilt effects
- ✅ Create swipeable carousels
- ✅ Add parallax scrolling
- ✅ Enhance map with custom styling
- ✅ Add mobile gesture interactions
- ✅ Create pull-to-refresh functionality

## Dependencies to Install
```bash
cd web
npm install --save react-parallax-tilt
npm install --save embla-carousel-react
npm install --save framer-motion
npm install --save react-spring
npm install --save @use-gesture/react
npm install --save mapbox-gl  # Optional: Better than Google Maps visually
npm install --save react-map-gl  # If using Mapbox
```

## Technical Tasks

### 1. 3D Tilt Card Effect (`web/src/components/tilt-card.tsx`)
- [ ] Wrapper component using react-parallax-tilt
- [ ] Configurable tilt angles (10-15 degrees max)
- [ ] Glare effect on hover
- [ ] Perspective depth (1000px)
- [ ] Scale on hover (1.02-1.05)
- [ ] Smooth transitions (transform-style: preserve-3d)
- [ ] Disable on mobile/touch devices (performance)

### 2. Swipeable Featured Carousel (`web/src/components/featured-carousel.tsx`)
- [ ] Use Embla Carousel for smooth performance
- [ ] Auto-play with pause on hover
- [ ] Snap scrolling with momentum
- [ ] Progress indicator dots
- [ ] Swipe gestures on mobile
- [ ] Arrow navigation on desktop
- [ ] Featured restaurants rotation
- [ ] Responsive sizing (full-width mobile, contained desktop)

### 3. Parallax Hero Section (`web/src/components/parallax-hero.tsx`)
- [ ] Multi-layer parallax (background, mid, foreground)
- [ ] Scroll-based transform
- [ ] Background image with slow scroll
- [ ] Text content with faster scroll
- [ ] Smooth performance (will-change, transform)
- [ ] Reduced motion respect (prefers-reduced-motion)
- [ ] Mobile optimization (disable on small screens)

### 4. Enhanced Map Integration
**Option A: Stick with Google Maps**
- [ ] Custom map styles (JSON theme)
- [ ] Clustered markers for better UX
- [ ] Info window redesign with images
- [ ] Smooth zoom/pan animations
- [ ] Click to focus card behavior

**Option B: Upgrade to Mapbox**
- [ ] Install Mapbox GL JS
- [ ] Create custom map style
- [ ] 3D building layer
- [ ] Custom marker designs
- [ ] Popup cards with images
- [ ] Smooth camera transitions
- [ ] Better performance than Google Maps

### 5. Mobile Gesture System (`web/src/components/gesture-wrapper.tsx`)
- [ ] Pull-to-refresh on restaurant list
- [ ] Swipe-to-dismiss on cards
- [ ] Pinch-to-zoom on images
- [ ] Long-press for quick actions
- [ ] Haptic feedback (if supported)
- [ ] Gesture conflict resolution

### 6. Animated Filter Panel (`web/src/components/animated-filters.tsx`)
- [ ] Slide-in drawer on mobile
- [ ] Spring physics animations
- [ ] Stagger animation for filter items
- [ ] Smooth height transitions
- [ ] Backdrop blur effect
- [ ] Touch-drag to close

### 7. Image Gallery Lightbox (`web/src/components/image-lightbox.tsx`)
- [ ] Full-screen image viewer
- [ ] Swipe between images
- [ ] Pinch to zoom
- [ ] Download/share options
- [ ] Close on backdrop click
- [ ] Keyboard navigation (arrows, ESC)
- [ ] Smooth open/close animations

### 8. Scroll Animations (`web/src/components/scroll-reveal.tsx`)
- [ ] Intersection Observer-based reveals
- [ ] Fade-up entrance animations
- [ ] Stagger delays for lists
- [ ] Only animate on first view (performance)
- [ ] Respect prefers-reduced-motion
- [ ] Configurable thresholds

## Animation Specifications

### 3D Tilt Settings
```typescript
const tiltOptions = {
  reverse: false,
  max: 15,                    // Max tilt angle
  perspective: 1000,          // Perspective value
  scale: 1.05,               // Scale on hover
  speed: 400,                // Transition speed
  transition: true,
  axis: null,                // Enable both axes
  reset: true,               // Reset on mouse leave
  easing: "cubic-bezier(.03,.98,.52,.99)",
  glare: true,
  "max-glare": 0.3,
};
```

### Carousel Settings
```typescript
const carouselOptions = {
  loop: true,
  duration: 40,              // Slow, smooth scrolling
  align: 'center',
  skipSnaps: false,
  containScroll: 'trimSnaps',
  dragFree: false,
};
```

### Parallax Layers
```typescript
const parallaxLayers = [
  { speed: 0.2, zIndex: 1 },   // Background (slowest)
  { speed: 0.5, zIndex: 2 },   // Mid-ground
  { speed: 1.0, zIndex: 3 },   // Foreground (normal speed)
];
```

### Spring Animations (Framer Motion)
```typescript
const springConfig = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const slideIn = {
  initial: { x: "100%", opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: "100%", opacity: 0 },
  transition: springConfig,
};
```

### Gesture Settings
```typescript
const gestureConfig = {
  drag: {
    axis: "y",
    bounds: { top: 0, bottom: 100 },
    elastic: 0.7,
  },
  swipe: {
    velocity: 0.5,
    distance: 50,
    direction: "horizontal",
  },
  pinch: {
    scaleBounds: { min: 1, max: 3 },
  },
};
```

## Component Updates

### Update Visual Restaurant Card
```typescript
// Add to web/src/components/visual-restaurant-card.tsx
- Wrap with Tilt component
- Add scale animation on hover
- Include image gallery trigger
- Add swipe-to-favorite gesture
```

### Update Masonry Grid
```typescript
// Add to web/src/components/masonry-restaurant-grid.tsx
- Wrap items with ScrollReveal
- Add stagger animations
- Pull-to-refresh integration
```

### Update Master Dashboard
```typescript
// Add to web/src/components/master-dashboard.tsx
- Add parallax hero at top
- Insert featured carousel
- Enhance tab transitions
- Add gesture support for mobile tab switching
```

## Map Styling (Google Maps Custom Theme)
```json
{
  "styles": [
    {
      "featureType": "all",
      "elementType": "geometry",
      "stylers": [{ "color": "#f5f5f5" }]
    },
    {
      "featureType": "poi.business",
      "elementType": "labels.icon",
      "stylers": [{ "color": "#F97066" }]
    },
    {
      "featureType": "water",
      "elementType": "geometry",
      "stylers": [{ "color": "#c9e9f6" }]
    }
  ]
}
```

## Performance Considerations

### Animation Performance
- Use `transform` and `opacity` only (GPU-accelerated)
- Add `will-change` for animated properties
- Remove `will-change` after animation completes
- Disable complex animations on low-end devices
- Use `requestAnimationFrame` for custom animations

### Mobile Optimizations
- Disable 3D effects on touch devices
- Reduce parallax layers on mobile
- Simplify map on smaller screens
- Lazy load gesture libraries
- Throttle scroll/resize handlers

### Accessibility
```typescript
// Respect user preferences
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// Disable animations if preferred
if (prefersReducedMotion) {
  // Show static version
}
```

## File Structure
```
web/src/
├── components/
│   ├── tilt-card.tsx                      [NEW]
│   ├── featured-carousel.tsx              [NEW]
│   ├── parallax-hero.tsx                  [NEW]
│   ├── gesture-wrapper.tsx                [NEW]
│   ├── animated-filters.tsx               [NEW]
│   ├── image-lightbox.tsx                 [NEW]
│   ├── scroll-reveal.tsx                  [NEW]
│   ├── visual-restaurant-card.tsx         [UPDATE]
│   ├── masonry-restaurant-grid.tsx        [UPDATE]
│   ├── master-dashboard.tsx               [UPDATE]
│   └── restaurant-map.tsx                 [UPDATE]
├── hooks/
│   ├── use-gesture.ts                     [NEW]
│   ├── use-parallax.ts                    [NEW]
│   └── use-reduced-motion.ts              [NEW]
└── lib/
    └── animation-config.ts                [NEW]
```

## Testing Checklist

### Desktop
- [ ] Cards tilt smoothly on mouse move
- [ ] Carousel auto-plays and pauses on hover
- [ ] Parallax scrolls at different speeds
- [ ] Arrow keys navigate carousel
- [ ] ESC closes lightbox
- [ ] Animations respect reduced motion preference

### Mobile
- [ ] 3D tilt disabled (performance)
- [ ] Carousel swipes smoothly
- [ ] Pull-to-refresh works
- [ ] Pinch-to-zoom on images
- [ ] Haptic feedback (iOS/Android)
- [ ] Filter drawer slides in/out

### Performance
- [ ] FPS stays above 55 during animations
- [ ] No janky scrolling
- [ ] Smooth transitions on mid-range devices
- [ ] Bundle size increase < 100KB
- [ ] No memory leaks on gesture handlers

### Accessibility
- [ ] Animations disabled with prefers-reduced-motion
- [ ] Keyboard navigation works
- [ ] Screen reader announces state changes
- [ ] Focus visible on interactive elements
- [ ] ARIA labels on gesture controls

## Success Metrics
- Smooth 60 FPS on desktop animations
- 30+ FPS on mobile gestures
- Bundle size increase < 100KB gzipped
- Time to Interactive (TTI) < 3.5s
- User engagement increase (time on page)

## Next Sprint Preview
Sprint 3 will add:
- Virtual scrolling for large lists
- Advanced image optimization
- Performance monitoring
- Final polish and animations
- Mobile app-like experience
- Production optimization

## Notes
- Test on actual mobile devices, not just browser DevTools
- Consider adding animation toggle in settings
- Monitor bundle size with each new dependency
- Use dynamic imports for heavy libraries
- Gather user feedback on motion intensity

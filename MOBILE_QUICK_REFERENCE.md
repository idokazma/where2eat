# Mobile UI Quick Reference Guide

**Quick reference for implementing mobile-first design patterns in Where2Eat**

---

## Touch Target Sizes

### Minimum Requirements (WCAG 2.1 Level AAA)
```tsx
// Primary actions - 44x44px minimum
<button className="min-w-[44px] min-h-[44px]">

// Large touch areas - 56x56px recommended
<button className="min-w-[56px] min-h-[56px]">

// Text links - 48px height minimum
<a className="min-h-[48px] flex items-center">
```

### Spacing Between Touch Targets
```tsx
// Minimum 8px between adjacent touch targets
<div className="flex gap-2">
  <button className="touch-target">A</button>
  <button className="touch-target">B</button>
</div>
```

---

## Thumb Zone Layout

### Visual Reference
```
┌─────────────────────────────┐
│  Hard to Reach (Secondary)  │ ← Top 1/3: Settings, Info
├─────────────────────────────┤
│  Natural Grip (Tertiary)    │ ← Middle 1/3: Content
├─────────────────────────────┤
│  Easy to Reach (Primary)    │ ← Bottom 1/3: Main Actions
└─────────────────────────────┘
```

### Implementation
```tsx
// Primary Actions - Bottom
<div className="fixed bottom-0 left-0 right-0 p-4 pb-safe">
  <Button size="lg">Primary Action</Button>
</div>

// Secondary Actions - Top
<div className="fixed top-0 left-0 right-0 p-4 pt-safe">
  <Button variant="ghost" size="icon">⚙️</Button>
</div>

// Content - Middle (scrollable)
<div className="flex-1 overflow-y-auto pb-20">
  {/* Restaurant cards */}
</div>
```

---

## Responsive Breakpoints

### Tailwind Breakpoints
```tsx
// Mobile First Approach
className="px-4 md:px-6 lg:px-8"

// Show/Hide by Screen Size
className="block md:hidden"  // Mobile only
className="hidden md:block"  // Desktop only
```

### Screen Size Reference
- **Mobile**: 375px - 428px (most phones)
- **Tablet**: 768px - 1024px (iPad)
- **Desktop**: 1280px+ (standard monitors)

---

## Navigation Patterns

### Bottom Tab Bar (Mobile Primary)
```tsx
<nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe md:hidden">
  <div className="flex h-16 items-center justify-around">
    {/* 5 items maximum for mobile */}
    <NavItem icon={Home} label="Home" />
    <NavItem icon={Search} label="Search" />
    <NavItem icon={Map} label="Map" />
    <NavItem icon={Heart} label="Favorites" />
    <NavItem icon={More} label="More" />
  </div>
</nav>
```

### Hamburger Menu (Mobile Secondary)
```tsx
<Sheet>
  <SheetTrigger>
    <Button size="icon" className="md:hidden">
      <Menu />
    </Button>
  </SheetTrigger>
  <SheetContent side="right">
    {/* Settings, About, etc. */}
  </SheetContent>
</Sheet>
```

---

## Card Interactions

### Mobile Card Pattern
```tsx
<Card
  className="active:scale-[0.98] transition-transform"
  onClick={handleTap}
>
  <CardContent className="p-4">
    {/* Header Row - Name + Actions */}
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-display text-xl flex-1">{name}</h3>
      <button className="touch-target" onClick={handleFavorite}>
        <Heart className="size-6" />
      </button>
    </div>

    {/* Content */}
    <p className="text-sm line-clamp-2">{description}</p>

    {/* Action Buttons */}
    <div className="flex gap-2 pt-3">
      <Button size="lg" className="flex-1 h-11">
        Primary Action
      </Button>
      <Button size="lg" variant="outline" className="h-11 w-11">
        <Icon />
      </Button>
    </div>
  </CardContent>
</Card>
```

### Expandable vs Modal
```tsx
// Use Modal for Mobile (Better UX)
<RestaurantDetailModal
  restaurant={selected}
  open={!!selected}
  onOpenChange={setSelected}
/>

// Use Accordion for Desktop
<Accordion type="single" collapsible>
  <AccordionItem value="details">
    <AccordionTrigger>Details</AccordionTrigger>
    <AccordionContent>{content}</AccordionContent>
  </AccordionItem>
</Accordion>
```

---

## Filter Patterns

### Mobile Filter Sheet
```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button variant="outline" size="lg">
      <Filter className="size-5 mr-2" />
      Filter
      {activeCount > 0 && <Badge>{activeCount}</Badge>}
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[85vh]">
    <ScrollArea>
      {/* Filter options */}
    </ScrollArea>
    <SheetFooter>
      <Button size="lg" className="w-full">
        Apply Filters
      </Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

### Quick Filter Chips
```tsx
<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
  <Button
    variant="outline"
    size="sm"
    className="rounded-full flex-shrink-0"
  >
    Tel Aviv
  </Button>
  <Button
    variant="outline"
    size="sm"
    className="rounded-full flex-shrink-0"
  >
    Italian
  </Button>
</div>
```

---

## Map Integration

### Mobile Map View
```tsx
<div className="relative h-[60vh]">
  {/* Map Container */}
  <div ref={mapRef} className="w-full h-full" />

  {/* Floating Controls */}
  <div className="absolute top-4 right-4 z-10">
    <Button
      size="icon"
      className="size-12 rounded-full shadow-lg touch-target"
      onClick={centerOnUser}
    >
      <Crosshair className="size-6" />
    </Button>
  </div>

  {/* Bottom Action */}
  <div className="absolute bottom-4 left-4 right-4">
    <Button size="lg" className="w-full h-14">
      Find Nearby Restaurants
    </Button>
  </div>
</div>
```

### Map vs List Toggle
```tsx
const [viewMode, setViewMode] = useState<'map' | 'list'>('map')

<Button
  size="icon"
  onClick={() => setViewMode(prev => prev === 'map' ? 'list' : 'map')}
>
  {viewMode === 'map' ? <List /> : <MapPin />}
</Button>
```

---

## Typography Scale

### Mobile-First Text Sizes
```tsx
// Headlines
<h1 className="text-2xl md:text-4xl lg:text-5xl font-display">

// Subheadings
<h2 className="text-xl md:text-2xl lg:text-3xl font-semibold">

// Body Text
<p className="text-base md:text-lg leading-relaxed">

// Captions
<span className="text-sm md:text-base text-muted-foreground">

// Fine Print
<span className="text-xs md:text-sm">
```

### Line Height & Spacing
```tsx
// Tight for headlines
<h1 className="leading-tight tracking-tight">

// Relaxed for body text
<p className="leading-relaxed">

// Comfortable spacing
<div className="space-y-4 md:space-y-6">
```

---

## Button Sizing

### Size Variants
```tsx
// Small - 36px height (use sparingly on mobile)
<Button size="sm">Small</Button>

// Default - 40px height
<Button>Default</Button>

// Large - 44px height (mobile primary)
<Button size="lg">Large</Button>

// Extra Large - 56px height (hero CTAs)
<Button className="h-14 px-8 text-lg">Extra Large</Button>
```

### Button Groups
```tsx
<div className="flex gap-2">
  <Button size="lg" className="flex-1">
    Primary
  </Button>
  <Button size="lg" variant="secondary" className="flex-1">
    Secondary
  </Button>
</div>
```

---

## Loading States

### Skeleton Screens
```tsx
<div className="space-y-4">
  {[...Array(5)].map((_, i) => (
    <div key={i} className="animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4 mb-2" />
      <div className="h-4 bg-muted rounded w-1/2" />
    </div>
  ))}
</div>
```

### Spinner
```tsx
<div className="flex items-center justify-center py-8">
  <RefreshCw className="size-8 animate-spin text-primary" />
</div>
```

---

## Gesture Support

### Swipe Actions
```tsx
import { useGesture } from '@use-gesture/react'

const bind = useGesture({
  onDrag: ({ down, movement: [mx], direction: [xDir] }) => {
    if (!down && Math.abs(mx) > 100) {
      if (xDir > 0) {
        handleSwipeRight()
      } else {
        handleSwipeLeft()
      }
    }
  }
})

<div {...bind()} style={{ touchAction: 'pan-y' }}>
  <RestaurantCard />
</div>
```

### Pull to Refresh
```tsx
// Detect pull gesture at scroll position 0
useEffect(() => {
  const handleTouchMove = (e) => {
    if (window.scrollY === 0 && pullDistance > threshold) {
      onRefresh()
    }
  }
  // ... event listeners
}, [])
```

---

## Safe Area Insets

### iOS Notch Support
```tsx
// Bottom safe area
<div className="pb-safe" style={{
  paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)'
}}>

// Top safe area
<div className="pt-safe" style={{
  paddingTop: 'env(safe-area-inset-top)'
}}>
```

### CSS Utilities
```css
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}

.pt-safe {
  padding-top: env(safe-area-inset-top);
}

.px-safe {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

---

## Performance Optimization

### Image Loading
```tsx
import Image from "next/image"

<Image
  src={imageUrl}
  alt={alt}
  width={600}
  height={400}
  sizes="(max-width: 640px) 100vw, 50vw"
  priority={isAboveFold}
  placeholder="blur"
  blurDataURL={thumbnailBase64}
/>
```

### Virtual Scrolling
```tsx
import { Virtuoso } from 'react-virtuoso'

<Virtuoso
  data={restaurants}
  itemContent={(index, restaurant) => (
    <RestaurantCard restaurant={restaurant} />
  )}
  style={{ height: '100vh' }}
  overscan={200}
/>
```

### Code Splitting
```tsx
import dynamic from 'next/dynamic'

const MobileMapView = dynamic(
  () => import('@/components/mobile-map-view'),
  {
    loading: () => <MapSkeleton />,
    ssr: false
  }
)
```

---

## Accessibility Quick Checks

### ARIA Labels
```tsx
// Buttons without visible text
<button aria-label="Add to favorites">
  <Heart />
</button>

// Interactive elements
<div
  role="button"
  tabIndex={0}
  aria-label="Restaurant card"
  onClick={handleClick}
  onKeyDown={handleKeyDown}
>
```

### Focus Management
```tsx
// Trap focus in modals
<Dialog>
  <DialogContent>
    <input ref={firstFocusableElement} />
    {/* ... */}
  </DialogContent>
</Dialog>

// Restore focus after modal closes
useEffect(() => {
  if (!isOpen && previousFocus.current) {
    previousFocus.current.focus()
  }
}, [isOpen])
```

### Screen Reader Announcements
```tsx
<div role="status" aria-live="polite" className="sr-only">
  {announcement}
</div>
```

---

## Testing Checklist

### Before Commit
- [ ] All buttons are minimum 44x44px
- [ ] Touch targets have 8px spacing
- [ ] Tested on iPhone SE (smallest screen)
- [ ] Tested on Android device
- [ ] VoiceOver/TalkBack works
- [ ] Lighthouse mobile score > 90
- [ ] No horizontal scroll on mobile

### Common Issues
```tsx
// ❌ Bad: Tiny touch target
<button className="p-1">X</button>

// ✅ Good: Proper touch target
<button className="p-3 min-w-[44px] min-h-[44px]">X</button>

// ❌ Bad: No mobile layout
<div className="flex">

// ✅ Good: Responsive layout
<div className="flex flex-col md:flex-row">

// ❌ Bad: Fixed width on mobile
<div className="w-[600px]">

// ✅ Good: Responsive width
<div className="w-full md:w-[600px]">
```

---

## Useful Tailwind Classes

### Display & Layout
```
block md:hidden        - Show on mobile only
hidden md:block        - Show on desktop only
flex-col md:flex-row   - Stack on mobile, horizontal on desktop
```

### Spacing
```
p-4 md:p-6            - Responsive padding
gap-2 md:gap-4        - Responsive gap
space-y-3 md:space-y-6 - Responsive vertical spacing
```

### Text
```
text-sm md:text-base  - Responsive font size
leading-normal md:leading-relaxed - Responsive line height
```

### Touch Interactions
```
active:scale-95       - Scale down on tap
active:bg-muted       - Background change on tap
transition-transform  - Smooth animation
```

---

## Resources

### Documentation
- [Tailwind CSS v4 Docs](https://tailwindcss.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev/)

### Design Guidelines
- [iOS HIG Touch Targets](https://developer.apple.com/design/human-interface-guidelines/touch)
- [Material Design Touch Targets](https://m3.material.io/)
- [WCAG 2.1 Mobile Guidelines](https://www.w3.org/WAI/standards-guidelines/mobile/)

### Testing Tools
- Chrome DevTools Device Mode
- BrowserStack (real device testing)
- Lighthouse (performance audits)
- axe DevTools (accessibility testing)

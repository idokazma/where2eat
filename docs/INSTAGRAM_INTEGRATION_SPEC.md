# Instagram Integration Feature Specification

## 📋 Overview

This specification outlines the integration of Instagram content into restaurant discovery cards, enabling users to view recent Instagram posts from restaurants directly within the expanded restaurant cards.

## 🎯 Objectives

1. **Visual Enhancement**: Add Instagram photos to restaurant cards for better visual appeal
2. **Social Proof**: Show real customer posts and restaurant content from Instagram
3. **Engagement**: Increase user interaction with restaurant content through social media integration
4. **Discovery**: Help users discover restaurants through authentic social media content

## 📐 Current System Analysis

### **Existing Restaurant Card Structure**
- Located in: `web/src/components/restaurant-card.tsx`
- Features collapsible cards with expanded content sections
- Currently displays Google Places photos via background images
- Has dedicated sections for menu items, podcast details, and action buttons

### **Current Data Structure**
- Restaurant data stored in: `data/restaurants/*.json`
- Contains `social_media` field in `contact_info` (currently empty)
- API endpoints available at: `api/index.js`

## 🏗️ Technical Architecture

### **Option 1: Instagram Basic Display API (Recommended)**

#### **1.1 Data Model Enhancement**

**Restaurant JSON Structure Update:**
```json
{
  "social_media": {
    "instagram": {
      "handle": "@restaurant_handle",
      "account_id": "instagram_account_id", 
      "profile_url": "https://instagram.com/restaurant_handle",
      "recent_posts": [
        {
          "id": "post_id",
          "media_type": "IMAGE|VIDEO",
          "media_url": "https://scontent.cdninstagram.com/...",
          "thumbnail_url": "https://scontent.cdninstagram.com/...",
          "permalink": "https://instagram.com/p/...",
          "caption": "Amazing seafood tonight! 🦐",
          "like_count": 245,
          "comments_count": 12,
          "timestamp": "2026-01-01T20:00:00Z"
        }
      ],
      "follower_count": 1250,
      "last_updated": "2026-01-01T21:00:00Z",
      "enrichment_status": "success|pending|failed",
      "error_message": null
    }
  }
}
```

#### **1.2 Backend Implementation**

**Instagram Service (`src/instagram_service.js`)**
```javascript
class InstagramService {
  constructor(apiKey, clientSecret) {
    this.apiKey = apiKey
    this.clientSecret = clientSecret
    this.baseUrl = 'https://graph.instagram.com'
  }

  async searchRestaurantAccount(restaurantName, location) {
    // Search strategy implementation
  }

  async getRecentPosts(accountId, limit = 6) {
    // Fetch recent posts with engagement data
  }

  async enrichRestaurantWithInstagram(restaurantData) {
    // Complete enrichment workflow
  }
}
```

**API Endpoints Extension (`api/index.js`)**
```javascript
// New Instagram-specific endpoints
app.get('/api/restaurants/:id/instagram', async (req, res) => {
  // Get Instagram data for specific restaurant
})

app.post('/api/restaurants/:id/instagram/refresh', async (req, res) => {
  // Force refresh Instagram data for restaurant
})

app.get('/api/instagram/search', async (req, res) => {
  // Search Instagram for restaurant accounts
})
```

**Enrichment Script (`scripts/enrich_instagram.js`)**
```javascript
#!/usr/bin/env node
/**
 * Instagram Enrichment Script
 * Batch process all restaurants to add Instagram data
 */
const InstagramService = require('../src/instagram_service')

async function enrichAllRestaurants() {
  // Batch process with rate limiting
  // Update restaurant JSON files
  // Generate enrichment report
}
```

#### **1.3 Frontend Implementation**

**Instagram Carousel Component (`web/src/components/instagram-carousel.tsx`)**
```tsx
interface InstagramPost {
  id: string
  media_url: string
  thumbnail_url?: string
  permalink: string
  caption: string
  like_count: number
  comments_count: number
  timestamp: string
  media_type: 'IMAGE' | 'VIDEO'
}

interface InstagramCarouselProps {
  posts: InstagramPost[]
  restaurantName: string
}

export function InstagramCarousel({ posts, restaurantName }: InstagramCarouselProps) {
  // Carousel implementation with Swiper or similar
  // Click to view full post in modal
  // Instagram attribution
}
```

**Instagram Modal Component (`web/src/components/instagram-modal.tsx`)**
```tsx
interface InstagramModalProps {
  post: InstagramPost
  isOpen: boolean
  onClose: () => void
}

export function InstagramModal({ post, isOpen, onClose }: InstagramModalProps) {
  // Full post view with engagement data
  // Link to Instagram post
  // Proper Instagram attribution
}
```

**Restaurant Card Integration**
```tsx
// Addition to RestaurantCard component
{restaurant.social_media?.instagram?.recent_posts && (
  <div className="mb-4">
    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
      <Instagram className="size-4 text-pink-500" />
      פוסטים מהאינסטגרם
    </h4>
    <InstagramCarousel 
      posts={restaurant.social_media.instagram.recent_posts}
      restaurantName={restaurant.name_english}
    />
    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
      <ExternalLink className="size-3" />
      <a 
        href={restaurant.social_media.instagram.profile_url}
        target="_blank"
        className="hover:text-pink-600"
      >
        {restaurant.social_media.instagram.handle}
      </a>
      <span>• {restaurant.social_media.instagram.follower_count} עוקבים</span>
    </div>
  </div>
)}
```

### **Option 2: Manual Instagram Integration (Quick Start)**

#### **2.1 Simplified Data Structure**
```json
{
  "social_media": {
    "instagram": {
      "handle": "@restaurant_handle",
      "profile_url": "https://instagram.com/restaurant_handle",
      "featured_posts": [
        "https://www.instagram.com/p/ABC123/",
        "https://www.instagram.com/p/DEF456/",
        "https://www.instagram.com/p/GHI789/"
      ],
      "manually_curated": true,
      "last_updated": "2026-01-01T21:00:00Z"
    }
  }
}
```

#### **2.2 Instagram Embed Component**
```tsx
interface InstagramEmbedProps {
  postUrl: string
  className?: string
}

export function InstagramEmbed({ postUrl, className }: InstagramEmbedProps) {
  useEffect(() => {
    // Load Instagram embed script
    if (window.instgrm) {
      window.instgrm.Embeds.process()
    }
  }, [postUrl])

  return (
    <div className={className}>
      <blockquote 
        className="instagram-media" 
        data-instgrm-permalink={postUrl}
        data-instgrm-version="14"
        style={{ maxWidth: '540px', width: '100%' }}
      />
    </div>
  )
}
```

## 🚀 Implementation Plan

### **Phase 1: Manual Integration (1-2 days)**

**Tasks:**
1. Research and collect Instagram handles for all 11 restaurants
2. Manually curate 2-3 featured posts per restaurant
3. Update restaurant JSON files with Instagram data
4. Implement `InstagramEmbed` component
5. Add Instagram section to `RestaurantCard` component
6. Test and style components

**Deliverables:**
- Updated restaurant JSON files with Instagram data
- Working Instagram embeds in restaurant cards
- Responsive design for mobile and desktop

### **Phase 2: Instagram Discovery Script (3-4 days)**

**Tasks:**
1. Create Instagram account discovery script
2. Implement hashtag and location-based search
3. Build manual curation interface for approving accounts
4. Create bulk update script for restaurant data
5. Add Instagram data validation

**Deliverables:**
- Automated Instagram account discovery
- Curation workflow for approving Instagram accounts
- Batch processing scripts

### **Phase 3: Full API Integration (1-2 weeks)**

**Tasks:**
1. Set up Instagram Basic Display API credentials
2. Implement OAuth flow for accessing Instagram data
3. Create `InstagramService` class
4. Build comprehensive enrichment pipeline
5. Implement `InstagramCarousel` and `InstagramModal` components
6. Add automatic refresh and caching system
7. Implement error handling and fallbacks

**Deliverables:**
- Full Instagram API integration
- Real-time Instagram content in restaurant cards
- Comprehensive error handling and fallbacks
- Performance optimization with caching

## 🎨 UI/UX Specifications

### **Visual Design**

**Instagram Section in Expanded Card:**
```
┌─────────────────────────────────────┐
│ 📸 פוסטים מהאינסטגרם              │
├─────────────────────────────────────┤
│ [IMG] [IMG] [IMG] [IMG] ⟩          │  <- Horizontal carousel
│                                     │
│ @restaurant_handle • 1.2K עוקבים   │  <- Handle and follower count
└─────────────────────────────────────┘
```

**Instagram Modal (Full Post View):**
```
┌─────────────────────────────────────┐
│              ✕ Close                │
├─────────────────────────────────────┤
│                                     │
│        [INSTAGRAM IMAGE]            │
│                                     │
├─────────────────────────────────────┤
│ Caption: "Amazing seafood tonight!" │
│ ❤️ 245 likes • 💬 12 comments      │
│                                     │
│ [View on Instagram] [Follow]        │
└─────────────────────────────────────┘
```

### **Responsive Behavior**

- **Desktop**: 4 images visible in carousel
- **Tablet**: 3 images visible
- **Mobile**: 2 images visible with swipe navigation

### **Loading States**

```tsx
{isLoadingInstagram && (
  <div className="mb-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-4 h-4 bg-gray-300 rounded animate-pulse" />
      <div className="w-32 h-4 bg-gray-300 rounded animate-pulse" />
    </div>
    <div className="flex gap-2">
      {[1,2,3,4].map(i => (
        <div key={i} className="w-20 h-20 bg-gray-300 rounded animate-pulse" />
      ))}
    </div>
  </div>
)}
```

## 🔧 Technical Requirements

### **Dependencies**

**Backend:**
```json
{
  "node-fetch": "^3.3.0",
  "instagram-basic-display": "^1.0.0",
  "rate-limiter-flexible": "^2.4.2"
}
```

**Frontend:**
```json
{
  "swiper": "^8.4.7",
  "lucide-react": "^0.263.1",
  "@headlessui/react": "^1.7.15"
}
```

### **Environment Variables**

```bash
# Instagram API Configuration
INSTAGRAM_APP_ID=your_app_id
INSTAGRAM_APP_SECRET=your_app_secret
INSTAGRAM_REDIRECT_URI=http://localhost:3000/auth/instagram
INSTAGRAM_ACCESS_TOKEN=your_access_token

# Rate Limiting
INSTAGRAM_REQUESTS_PER_HOUR=200
INSTAGRAM_CACHE_DURATION=3600000
```

### **API Rate Limits**

- **Instagram Basic Display API**: 200 requests per hour per user
- **Caching Strategy**: Cache Instagram data for 1-6 hours
- **Fallback**: Show cached data when API limit exceeded

## 🔒 Security & Privacy

### **Instagram API Compliance**

1. **Attribution Requirements**: Display "Instagram" branding
2. **User Privacy**: Only access public posts
3. **Data Retention**: Cache data for maximum 24 hours
4. **Terms Compliance**: Follow Instagram's Platform Policy

### **Error Handling**

```typescript
interface InstagramError {
  type: 'api_limit' | 'account_not_found' | 'network_error' | 'auth_error'
  message: string
  retryAfter?: number
}

const handleInstagramError = (error: InstagramError) => {
  switch (error.type) {
    case 'api_limit':
      // Show cached content, retry after rate limit reset
    case 'account_not_found':
      // Hide Instagram section gracefully
    case 'network_error':
      // Show offline message, retry automatically
  }
}
```

## 📊 Success Metrics

### **User Engagement**
- Instagram section interaction rate
- Click-through to Instagram profiles
- Time spent viewing Instagram content
- Modal open rate for full post views

### **Technical Performance**
- Instagram data enrichment success rate
- API response times
- Cache hit ratio
- Error rate monitoring

### **Content Quality**
- Instagram account discovery accuracy
- Post relevance scoring
- User feedback on Instagram content

## 🧪 Testing Strategy

### **Unit Tests**
- Instagram service API calls
- Data transformation functions
- Error handling scenarios
- Component rendering

### **Integration Tests**
- Full enrichment pipeline
- Restaurant card with Instagram data
- API endpoint responses
- Cache behavior validation

### **Manual Testing**
- Instagram embeds across devices
- Modal functionality
- Loading states
- Error scenarios

## 📝 Documentation

### **API Documentation**
- Instagram service methods
- Data structure specifications
- Error codes and handling
- Rate limiting guidelines

### **Component Documentation**
- InstagramCarousel props and usage
- InstagramModal configuration
- Integration examples
- Styling guidelines

## 🚀 Future Enhancements

### **Phase 4: Advanced Features**
- Instagram Stories integration
- Hashtag trend analysis
- User-generated content curation
- Instagram Reels support

### **Phase 5: Analytics & Insights**
- Instagram engagement analytics
- Popular post identification
- Restaurant social media performance
- Content recommendation engine

## 📋 Acceptance Criteria

### **Phase 1 (Manual Integration)**
- [ ] All 11 restaurants have Instagram handles
- [ ] 2-3 curated posts per restaurant
- [ ] Instagram embeds display correctly
- [ ] Responsive design works on all devices
- [ ] Loading states implemented
- [ ] Error handling for failed embeds

### **Phase 2 (Discovery)**
- [ ] Automated Instagram account discovery
- [ ] Manual curation workflow
- [ ] Bulk data update scripts
- [ ] Data validation and error reporting

### **Phase 3 (Full API)**
- [ ] Instagram Basic Display API integration
- [ ] Real-time post fetching
- [ ] Carousel and modal components
- [ ] Caching and rate limiting
- [ ] Comprehensive error handling
- [ ] Performance optimization

---

## 📞 Support & Resources

**Instagram Developer Resources:**
- [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api)
- [Instagram Platform Policy](https://developers.facebook.com/docs/instagram-api/overview#instagram-platform-policy)
- [Instagram Embed Code Generator](https://developers.facebook.com/docs/instagram/embedding)

**Implementation Support:**
- Technical lead: [Your name]
- Design review: [Design team]
- Security review: [Security team]
- Testing: [QA team]
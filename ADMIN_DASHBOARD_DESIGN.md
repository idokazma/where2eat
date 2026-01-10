# Where2Eat Admin Dashboard - Design Proposal

**Created:** 2026-01-10
**Status:** Design & Research Phase

---

## Executive Summary

This document outlines the architecture and implementation strategy for the Where2Eat Admin Dashboard - a comprehensive management interface for controlling restaurant data, monitoring system metrics, and publishing content.

### Key Requirements
1. **Metrics & Analytics** - Real-time system monitoring and restaurant discovery insights
2. **Card Management** - CRUD operations for restaurant cards with visual editing
3. **Content Publishing** - Article/blog CMS for food content
4. **Video Processing** - Manage YouTube analysis jobs and queue
5. **Data Quality** - Review and approve AI-extracted restaurant data

---

## Research Findings

### Modern Admin Dashboard Best Practices (2026)

**Tech Stack Trends:**
- Next.js 15+ with App Router (performance-optimized, scalable)
- React 19 with TypeScript for type safety
- Tailwind CSS V4 for utility-first styling
- shadcn/ui for accessible component primitives
- PostgreSQL/SQLite with ORM (Prisma) for data management
- NextAuth.js or Clerk for authentication
- React Query (TanStack Query) for server state management

**Design Principles:**
- **Clean, Minimalist UI** - Neutral design that's professional and brand-agnostic
- **Mobile-First Responsive** - Admin on-the-go via tablets/phones
- **Dark Mode Support** - Reduce eye strain for long sessions
- **Accessibility (WCAG 2.1)** - Keyboard navigation, screen readers, ARIA labels
- **Performance** - Code splitting, lazy loading, optimized bundles

**Key Patterns:**
- **Multi-Column Layout** - Left sidebar navigation + main content area + optional right panel
- **Dashboard-First** - Landing on overview with key metrics at a glance
- **Data Tables with Actions** - Sortable, filterable tables with inline editing
- **Modal/Drawer Editing** - Slide-out panels for forms without losing context
- **Real-time Updates** - WebSocket or polling for live metrics

### CMS Architecture Patterns

**Recommended: Decoupled/Headless Approach**
```
Admin Panel (Next.js) → Express API → Python Backend Services → SQLite DB
                              ↓
                      Public Frontend (Next.js)
```

**Benefits:**
- Frontend and backend are decoupled for independent scaling
- Admin and public site share the same API
- Content changes reflect immediately
- Flexibility to add mobile apps later

**Design Patterns:**
- **MVC (Model-View-Controller)** - Separation of concerns
- **Repository Pattern** - Abstract data access layer (already exists in `database.py`)
- **Service Layer** - Business logic isolation (already exists in `backend_service.py`)
- **Role-Based Access Control (RBAC)** - Admins vs. editors vs. viewers

### Restaurant Management Dashboard Features

**Core Metrics:**
1. **Sales/Traffic Metrics:**
   - Total restaurants in database
   - New restaurants added (daily/weekly/monthly)
   - Restaurant status distribution (open/closed/new)
   - Most popular cuisines and locations

2. **Content Performance:**
   - Video processing queue status
   - Episodes analyzed vs. pending
   - Restaurants per episode (average)
   - AI extraction accuracy metrics

3. **User Engagement (Future):**
   - Page views and favorites
   - Search patterns and trends
   - Most viewed restaurants
   - User feedback/ratings

4. **System Health:**
   - API response times
   - Database size and growth
   - Background job status
   - Error rates and logs

---

## Recommended Architecture

### 1. Structure Overview

```
where2eat/
├── web/                          # Public frontend (existing)
├── admin/                        # NEW: Admin dashboard app
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── layout.tsx    # Auth layout
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx    # Dashboard layout with sidebar
│   │   │   │   ├── page.tsx      # Overview dashboard
│   │   │   │   ├── restaurants/
│   │   │   │   │   ├── page.tsx           # Restaurant list/table
│   │   │   │   │   ├── [id]/edit/page.tsx # Edit restaurant
│   │   │   │   │   └── new/page.tsx       # Add new restaurant
│   │   │   │   ├── articles/
│   │   │   │   │   ├── page.tsx           # Article list
│   │   │   │   │   ├── [id]/edit/page.tsx # Edit article
│   │   │   │   │   └── new/page.tsx       # Create article
│   │   │   │   ├── videos/
│   │   │   │   │   ├── page.tsx           # Video job queue
│   │   │   │   │   └── [id]/page.tsx      # Job details
│   │   │   │   ├── analytics/
│   │   │   │   │   └── page.tsx           # Metrics & charts
│   │   │   │   ├── settings/
│   │   │   │   │   └── page.tsx           # System settings
│   │   │   │   └── api-docs/
│   │   │   │       └── page.tsx           # API documentation
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── breadcrumbs.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── metric-card.tsx
│   │   │   │   ├── stats-chart.tsx
│   │   │   │   └── activity-feed.tsx
│   │   │   ├── restaurants/
│   │   │   │   ├── restaurant-table.tsx
│   │   │   │   ├── restaurant-form.tsx
│   │   │   │   └── card-preview.tsx      # Preview before publish
│   │   │   ├── articles/
│   │   │   │   ├── article-editor.tsx    # Rich text editor
│   │   │   │   └── article-preview.tsx
│   │   │   └── ui/                        # shadcn/ui components
│   │   ├── lib/
│   │   │   ├── api.ts                     # Admin API client
│   │   │   ├── auth.ts                    # Auth helpers
│   │   │   └── validations.ts             # Form validations
│   │   └── types/
│   │       ├── admin.ts
│   │       └── restaurant.ts              # Extend from web/
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── api/
│   └── index.js                  # EXTEND: Add admin routes
└── src/
    ├── database.py               # EXTEND: Add admin tables
    └── backend_service.py        # EXTEND: Add admin methods
```

### 2. Database Schema Extensions

**New Tables to Add:**

```sql
-- Admin Users
CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'editor', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Articles/Blog Posts
CREATE TABLE articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title_hebrew TEXT NOT NULL,
    title_english TEXT,
    content_hebrew TEXT NOT NULL,
    content_english TEXT,
    excerpt_hebrew TEXT,
    excerpt_english TEXT,
    cover_image_url TEXT,
    author_id INTEGER REFERENCES admin_users(id),
    status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'scheduled', 'archived')),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tags TEXT,  -- JSON array
    seo_description TEXT
);

-- Restaurant Edit History (Audit Log)
CREATE TABLE restaurant_edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_name TEXT NOT NULL,
    admin_user_id INTEGER REFERENCES admin_users(id),
    edit_type TEXT NOT NULL CHECK(edit_type IN ('create', 'update', 'delete', 'approve', 'reject')),
    changes TEXT,  -- JSON diff
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by INTEGER REFERENCES admin_users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. API Routes (Express)

**Admin-Specific Routes:**

```javascript
// Authentication
POST   /api/admin/auth/login
POST   /api/admin/auth/logout
GET    /api/admin/auth/me
POST   /api/admin/auth/refresh

// Restaurants Management
GET    /api/admin/restaurants              # Paginated, sortable, filterable
GET    /api/admin/restaurants/:id
POST   /api/admin/restaurants              # Create new
PUT    /api/admin/restaurants/:id          # Full update
PATCH  /api/admin/restaurants/:id          # Partial update
DELETE /api/admin/restaurants/:id
GET    /api/admin/restaurants/:id/history  # Edit history

// Articles/Content
GET    /api/admin/articles
GET    /api/admin/articles/:id
POST   /api/admin/articles
PUT    /api/admin/articles/:id
DELETE /api/admin/articles/:id
POST   /api/admin/articles/:id/publish

// Video Processing
GET    /api/admin/videos/queue             # Job queue
POST   /api/admin/videos/process           # Add new video
GET    /api/admin/videos/:jobId
DELETE /api/admin/videos/:jobId            # Cancel job

// Analytics
GET    /api/admin/analytics/overview       # Dashboard metrics
GET    /api/admin/analytics/restaurants    # Restaurant stats
GET    /api/admin/analytics/episodes       # Episode stats
GET    /api/admin/analytics/system         # System health

// Settings
GET    /api/admin/settings
PUT    /api/admin/settings
```

**Public Routes to Add (for articles):**

```javascript
GET    /api/articles                       # List published articles
GET    /api/articles/:slug                 # Single article
```

---

## Feature Breakdown

### 1. Dashboard Overview (Landing Page)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: "Where2Eat Admin" | User Avatar | Notifications   │
├──────┬──────────────────────────────────────────────────────┤
│      │ KEY METRICS (4 cards across)                         │
│      ├──────────────────────────────────────────────────────┤
│ SIDE │ Total Restaurants: 1,247                             │
│ BAR  │ ↑ +23 this week                                      │
│      │                                                       │
│ Nav: │ New Videos Processed: 12                             │
│ - Home│ ↑ +3 today                                          │
│ - Restaurants                                               │
│ - Articles│ Articles Published: 45                          │
│ - Videos │ ↓ -2 drafts                                      │
│ - Analytics                                                 │
│ - Settings│ Active Jobs: 2                                  │
│      │ → View Queue                                         │
│      ├──────────────────────────────────────────────────────┤
│      │ RECENT ACTIVITY (Timeline)                           │
│      ├──────────────────────────────────────────────────────┤
│      │ 🎥 Processed "Best Hummus in Tel Aviv" - 5 restaurants│
│      │ ✏️  Edited "Cafe Landwer - Dizengoff" - Price updated│
│      │ 📝 Published "Winter Food Trends 2026"               │
│      ├──────────────────────────────────────────────────────┤
│      │ CHARTS (2 columns)                                   │
│      │ [Restaurant Growth Chart] [Cuisine Distribution]     │
│      └──────────────────────────────────────────────────────┘
```

**Components:**
- `MetricCard` - Large number with trend indicator and sparkline
- `ActivityFeed` - Real-time list of recent system events
- `StatsChart` - Line/bar charts using Recharts or Chart.js
- `QuickActions` - Buttons for common tasks (Add Restaurant, New Article, Process Video)

### 2. Restaurant Management

**List View:**
- **Data Table** with columns:
  - Thumbnail (if available)
  - Name (Hebrew/English)
  - Location (City, Neighborhood)
  - Cuisine Type
  - Status (open/closed badge)
  - Host Opinion (emoji indicator)
  - Last Updated
  - Actions (Edit, Delete, Preview)

- **Features:**
  - Pagination (25/50/100 per page)
  - Column sorting (click header)
  - Global search (name, location, cuisine)
  - Filters (status, cuisine, location, price range)
  - Bulk actions (delete, change status)
  - Export to CSV/JSON

**Edit Form:**
- **Tabs for Organization:**
  1. **Basic Info** - Name, cuisine, location, status
  2. **Details** - Menu items, special features, price range
  3. **Contact** - Hours, phone, website
  4. **Media** - Images, Google Places integration
  5. **Source** - Episode info, timestamps, host comments
  6. **Preview** - Live preview of both card types (RestaurantCard + VisualRestaurantCard)

- **Form Features:**
  - Auto-save drafts (every 30s)
  - Validation with error highlighting
  - Image upload/URL input
  - Rich text editor for descriptions
  - Google Places autocomplete
  - Menu item builder (add/remove items with recommendation levels)
  - Preview pane showing card as users will see it

**Card Preview Component:**
- Side-by-side comparison:
  - `RestaurantCard` (text-first)
  - `VisualRestaurantCard` (image-first)
- Toggle between expanded/collapsed states
- Switch between languages (Hebrew/English)

### 3. Article/Content Management

**Article List:**
- Table with:
  - Title
  - Author
  - Status (draft/published/scheduled)
  - Published Date
  - Views (if tracked)
  - Actions (Edit, Delete, Duplicate)

- Filters: Status, Author, Date range, Tags

**Article Editor:**
- **Rich Text Editor Options:**
  - **Recommended:** Tiptap (headless, extensible, React-friendly)
  - Alternative: Lexical (Facebook's editor), Plate (based on Slate)

- **Features:**
  - Markdown support
  - Image uploads
  - Embedded YouTube videos
  - Restaurant card embeds (link to restaurants in DB)
  - SEO fields (meta description, slug, OG image)
  - Tags/categories
  - Publish now or schedule for later
  - Hebrew/English dual content
  - Live preview (desktop/mobile)

**Content Structure:**
```typescript
interface Article {
  id: number
  slug: string  // URL-friendly: "best-tel-aviv-hummus-2026"
  title: { hebrew: string, english: string }
  content: { hebrew: string, english: string }  // HTML from rich editor
  excerpt: { hebrew: string, english: string }
  coverImage: string  // URL
  author: AdminUser
  status: 'draft' | 'published' | 'scheduled' | 'archived'
  publishedAt: Date | null
  scheduledFor: Date | null
  tags: string[]
  seo: {
    description: string
    ogImage: string
    keywords: string[]
  }
  relatedRestaurants: string[]  // Restaurant names
  views: number
  createdAt: Date
  updatedAt: Date
}
```

**Frontend Integration:**
- Add `/articles` route to public `web/` app
- Article list page with filters
- Individual article pages with SEO
- Related restaurant cards at bottom
- Social sharing buttons

### 4. Video Processing Management

**Job Queue Table:**
- Columns:
  - Video Thumbnail
  - Title
  - Channel
  - Status (pending/processing/completed/failed)
  - Progress (if processing)
  - Restaurants Found
  - Started At
  - Duration
  - Actions (View Results, Retry, Cancel)

**Add New Video:**
- Form with:
  - YouTube URL input
  - Auto-fetch title/thumbnail preview
  - Priority selection (high/normal/low)
  - Submit to queue

**Job Detail View:**
- Video info
- Processing logs (real-time updates)
- Extracted restaurants preview
- Approve/reject each restaurant before publishing
- Bulk actions (approve all, publish to site)

### 5. Analytics Dashboard

**Overview Metrics:**
- Total restaurants, episodes, articles
- Growth charts (daily/weekly/monthly)
- Top 10 cuisines (pie chart)
- Geographic distribution (map heat map)
- Status breakdown (open vs. closed)

**Restaurant Analytics:**
- Most favorited restaurants
- Most searched cuisines
- Popular locations
- Price range distribution
- Host opinion sentiment analysis

**Episode Analytics:**
- Episodes processed over time
- Average restaurants per episode
- Top channels/hosts
- Processing success rate

**System Health:**
- API response times (p50, p95, p99)
- Database size and growth
- Error logs with filters
- Background job queue status
- Uptime monitoring

### 6. Settings

**General Settings:**
- Site name, description
- Contact email
- Social media links
- Default language

**API Configuration:**
- API keys (Google Places, OpenAI, Claude)
- Rate limits
- Cache settings

**User Management:**
- Admin users list
- Add/edit/delete admins
- Role assignment (super_admin, admin, editor, viewer)
- Password reset

**Permissions Matrix:**
```
                    Super Admin  Admin  Editor  Viewer
View Dashboard           ✓         ✓      ✓       ✓
Edit Restaurants         ✓         ✓      ✓       ✗
Delete Restaurants       ✓         ✓      ✗       ✗
Manage Articles          ✓         ✓      ✓       ✗
Process Videos           ✓         ✓      ✓       ✗
View Analytics           ✓         ✓      ✓       ✓
Manage Users             ✓         ✗      ✗       ✗
Edit Settings            ✓         ✗      ✗       ✗
```

---

## Tech Stack Recommendations

### Frontend (Admin App)

**Core:**
- **Next.js 16** (App Router, React Server Components)
- **TypeScript** (strict mode)
- **Tailwind CSS 4** (consistent with public site)
- **shadcn/ui** (reuse components from `web/`)

**State Management:**
- **TanStack Query (React Query)** - Server state, caching, optimistic updates
- **Zustand** or **Context API** - Client state (auth, UI preferences)

**Forms & Validation:**
- **React Hook Form** - Performance, minimal re-renders
- **Zod** - Schema validation, type inference

**Rich Text Editing:**
- **Tiptap** - Modern, extensible, great DX

**Charts & Visualization:**
- **Recharts** - React-native charts, good for dashboards
- Alternative: **Chart.js** with react-chartjs-2

**Tables:**
- **TanStack Table (React Table v8)** - Headless, highly customizable
- Features: sorting, filtering, pagination, column visibility

**Authentication:**
- **NextAuth.js v5** (Auth.js) - Standard for Next.js
- Or **Clerk** (if you want managed auth with UI)

**Date Handling:**
- **date-fns** - Lightweight, tree-shakeable

### Backend Extensions

**API (Express):**
- **express-validator** - Request validation
- **jsonwebtoken** - JWT auth tokens
- **bcrypt** - Password hashing
- **helmet** - Security headers (already exists)
- **rate-limiter-flexible** - Rate limiting per user/IP

**Python (Backend Services):**
- Extend `database.py` with admin tables
- Extend `backend_service.py` with admin methods
- Add `admin_service.py` for admin-specific logic

### Security

**Authentication Flow:**
```
1. User enters email/password
2. API verifies against admin_users table (bcrypt)
3. Returns JWT token (httpOnly cookie + localStorage)
4. Token includes: userId, role, exp
5. Middleware validates token on protected routes
6. Refresh token rotation every 15 minutes
```

**Authorization:**
- Role-based middleware checks
- Row-level security (users can only edit their own articles)
- API key validation for external requests

**Other Security:**
- HTTPS only in production
- CORS restricted to admin domain
- SQL injection prevention (parameterized queries)
- XSS protection (sanitize rich text HTML)
- CSRF tokens for state-changing operations
- Rate limiting (prevent brute force)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic admin app structure with authentication

**Tasks:**
1. Create `admin/` directory with Next.js boilerplate
2. Set up shadcn/ui and Tailwind (copy from `web/`)
3. Implement authentication:
   - Add `admin_users` table to database
   - Create login page
   - JWT token generation/validation
   - Protected route middleware
4. Build basic layout:
   - Sidebar navigation
   - Header with user menu
   - Dashboard overview page (placeholder metrics)
5. API routes for auth endpoints

**Deliverable:** Working login with protected dashboard

---

### Phase 2: Restaurant Management (Week 3-4)
**Goal:** Full CRUD for restaurants with preview

**Tasks:**
1. Restaurant list page with TanStack Table:
   - Pagination, sorting, filtering
   - Global search
   - Status badges and actions
2. Restaurant edit form:
   - React Hook Form + Zod validation
   - All fields from `Restaurant` type
   - Menu item builder
   - Google Places autocomplete
3. Card preview component:
   - Import `RestaurantCard` and `VisualRestaurantCard` from `web/`
   - Side-by-side preview
   - Language toggle
4. API endpoints:
   - GET/POST/PUT/DELETE for restaurants
   - Edit history logging
5. Testing:
   - Unit tests for forms
   - Integration tests for API

**Deliverable:** Complete restaurant CRUD with preview

---

### Phase 3: Analytics & Metrics (Week 5)
**Goal:** Real-time dashboard with insights

**Tasks:**
1. Metrics calculation:
   - Extend `backend_service.py` with analytics methods
   - Aggregate queries for counts, trends, distributions
2. Dashboard components:
   - `MetricCard` with trend indicators
   - Charts with Recharts (growth, cuisine distribution, location heat map)
   - `ActivityFeed` with recent events
3. API endpoints:
   - `/api/admin/analytics/overview`
   - `/api/admin/analytics/restaurants`
   - `/api/admin/analytics/system`
4. Real-time updates:
   - Polling every 30s or WebSocket connection
   - Toast notifications for new events

**Deliverable:** Rich analytics dashboard

---

### Phase 4: Content Management (Week 6-7)
**Goal:** Article creation and publishing

**Tasks:**
1. Database schema:
   - Add `articles` table
2. Article list page:
   - Table with status filters
   - Draft/published/scheduled views
3. Article editor:
   - Tiptap rich text editor setup
   - Dual language support (tabs)
   - Image upload to CDN or local storage
   - Restaurant card embed shortcode
   - SEO fields
   - Publish/schedule logic
4. Public-facing integration:
   - Add `/articles` routes to `web/`
   - Article list page with filters
   - Individual article pages
   - SEO meta tags
5. API endpoints:
   - Admin CRUD for articles
   - Public read-only endpoints

**Deliverable:** Full CMS for articles

---

### Phase 5: Video Processing UI (Week 8)
**Goal:** Manage video analysis jobs

**Tasks:**
1. Job queue page:
   - Table showing all jobs (pending/processing/completed/failed)
   - Real-time status updates
   - Progress bars for active jobs
2. Add video form:
   - YouTube URL input with validation
   - Priority selection
   - Submit to queue (calls `backend_service.py`)
3. Job detail page:
   - Processing logs
   - Extracted restaurants (approve/reject)
   - Bulk publish to database
4. API endpoints:
   - GET /api/admin/videos/queue
   - POST /api/admin/videos/process
   - GET /api/admin/videos/:jobId
   - DELETE /api/admin/videos/:jobId (cancel)

**Deliverable:** Video processing management

---

### Phase 6: Settings & Users (Week 9)
**Goal:** Admin user management and system settings

**Tasks:**
1. User management:
   - List admin users
   - Add/edit/delete users
   - Role assignment
   - Password reset
2. Settings page:
   - General settings (site name, description)
   - API keys management (encrypted storage)
   - Rate limits configuration
3. Permissions enforcement:
   - Middleware checks for role-based access
   - UI elements hidden based on permissions
4. Audit logging:
   - Track all admin actions
   - Export audit logs

**Deliverable:** Complete admin management

---

### Phase 7: Polish & Optimization (Week 10)
**Goal:** Production-ready quality

**Tasks:**
1. Performance:
   - Code splitting and lazy loading
   - Image optimization
   - Database query optimization
   - Caching strategies
2. Mobile responsiveness:
   - Test on tablets and phones
   - Touch-friendly controls
3. Testing:
   - E2E tests with Playwright
   - Load testing for API
   - Security audit
4. Documentation:
   - Admin user guide
   - API documentation (Swagger/OpenAPI)
   - Developer setup guide
5. Deployment:
   - Environment-specific configs
   - CI/CD pipeline
   - Monitoring and logging (Sentry, LogRocket)

**Deliverable:** Production deployment

---

## Alternative Approaches Considered

### Option 1: Use Existing Admin Framework
**Tools:** Refine, React Admin, AdminJS

**Pros:**
- Faster initial setup
- Built-in CRUD scaffolding
- Pre-built components

**Cons:**
- Less flexibility for custom UI
- Learning curve for framework-specific patterns
- May not integrate well with existing `backend_service.py`
- Harder to match public site's design language

**Verdict:** ❌ Not recommended - custom build gives more control

---

### Option 2: Separate Admin Backend
**Architecture:** Admin has its own Express server + database

**Pros:**
- Complete isolation from public API
- Independent scaling
- Different security policies

**Cons:**
- Data duplication between admin DB and main DB
- Sync complexity
- More infrastructure to maintain

**Verdict:** ❌ Not recommended - share API and DB for simplicity

---

### Option 3: Server-Side Rendered Admin (No SPA)
**Tech:** Next.js Server Components only, minimal client JS

**Pros:**
- Better SEO (not needed for admin)
- Simpler state management
- Faster initial load

**Cons:**
- Less interactive UX
- Full page reloads for updates
- Harder to do real-time updates

**Verdict:** ⚠️ Consider hybrid - use Server Components where possible, Client Components for interactivity

---

## Recommended Tech Stack Summary

```yaml
Frontend:
  Framework: Next.js 16 (App Router)
  Language: TypeScript (strict mode)
  Styling: Tailwind CSS 4 + shadcn/ui
  State: TanStack Query + Zustand
  Forms: React Hook Form + Zod
  Tables: TanStack Table
  Charts: Recharts
  Editor: Tiptap
  Auth: NextAuth.js v5

Backend:
  API: Express.js (extend existing)
  Database: SQLite (extend existing)
  Auth: JWT (jsonwebtoken + bcrypt)
  Validation: express-validator

DevOps:
  Testing: Jest + Playwright
  CI/CD: GitHub Actions
  Monitoring: Sentry
  Hosting: Vercel (frontend) + Railway/Fly.io (API)
```

---

## Next Steps

1. **Review & Approve** - Get stakeholder sign-off on design
2. **Create GitHub Project** - Set up project board with phases
3. **Environment Setup** - Initialize `admin/` directory with Next.js
4. **Authentication First** - Start with Phase 1 (foundation)
5. **Iterative Development** - Ship phases incrementally
6. **User Testing** - Test with real admins after Phase 2

---

## Appendix: Example Code Snippets

### Restaurant Table Component

```typescript
// admin/src/components/restaurants/restaurant-table.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import { Restaurant } from '@/types/restaurant'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Edit, Trash2, Eye } from 'lucide-react'

const columnHelper = createColumnHelper<Restaurant>()

const columns = [
  columnHelper.accessor('name_hebrew', {
    header: 'Name',
    cell: info => (
      <div>
        <div className="font-semibold">{info.getValue()}</div>
        <div className="text-sm text-muted-foreground">
          {info.row.original.name_english}
        </div>
      </div>
    ),
  }),
  columnHelper.accessor('location.city', {
    header: 'Location',
    cell: info => (
      <div>
        <div>{info.getValue()}</div>
        <div className="text-sm text-muted-foreground">
          {info.row.original.location.neighborhood}
        </div>
      </div>
    ),
  }),
  columnHelper.accessor('cuisine_type', {
    header: 'Cuisine',
    cell: info => <Badge variant="secondary">{info.getValue()}</Badge>,
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: info => {
      const status = info.getValue()
      const variant = status === 'open' ? 'default' : 'destructive'
      return <Badge variant={variant}>{status}</Badge>
    },
  }),
  columnHelper.accessor('host_opinion', {
    header: 'Opinion',
    cell: info => {
      const opinion = info.getValue()
      const emoji = {
        positive: '😍',
        negative: '😞',
        mixed: '🤔',
        neutral: '😐'
      }[opinion]
      return <span className="text-2xl">{emoji}</span>
    },
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: props => (
      <div className="flex gap-2">
        <Button size="sm" variant="ghost">
          <Eye className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost">
          <Edit className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ),
  }),
]

export function RestaurantTable() {
  const [globalFilter, setGlobalFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'restaurants'],
    queryFn: async () => {
      const res = await fetch('/api/admin/restaurants')
      return res.json()
    },
  })

  const table = useReactTable({
    data: data?.restaurants || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Search restaurants..."
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} className="text-left p-2">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="border-t">
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## References & Sources

**Modern Admin Dashboard Best Practices:**
- [21+ Best Next.js Admin Dashboard Templates - 2026](https://nextjstemplates.com/blog/admin-dashboard-templates)
- [16 Best React Dashboards in 2026 | Untitled UI](https://www.untitledui.com/blog/react-dashboards)
- [15+ Free Next.js Admin Dashboard Template for 2026 | TailAdmin](https://tailadmin.com/blog/free-nextjs-admin-dashboard)

**CMS Architecture & Design Patterns:**
- [How to Create a Good Admin Panel: Design Tips & Features List | Aspirity](https://aspirity.com/blog/good-admin-panel-design)
- [Admin Panels Unveiled: Purpose, Building Guide, Design Best Practices | DronaHQ](https://www.dronahq.com/building-admin-panels/)
- [Content Management System Architecture - Simple Talk](https://www.red-gate.com/simple-talk/development/other-development/content-management-system-architecture/)

**Restaurant Management Dashboard Features:**
- [12 Key Restaurant Dashboards For Daily Ops | Xenia](https://www.xenia.team/articles/restaurant-dashboards)
- [Restaurant Dashboard Examples & Templates - Ajelix](https://ajelix.com/dashboards/restaurant-dashboard-examples/)
- [Restaurant KPI Dashboard | Databox](https://databox.com/restaurant-kpi-dashboard)

---

**End of Document**

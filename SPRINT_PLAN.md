# Where2Eat Admin Dashboard - Sprint Plan

**Created:** 2026-01-10
**Project Duration:** 10 Sprints (2 weeks each = 20 weeks total)
**Sprint Duration:** 2 weeks per sprint

---

## Sprint Overview

| Sprint | Focus Area | Duration | Key Deliverables |
|--------|-----------|----------|------------------|
| Sprint 1 | Foundation & Auth | Weeks 1-2 | Login system, protected routes, basic layout |
| Sprint 2 | Restaurant CRUD | Weeks 3-4 | Restaurant table, edit forms, card preview |
| Sprint 3 | Analytics Dashboard | Weeks 5-6 | Metrics, charts, real-time updates |
| Sprint 4 | Content Management System | Weeks 7-8 | Article editor, publishing workflow |
| Sprint 5 | Video Processing UI | Weeks 9-10 | Job queue, video submission, approval workflow |
| Sprint 6 | Settings & User Management | Weeks 11-12 | Admin users, permissions, system settings |
| Sprint 7 | Advanced Features | Weeks 13-14 | Bulk operations, import/export, search |
| Sprint 8 | Mobile & Responsive | Weeks 15-16 | Mobile optimization, touch controls |
| Sprint 9 | Testing & Quality | Weeks 17-18 | E2E tests, performance optimization |
| Sprint 10 | Deployment & Documentation | Weeks 19-20 | Production deployment, user guides |

---

## Sprint 1: Foundation & Authentication

**Duration:** Weeks 1-2
**Goal:** Create secure admin authentication system and basic dashboard layout

### Day 1-2: Project Setup

**Tasks:**
- [ ] Create `admin/` directory structure
- [ ] Initialize Next.js 16 with TypeScript
- [ ] Configure Tailwind CSS 4
- [ ] Set up shadcn/ui component library
- [ ] Configure ESLint and Prettier
- [ ] Set up environment variables (.env.local)
- [ ] Create basic folder structure:
  ```
  admin/
  ├── src/
  │   ├── app/
  │   │   ├── (auth)/
  │   │   │   ├── login/
  │   │   │   └── layout.tsx
  │   │   ├── (dashboard)/
  │   │   │   ├── layout.tsx
  │   │   │   └── page.tsx
  │   │   ├── layout.tsx
  │   │   └── globals.css
  │   ├── components/
  │   │   ├── ui/              # shadcn components
  │   │   ├── layout/
  │   │   └── auth/
  │   ├── lib/
  │   │   ├── api.ts
  │   │   ├── auth.ts
  │   │   └── utils.ts
  │   └── types/
  │       └── admin.ts
  ```

**Acceptance Criteria:**
- Next.js dev server runs successfully
- Tailwind classes work
- TypeScript compilation passes
- Can access localhost:3001

---

### Day 3-4: Database Schema

**Tasks:**
- [ ] Extend `src/database.py` with admin tables
- [ ] Create `admin_users` table with schema:
  ```sql
  CREATE TABLE admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin', 'editor', 'viewer')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
  );
  ```
- [ ] Create `admin_sessions` table:
  ```sql
  CREATE TABLE admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES admin_users(id),
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT
  );
  ```
- [ ] Add database migration functions
- [ ] Create seed data (initial super admin user)
- [ ] Test database operations

**Acceptance Criteria:**
- Tables created successfully
- Can insert/query admin users
- Password hashing works
- Seed script creates default admin

---

### Day 5-6: Backend Authentication API

**Tasks:**
- [ ] Install dependencies in `api/`:
  ```bash
  npm install jsonwebtoken bcrypt express-validator
  npm install -D @types/jsonwebtoken @types/bcrypt
  ```
- [ ] Create `api/middleware/auth.js`:
  - JWT token validation middleware
  - Role-based access control middleware
- [ ] Create `api/routes/admin-auth.js`:
  - POST `/api/admin/auth/login`
  - POST `/api/admin/auth/logout`
  - GET `/api/admin/auth/me`
  - POST `/api/admin/auth/refresh`
- [ ] Extend `src/backend_service.py` with admin methods:
  - `authenticate_admin(email, password)`
  - `get_admin_by_id(user_id)`
  - `create_admin_session(user_id, token_hash)`
  - `validate_session(token_hash)`
- [ ] Add Python dependencies:
  ```bash
  pip install passlib pyjwt
  ```

**Acceptance Criteria:**
- Login endpoint returns JWT token
- Token validation works
- Password verification uses bcrypt
- Unauthorized requests are blocked

---

### Day 7-8: Frontend Authentication

**Tasks:**
- [ ] Create login page: `admin/src/app/(auth)/login/page.tsx`
- [ ] Build login form with React Hook Form + Zod validation
- [ ] Implement auth context: `admin/src/lib/auth-context.tsx`
- [ ] Create auth API client: `admin/src/lib/api.ts`
- [ ] Add protected route HOC/middleware
- [ ] Implement token storage (httpOnly cookie + localStorage)
- [ ] Add logout functionality
- [ ] Create session refresh logic

**Components to Build:**
- `LoginForm` - Email/password form with validation
- `AuthProvider` - Context for auth state
- `ProtectedRoute` - HOC to guard dashboard routes

**Acceptance Criteria:**
- Can login with seeded admin credentials
- Token stored securely
- Protected routes redirect to login if unauthenticated
- Logout clears session

---

### Day 9-10: Dashboard Layout

**Tasks:**
- [ ] Create dashboard layout: `admin/src/app/(dashboard)/layout.tsx`
- [ ] Build sidebar navigation component:
  - Logo/branding
  - Navigation links (Dashboard, Restaurants, Articles, Videos, Analytics, Settings)
  - User profile section
  - Collapse/expand functionality
- [ ] Build header component:
  - Breadcrumbs
  - Search bar (global)
  - Notifications icon
  - User avatar dropdown
- [ ] Create dashboard home page: `admin/src/app/(dashboard)/page.tsx`
  - Placeholder metric cards
  - Welcome message
- [ ] Add dark mode toggle
- [ ] Mobile-responsive sidebar (drawer on mobile)

**Components to Build:**
- `DashboardLayout` - Main layout wrapper
- `Sidebar` - Navigation sidebar
- `Header` - Top header bar
- `UserMenu` - User dropdown menu
- `NavLink` - Active link with highlighting

**Acceptance Criteria:**
- Sidebar shows all navigation items
- Active route is highlighted
- Sidebar collapses on mobile
- User menu shows name and logout option
- Dark mode toggle works

---

### Sprint 1 Deliverables

**Completed Features:**
✅ Next.js admin app with TypeScript and Tailwind
✅ Database schema for admin users and sessions
✅ Backend authentication API with JWT
✅ Frontend login page with form validation
✅ Protected dashboard routes
✅ Dashboard layout with sidebar and header

**Testing Checklist:**
- [ ] Can create admin user via seed script
- [ ] Can login with email/password
- [ ] Invalid credentials show error
- [ ] Protected routes redirect to login
- [ ] JWT token expires after configured time
- [ ] Logout clears session
- [ ] Dashboard layout renders on all screen sizes

**Documentation:**
- API endpoint documentation for auth routes
- Database schema diagram
- Setup instructions for local development

---

## Sprint 2: Restaurant Management CRUD

**Duration:** Weeks 3-4
**Goal:** Complete restaurant data management with table, forms, and preview

### Day 1-2: Restaurant List Page & API

**Tasks:**
- [ ] Install TanStack Table and TanStack Query:
  ```bash
  cd admin && npm install @tanstack/react-table @tanstack/react-query
  ```
- [ ] Create API endpoints in `api/routes/admin-restaurants.js`:
  - GET `/api/admin/restaurants` (paginated, filterable, sortable)
  - GET `/api/admin/restaurants/:id`
  - POST `/api/admin/restaurants`
  - PUT `/api/admin/restaurants/:id`
  - PATCH `/api/admin/restaurants/:id`
  - DELETE `/api/admin/restaurants/:id`
- [ ] Extend `src/backend_service.py` with restaurant admin methods:
  - `get_all_restaurants_paginated(page, limit, filters, sort)`
  - `get_restaurant_by_id(id)`
  - `create_restaurant(data)`
  - `update_restaurant(id, data)`
  - `delete_restaurant(id)`
- [ ] Add query parameter parsing (filters, sort, pagination)
- [ ] Add input validation with express-validator

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 25)
- `sort` (e.g., "name_hebrew", "-created_at")
- `filter[status]` (e.g., "open")
- `filter[cuisine]`
- `filter[location.city]`
- `search` (global text search)

**Acceptance Criteria:**
- API returns paginated restaurant list
- Filtering by status/cuisine/location works
- Sorting by any column works
- Search filters by name/location/cuisine
- API returns proper error codes

---

### Day 3-4: Restaurant Table Component

**Tasks:**
- [ ] Create restaurants list page: `admin/src/app/(dashboard)/restaurants/page.tsx`
- [ ] Build restaurant table component: `admin/src/components/restaurants/restaurant-table.tsx`
- [ ] Implement TanStack Table with features:
  - Column sorting (click headers)
  - Global search
  - Filtering dropdowns (status, cuisine, location)
  - Pagination controls
  - Row selection (checkboxes)
  - Actions column (Edit, Delete, Preview)
- [ ] Create table columns configuration:
  - Thumbnail (if available)
  - Name (Hebrew + English)
  - Location (City, Neighborhood)
  - Cuisine Type (badge)
  - Status (colored badge)
  - Host Opinion (emoji)
  - Price Range (shekel symbols)
  - Last Updated (relative time)
  - Actions (button group)
- [ ] Add loading skeleton
- [ ] Add empty state component
- [ ] Implement TanStack Query for data fetching with caching

**Components to Build:**
- `RestaurantTable` - Main table component
- `TableFilters` - Filter controls
- `TablePagination` - Pagination component
- `StatusBadge` - Colored status indicator
- `OpinionEmoji` - Host opinion display
- `EmptyState` - No results message

**Acceptance Criteria:**
- Table displays all restaurants
- Sorting by clicking column headers works
- Search filters results instantly
- Filters apply correctly
- Pagination shows correct page numbers
- Can navigate between pages
- Loading state shows skeleton
- Empty state shows when no results

---

### Day 5-6: Restaurant Edit Form (Part 1: Structure)

**Tasks:**
- [ ] Install form dependencies:
  ```bash
  npm install react-hook-form @hookform/resolvers zod
  ```
- [ ] Create edit page: `admin/src/app/(dashboard)/restaurants/[id]/edit/page.tsx`
- [ ] Create new restaurant page: `admin/src/app/(dashboard)/restaurants/new/page.tsx`
- [ ] Build restaurant form component: `admin/src/components/restaurants/restaurant-form.tsx`
- [ ] Create Zod validation schema: `admin/src/lib/validations/restaurant.ts`
- [ ] Implement tabbed form layout with shadcn Tabs:
  1. **Basic Info** tab
  2. **Details** tab
  3. **Contact** tab
  4. **Media** tab
  5. **Source** tab
  6. **Preview** tab
- [ ] Add form state management with React Hook Form
- [ ] Implement auto-save drafts (every 30 seconds)
- [ ] Add unsaved changes warning

**Form Tabs Structure:**
```typescript
interface RestaurantFormData {
  // Basic Info
  name_hebrew: string
  name_english: string | null
  cuisine_type: string
  status: 'open' | 'closed' | 'new_opening' | 'closing_soon' | 'reopening'
  price_range: 'budget' | 'mid-range' | 'expensive' | 'not_mentioned'

  // Location
  location: {
    city: string | null
    neighborhood: string | null
    address: string | null
    region: 'North' | 'Center' | 'South' | null
  }

  // Details
  menu_items: MenuItem[]
  special_features: string[]
  food_trends: string[]

  // Contact
  contact_info: {
    phone: string | null
    website: string | null
    hours: string | null
  }

  // Source
  host_opinion: 'positive' | 'negative' | 'mixed' | 'neutral'
  host_comments: string
  episode_info: EpisodeInfo
  mention_context: string
  mention_timestamps: MentionTimestamp[]

  // Media
  images: string[]
  google_places: GooglePlacesInfo | null
}
```

**Acceptance Criteria:**
- Form loads existing restaurant data
- Tabs switch without losing form state
- Validation shows errors on blur
- Can save draft without publishing
- Unsaved changes warning on navigation

---

### Day 7-8: Restaurant Edit Form (Part 2: Fields)

**Tasks:**
- [ ] Build **Basic Info** tab fields:
  - Name inputs (Hebrew + English)
  - Cuisine type select/autocomplete
  - Status radio group
  - Price range select
  - Region select
- [ ] Build **Details** tab:
  - Menu items builder (dynamic array):
    - Item name input
    - Recommendation level select
    - Add/remove buttons
  - Special features tag input
  - Food trends tag input
- [ ] Build **Contact** tab:
  - Phone input with validation
  - Website URL input
  - Hours textarea
  - Google Places autocomplete integration
- [ ] Build **Media** tab:
  - Image URL inputs (array)
  - Google Places data display
  - Rating/reviews display
- [ ] Build **Source** tab:
  - Host opinion radio group
  - Host comments textarea
  - Episode info display (read-only)
  - Mention timestamps list
- [ ] Add field-level validation
- [ ] Add conditional fields (show/hide based on other fields)

**Components to Build:**
- `MenuItemBuilder` - Dynamic menu item array field
- `TagInput` - Multi-tag input component
- `LocationAutocomplete` - Google Places autocomplete
- `ImageUrlInput` - URL input with preview
- `RichTextarea` - Textarea with formatting options

**Acceptance Criteria:**
- All fields render with correct types
- Validation works on individual fields
- Menu items can be added/removed dynamically
- Tag inputs support adding/removing tags
- Google Places autocomplete works
- Form values update on change

---

### Day 9: Card Preview Component

**Tasks:**
- [ ] Create preview tab component: `admin/src/components/restaurants/card-preview.tsx`
- [ ] Import `RestaurantCard` from `web/src/components/restaurant-card.tsx`
- [ ] Import `VisualRestaurantCard` from `web/src/components/visual-restaurant-card.tsx`
- [ ] Create shared types package or symlink between admin and web
- [ ] Build preview layout:
  - Side-by-side comparison
  - Toggle expanded/collapsed state
  - Language switcher (Hebrew/English)
  - Device preview (desktop/mobile/tablet)
- [ ] Add live preview updates (reacts to form changes)
- [ ] Add "Copy to clipboard" for card data (JSON)

**Layout:**
```
┌─────────────────────────────────────────────┐
│ Preview Controls:                           │
│ [Hebrew/English] [Expanded/Collapsed]       │
│ [Desktop/Mobile/Tablet]                     │
├──────────────────┬──────────────────────────┤
│ RestaurantCard   │ VisualRestaurantCard     │
│ (Text-first)     │ (Image-first)            │
│                  │                          │
│ [Live preview]   │ [Live preview]           │
│                  │                          │
└──────────────────┴──────────────────────────┘
```

**Acceptance Criteria:**
- Both card types display correctly
- Preview updates in real-time as form changes
- Language toggle switches text
- Expanded/collapsed toggle works
- Device preview changes viewport size

---

### Day 10: Form Submission & Edit History

**Tasks:**
- [ ] Implement form submission handlers:
  - Save draft (PATCH with partial data)
  - Publish (PUT with full validation)
  - Delete (with confirmation dialog)
- [ ] Create edit history table in database:
  ```sql
  CREATE TABLE restaurant_edits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_name TEXT NOT NULL,
      admin_user_id INTEGER REFERENCES admin_users(id),
      edit_type TEXT CHECK(edit_type IN ('create', 'update', 'delete')),
      changes TEXT,  -- JSON diff
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
- [ ] Add audit logging to backend on save
- [ ] Create edit history component: `admin/src/components/restaurants/edit-history.tsx`
- [ ] Add success/error toast notifications
- [ ] Implement optimistic updates with TanStack Query
- [ ] Add loading states for save operations

**Components to Build:**
- `ConfirmDialog` - Delete confirmation modal
- `EditHistory` - Timeline of changes
- `Toast` - Success/error notifications

**Acceptance Criteria:**
- Save draft works without full validation
- Publish validates all required fields
- Delete shows confirmation dialog
- Edit history logs all changes
- Toast notifications show success/error
- Form resets after successful save
- Redirects to list after save (optional)

---

### Sprint 2 Deliverables

**Completed Features:**
✅ Restaurant list page with sortable/filterable table
✅ Pagination and global search
✅ Restaurant edit form with 6 tabs
✅ All form fields with validation
✅ Live card preview (both card types)
✅ Create, update, delete operations
✅ Edit history and audit logging
✅ Auto-save drafts

**Testing Checklist:**
- [ ] Can view all restaurants in table
- [ ] Sorting by each column works
- [ ] Filters apply correctly
- [ ] Search finds restaurants by name/location
- [ ] Can create new restaurant
- [ ] Can edit existing restaurant
- [ ] All form validations work
- [ ] Preview updates in real-time
- [ ] Can save draft
- [ ] Can publish restaurant
- [ ] Can delete restaurant (with confirmation)
- [ ] Edit history shows all changes
- [ ] Toast notifications appear

**Documentation:**
- Restaurant API endpoint documentation
- Form field specifications
- Validation rules
- Edit history schema

---

## Sprint 3: Analytics Dashboard

**Duration:** Weeks 5-6
**Goal:** Real-time metrics dashboard with charts and insights

### Day 1-2: Metrics Calculation API

**Tasks:**
- [ ] Create analytics endpoints in `api/routes/admin-analytics.js`:
  - GET `/api/admin/analytics/overview`
  - GET `/api/admin/analytics/restaurants`
  - GET `/api/admin/analytics/episodes`
  - GET `/api/admin/analytics/system`
- [ ] Extend `src/backend_service.py` with analytics methods:
  - `get_overview_metrics()` - Total counts, growth trends
  - `get_restaurant_stats()` - Cuisine distribution, location breakdown
  - `get_episode_stats()` - Processing stats, success rate
  - `get_system_health()` - DB size, API performance, errors
- [ ] Add caching for expensive queries (Redis or in-memory)
- [ ] Create aggregation queries for:
  - Total restaurants, episodes, articles
  - New additions (daily, weekly, monthly)
  - Status breakdown (open/closed/new)
  - Cuisine type distribution
  - Location distribution (city, region)
  - Price range distribution
  - Host opinion sentiment analysis

**Acceptance Criteria:**
- All analytics endpoints return correct data
- Queries are optimized (< 500ms response time)
- Caching reduces database load
- Date range filtering works

---

### Day 3-4: Dashboard Overview Page

**Tasks:**
- [ ] Install chart library:
  ```bash
  npm install recharts
  ```
- [ ] Update dashboard home page: `admin/src/app/(dashboard)/page.tsx`
- [ ] Create metric card component: `admin/src/components/dashboard/metric-card.tsx`
- [ ] Build 4 key metric cards:
  1. Total Restaurants (with trend)
  2. New Videos Processed (with trend)
  3. Published Articles (with trend)
  4. Active Jobs (with link to queue)
- [ ] Add sparkline charts to metric cards
- [ ] Create activity feed: `admin/src/components/dashboard/activity-feed.tsx`
- [ ] Fetch recent activities (last 20 events)
- [ ] Add real-time polling (every 30 seconds)

**Metric Card Features:**
- Large number display
- Trend indicator (↑ ↓) with percentage
- Sparkline chart (last 7 days)
- Color coding (green for positive, red for negative)
- Link to detail view

**Activity Feed Items:**
- Restaurant created/updated/deleted
- Video processed
- Article published
- Admin user action

**Acceptance Criteria:**
- Metric cards display correct numbers
- Trends show increase/decrease
- Sparklines render
- Activity feed shows recent events
- Data refreshes every 30 seconds

---

### Day 5-6: Charts and Visualizations

**Tasks:**
- [ ] Create charts component: `admin/src/components/dashboard/charts.tsx`
- [ ] Build restaurant growth chart (line chart):
  - X-axis: Date (last 30 days)
  - Y-axis: Number of restaurants
  - Show cumulative growth
- [ ] Build cuisine distribution chart (pie/donut chart):
  - Slices: Top 10 cuisines
  - Show percentages and counts
- [ ] Build location distribution chart (bar chart):
  - Bars: Top cities
  - Y-axis: Number of restaurants
- [ ] Build status breakdown chart (stacked bar):
  - Categories: Open, Closed, New Opening
  - Show trends over time
- [ ] Build host opinion sentiment chart (pie chart):
  - Segments: Positive, Negative, Mixed, Neutral
- [ ] Add chart controls:
  - Date range picker (last 7/30/90 days, custom)
  - Chart type toggle (where applicable)
  - Export to PNG/CSV

**Acceptance Criteria:**
- All charts render correctly
- Data is accurate
- Date range filtering works
- Charts are responsive
- Export functionality works
- Tooltips show detailed info on hover

---

### Day 7-8: Analytics Detail Pages

**Tasks:**
- [ ] Create analytics page: `admin/src/app/(dashboard)/analytics/page.tsx`
- [ ] Build tabs for different analytics views:
  1. **Restaurants** tab
  2. **Episodes** tab
  3. **System Health** tab
- [ ] **Restaurants tab:**
  - Most favorited restaurants (table)
  - Most searched cuisines (chart)
  - Popular locations (map heat map - future)
  - Price range distribution
  - Menu item trends (word cloud - future)
- [ ] **Episodes tab:**
  - Episodes processed over time (line chart)
  - Average restaurants per episode
  - Top channels/hosts (table)
  - Processing success rate (gauge)
- [ ] **System Health tab:**
  - API response times (p50, p95, p99) - line chart
  - Database size and growth (area chart)
  - Error logs table (filterable)
  - Background job queue status
  - Uptime display

**Acceptance Criteria:**
- All tabs render with correct data
- Charts update based on date range
- Tables are sortable
- Error logs are filterable
- System health shows real-time data

---

### Day 9-10: Real-time Updates & Notifications

**Tasks:**
- [ ] Implement polling strategy with TanStack Query:
  - Refetch interval: 30 seconds for dashboard
  - On-focus refetch enabled
  - Stale time: 1 minute
- [ ] Create notification system:
  - Toast notifications for errors
  - Badge count for new activities
- [ ] Add WebSocket connection (optional, future enhancement):
  - Real-time event stream
  - Live dashboard updates
- [ ] Implement refresh button with manual refetch
- [ ] Add "Last updated" timestamp to cards
- [ ] Optimize polling (pause when tab inactive)

**Acceptance Criteria:**
- Dashboard updates every 30 seconds
- Manual refresh works
- Notifications appear for errors
- Badge count shows new activities
- Polling pauses when tab inactive

---

### Sprint 3 Deliverables

**Completed Features:**
✅ Metrics dashboard with 4 key indicators
✅ Activity feed with real-time updates
✅ Restaurant growth chart
✅ Cuisine and location distribution charts
✅ Analytics detail page with tabs
✅ System health monitoring
✅ Real-time polling and notifications

**Testing Checklist:**
- [ ] All metrics display correct numbers
- [ ] Charts render with accurate data
- [ ] Date range filtering works
- [ ] Real-time updates occur every 30 seconds
- [ ] Manual refresh works
- [ ] Activity feed shows recent events
- [ ] System health shows DB size, API times

---

## Sprint 4-10: Brief Overview

### Sprint 4: Content Management System (Weeks 7-8)
- Article list and table
- Rich text editor (Tiptap) with Hebrew/English
- Article form with SEO fields
- Publish/schedule workflow
- Public `/articles` route integration
- Article preview

### Sprint 5: Video Processing UI (Weeks 9-10)
- Job queue table with status
- Add video form
- Job detail page with logs
- Approve/reject restaurant workflow
- Bulk publish operations
- Real-time job progress

### Sprint 6: Settings & User Management (Weeks 11-12)
- Admin user list and CRUD
- Role management (RBAC)
- Password reset
- System settings (API keys, rate limits)
- Permissions enforcement
- Audit log viewer

### Sprint 7: Advanced Features (Weeks 13-14)
- Bulk operations (multi-select actions)
- Import/export (CSV, JSON)
- Advanced search across all entities
- Keyboard shortcuts
- Duplicate detection
- Batch editing

### Sprint 8: Mobile & Responsive (Weeks 15-16)
- Mobile-optimized layouts
- Touch-friendly controls
- Responsive tables (card view on mobile)
- Drawer navigation
- Mobile gestures
- Progressive Web App (PWA)

### Sprint 9: Testing & Quality (Weeks 17-18)
- Unit tests (Jest, React Testing Library)
- Integration tests (API routes)
- E2E tests (Playwright)
- Performance optimization
- Security audit
- Accessibility audit (WCAG 2.1)

### Sprint 10: Deployment & Documentation (Weeks 19-20)
- Production build optimization
- Environment configuration
- CI/CD pipeline (GitHub Actions)
- Monitoring and logging (Sentry)
- User documentation
- Developer documentation
- Deployment to Vercel/Railway

---

## Success Metrics

**Sprint 1-2:**
- Authentication system with 100% login success rate
- Restaurant CRUD operations functional
- Form validation catches all invalid inputs

**Sprint 3:**
- Dashboard loads in < 2 seconds
- Charts render in < 500ms
- Real-time updates work reliably

**Sprint 4-6:**
- CMS supports rich content creation
- Video processing queue is manageable
- User permissions prevent unauthorized actions

**Sprint 7-10:**
- Admin app is mobile-responsive
- 90%+ test coverage
- Production deployment successful

---

## Risk Management

**High-Risk Items:**
1. **Google Places API Integration** - May hit rate limits or quota
   - Mitigation: Cache results, implement retry logic
2. **Real-time Updates** - WebSocket complexity
   - Mitigation: Start with polling, upgrade to WebSocket later
3. **Rich Text Editor** - Complex to implement
   - Mitigation: Use Tiptap library, start simple
4. **Authentication Security** - JWT token management
   - Mitigation: Use established libraries, follow OWASP guidelines

**Dependencies:**
- Sprint 2 depends on Sprint 1 (auth required for protected routes)
- Sprint 4-5 can run in parallel
- Sprint 9 requires Sprint 1-8 to be complete

---

## Team Capacity Assumptions

- 1 full-time developer
- 40 hours per week
- 2-week sprints = 80 hours per sprint
- 20% buffer for bugs, meetings, reviews = 64 productive hours

**Task Breakdown:**
- Each day = ~6-7 productive hours
- Each sprint = 10 working days

---

**End of Sprint Plan**

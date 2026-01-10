# Where2Eat Admin Dashboard - Complete Guide

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Getting Started](#getting-started)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Core Features](#core-features)
6. [API Documentation](#api-documentation)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

## Overview

The Where2Eat Admin Dashboard is a comprehensive management interface for the restaurant discovery system. Built with Next.js 16, React 19, and TypeScript, it provides a modern, responsive interface for managing restaurants, articles, videos, and system settings.

### Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validation
- **Rich Text**: Tiptap editor
- **Backend**: Express.js API + Python services
- **Database**: SQLite with Python ORM

## Features

### ✅ Sprint 1-3: Foundation (Previously Completed)
- Authentication system with JWT
- Restaurant management (CRUD)
- Analytics dashboard with charts
- Role-based access control

### ✅ Sprint 4: Content Management System
- Rich text editor (Tiptap) with formatting, links, images
- Articles with draft/publish workflow
- 3-tab editing interface (Content, SEO, Settings)
- Category and tag management
- Auto-slug generation from titles

### ✅ Sprint 5: Video Processing
- YouTube URL submission and validation
- Processing queue with status tracking
- Real-time job status updates (10s polling)
- View details and manage processing jobs

### ✅ Sprint 6: Settings & User Management
- User profile editing
- Password change functionality
- User list (super admin only)
- System settings and API key management
- Role-based UI visibility

### ✅ Sprint 7: Advanced Features
- **Bulk Operations**:
  - Multi-select restaurants with checkboxes
  - Bulk delete with confirmation
  - Bulk update (status, cuisine, etc.)
  - Export selected or all (JSON/CSV formats)
  - Import from JSON

- **Audit Log**:
  - Complete edit history tracking
  - Filter by restaurant or admin user
  - View all changes with timestamps
  - Detailed change information

- **Activity Feed**:
  - Real-time activity dashboard widget
  - Shows recent edits by all users
  - Auto-refreshes every 30 seconds
  - Links to full audit log

### ✅ Sprint 8: Mobile & Responsive
- Responsive mobile navigation with hamburger menu
- Mobile-friendly sidebar with overlay drawer
- Touch-optimized controls and layouts
- Responsive tables, forms, and charts
- Mobile-first breakpoints (sm, md, lg, xl)

### ✅ Sprint 9: Quality & Performance
- Error boundaries for robust error handling
- Consistent loading states with skeletons
- Accessibility improvements (ARIA labels, keyboard navigation)
- Performance optimization (code splitting, lazy loading)
- TanStack Query caching and prefetching

### ✅ Sprint 10: Deployment & Documentation
- Production deployment configuration
- Comprehensive API documentation
- User guide and admin manual
- Environment configuration guide

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Git

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd where2eat
   ```

2. **Install dependencies**:
   ```bash
   # Install API dependencies
   cd api
   npm install

   # Install admin dashboard dependencies
   cd ../admin
   npm install

   # Install Python dependencies
   cd ..
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:

   Create `/api/.env`:
   ```env
   PORT=3001
   JWT_SECRET=your-secret-key-here
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

   Create `/admin/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

4. **Initialize the database**:
   ```bash
   python scripts/cli.py health
   ```

5. **Create an admin user**:
   ```bash
   python scripts/cli.py create-admin
   ```

6. **Run the development servers**:
   ```bash
   # Terminal 1: API server
   cd api
   npm run dev

   # Terminal 2: Admin dashboard
   cd admin
   npm run dev
   ```

7. **Access the admin dashboard**:
   Open `http://localhost:3001` and log in with your admin credentials.

## User Roles & Permissions

### super_admin
- Full system access
- Manage users
- System configuration
- All CRUD operations

### admin
- Manage restaurants, articles, videos
- View analytics
- Cannot manage users or system settings

### editor
- Create and edit content
- Cannot delete or publish
- Limited analytics access

### viewer
- Read-only access
- View restaurants and analytics
- Cannot make changes

## Core Features

### Dashboard
- Overview metrics (restaurants, videos, articles, jobs)
- Activity feed showing recent changes
- Quick actions for common tasks
- Status breakdown charts
- System information

### Restaurants
- List view with pagination and search
- Filters by status, cuisine, city
- Inline edit and delete actions
- Multi-select for bulk operations
- Export to CSV or JSON
- Import from JSON

### Articles (CMS)
- Rich text editor with formatting toolbar
- Draft/publish workflow
- SEO optimization fields
- Category and tag management
- Featured images
- Scheduled publishing

### Videos
- Submit YouTube URLs for processing
- View processing queue
- Track job status in real-time
- View processing results
- Retry failed jobs

### Analytics
- Restaurant growth trends
- Geographic distribution
- Cuisine type breakdown
- Opinion sentiment analysis
- Custom date ranges

### Audit Log
- Complete edit history
- Filter by restaurant or user
- View detailed changes
- Export audit reports
- Search and pagination

### Settings
- **Profile Tab**: Edit name, email, password
- **Users Tab** (super admin): Manage admin users
- **System Tab** (super admin): API keys, configurations

## API Documentation

### Authentication

#### POST /api/admin/auth/login
Login with email and password.

**Request**:
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "Admin User",
    "role": "super_admin"
  }
}
```

#### POST /api/admin/auth/logout
Logout and invalidate session.

### Restaurants

#### GET /api/admin/restaurants
List restaurants with pagination and filters.

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 25)
- `search` (string): Search query
- `filter[status]` (string): Filter by status
- `filter[cuisine]` (string): Filter by cuisine

**Response**:
```json
{
  "restaurants": [...],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6
  }
}
```

#### POST /api/admin/restaurants
Create a new restaurant (requires editor role).

#### PUT /api/admin/restaurants/:id
Update a restaurant (requires editor role).

#### DELETE /api/admin/restaurants/:id
Delete a restaurant (requires admin role).

### Bulk Operations

#### POST /api/admin/bulk/restaurants/delete
Bulk delete restaurants (requires admin role).

**Request**:
```json
{
  "ids": ["id1", "id2", "id3"]
}
```

#### POST /api/admin/bulk/restaurants/update
Bulk update restaurants (requires editor role).

**Request**:
```json
{
  "ids": ["id1", "id2"],
  "updates": {
    "status": "closed"
  }
}
```

#### GET /api/admin/bulk/restaurants/export
Export restaurants to JSON or CSV.

**Query Parameters**:
- `format` (string): "json" or "csv"
- `ids` (array): Optional IDs to export

#### POST /api/admin/bulk/restaurants/import
Import restaurants from JSON.

**Request**:
```json
{
  "restaurants": [...]
}
```

### Audit Log

#### GET /api/admin/audit/history
Get edit history with filters.

**Query Parameters**:
- `restaurant_id` (string): Filter by restaurant
- `admin_user_id` (string): Filter by admin user
- `limit` (number): Max records (default: 100)

#### GET /api/admin/audit/activity
Get recent activity feed.

**Query Parameters**:
- `limit` (number): Max activities (default: 20)

### Analytics

#### GET /api/admin/analytics/overview
Get overview statistics.

#### GET /api/admin/analytics/restaurants
Get restaurant analytics with time series data.

**Query Parameters**:
- `period` (string): "7" (days), "30", "90", "365"

#### GET /api/admin/analytics/activities
Get recent activity metrics.

### Articles

#### GET /api/admin/articles
List articles with filters.

#### POST /api/admin/articles
Create article (requires editor role).

#### PUT /api/admin/articles/:id
Update article (requires editor role).

#### DELETE /api/admin/articles/:id
Delete article (requires admin role).

#### POST /api/admin/articles/:id/publish
Publish article (requires editor role).

#### POST /api/admin/articles/:id/unpublish
Unpublish article (requires editor role).

### Videos

#### GET /api/admin/videos
List video processing jobs.

#### POST /api/admin/videos
Submit new video for processing.

**Request**:
```json
{
  "video_url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

#### DELETE /api/admin/videos/:id
Delete video job.

## Production Deployment

### Environment Configuration

#### API Server (`/api/.env`)
```env
NODE_ENV=production
PORT=3001
JWT_SECRET=<strong-random-secret>
ALLOWED_ORIGINS=https://admin.where2eat.com,https://where2eat.com
```

#### Admin Dashboard (`/admin/.env.production`)
```env
NEXT_PUBLIC_API_URL=https://api.where2eat.com
```

### Build for Production

```bash
# Build admin dashboard
cd admin
npm run build

# Test production build
npm run start
```

### Deployment Options

#### Option 1: Vercel (Recommended for Admin Dashboard)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   cd admin
   vercel --prod
   ```

3. Set environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL` → your API URL

#### Option 2: Docker

Create `Dockerfile` in `/admin`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:
```bash
docker build -t where2eat-admin .
docker run -p 3000:3000 where2eat-admin
```

#### Option 3: Traditional VPS

1. SSH into your server
2. Clone repository
3. Install dependencies
4. Build application
5. Use PM2 to manage process:
   ```bash
   npm i -g pm2
   pm2 start npm --name "admin" -- start
   pm2 save
   pm2 startup
   ```

### Security Checklist

- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Keep dependencies updated
- [ ] Regular security audits
- [ ] Use environment variables
- [ ] Enable httpOnly cookies
- [ ] Implement CSP headers
- [ ] Monitor error logs

## Troubleshooting

### Build Errors

**"Module not found"**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**TypeScript errors**:
```bash
# Check types
npm run type-check

# Rebuild
npm run build
```

### Runtime Errors

**API connection failed**:
- Check `NEXT_PUBLIC_API_URL` is correct
- Ensure API server is running
- Check CORS configuration

**Authentication issues**:
- Clear browser cookies
- Check JWT_SECRET matches
- Verify token expiry settings

**Database errors**:
- Initialize database: `python scripts/cli.py health`
- Check file permissions on `data/where2eat.db`
- Run migrations if any

### Performance Issues

**Slow page loads**:
- Check network requests in browser DevTools
- Enable production build optimizations
- Check API response times
- Consider adding CDN

**High memory usage**:
- Reduce `refetchInterval` values
- Implement pagination limits
- Clear old audit logs
- Optimize images

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: This guide
- Admin Dashboard Version: v1.0.0

---

Last Updated: 2026-01-10

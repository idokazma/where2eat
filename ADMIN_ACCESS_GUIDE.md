# Admin Dashboard Access Guide

## Overview

The **admin dashboard is a completely separate application** from the main Where2Eat website. It's designed as a secure, standalone tool for authorized users only.

---

## 🔐 Security Architecture

### Separate Application
- **Main Website:** `web/` directory → Runs on `http://localhost:3000`
- **Admin Dashboard:** `admin/` directory → Runs on `http://localhost:3001`

This separation ensures:
- ✅ No accidental exposure of admin features to public users
- ✅ Different deployment options (admin can be internal-only)
- ✅ Independent scaling and security policies
- ✅ Complete isolation of admin logic from public site

### Authentication Required
**Every route in the admin dashboard is protected** except the login page:
- `/login` - Public (login page)
- `/dashboard/*` - Protected (requires authentication)
- `/dashboard/restaurants/*` - Protected (requires editor+ role)
- All other admin routes - Protected

---

## 🚀 How to Run the Admin Dashboard

### 1. Start the API Server
```bash
cd api
npm run dev
# Runs on http://localhost:3001 (serves admin API endpoints)
```

### 2. Start the Admin Dashboard
```bash
cd admin
npm run dev
# Runs on http://localhost:3001 (admin frontend)
```

**Note:** The admin app runs on port **3001** (different from the main web app on port 3000).

---

## 👤 Default Admin Credentials

A default super admin user was created during Sprint 1:

**Email:** `admin@where2eat.com`
**Password:** `admin123`

**⚠️ IMPORTANT:** Change this password in production! This is for development only.

---

## 🔑 Access Flow

### First-Time Access

1. **Navigate to the admin dashboard:**
   ```
   http://localhost:3001
   ```

2. **You'll be automatically redirected to:**
   ```
   http://localhost:3001/login
   ```

3. **Login with credentials:**
   - Email: `admin@where2eat.com`
   - Password: `admin123`

4. **Upon successful login:**
   - JWT token stored in httpOnly cookie
   - Redirected to `/dashboard`
   - Token also stored in localStorage for API calls

5. **Access the dashboard:**
   - All pages under `/dashboard/*` are now accessible
   - Navigation sidebar shows available sections

### Session Management

- **Session Duration:** 24 hours
- **Auto-refresh:** Token refreshes on activity
- **Logout:** Click user menu → "Log out"
- **Expired Session:** Auto-redirect to login page

---

## 👥 Role-Based Access Control

### Role Hierarchy (lowest to highest)

1. **Viewer** - Read-only access
   - View restaurants
   - View analytics
   - View articles
   - Cannot create, edit, or delete

2. **Editor** - Content management
   - All viewer permissions +
   - Create/edit restaurants
   - Create/edit articles
   - Cannot delete or manage users

3. **Admin** - Full content control
   - All editor permissions +
   - Delete restaurants
   - Delete articles
   - Manage system settings
   - Cannot manage admin users

4. **Super Admin** - Complete control
   - All admin permissions +
   - Create/edit/delete admin users
   - Change user roles
   - Access all system features

### How Roles Are Enforced

**Frontend Protection:**
```typescript
// In admin/app/dashboard/layout.tsx
<ProtectedRoute>
  {children}
</ProtectedRoute>
```

**API Protection:**
```javascript
// In api/routes/admin-restaurants.js
router.post('/', requireRole(['editor', 'admin', 'super_admin']), ...)
router.delete('/:id', requireRole(['admin', 'super_admin']), ...)
```

**Example:**
- An "editor" trying to delete a restaurant → **403 Forbidden**
- A "viewer" trying to create a restaurant → **403 Forbidden**

---

## 🌐 Production Deployment Options

### Option 1: Separate Subdomain (Recommended)
- **Main Site:** `https://where2eat.com`
- **Admin:** `https://admin.where2eat.com`

**Benefits:**
- Clear separation
- Can restrict admin to internal network/VPN
- Different SSL certificates if needed

### Option 2: Same Domain, Different Path
- **Main Site:** `https://where2eat.com`
- **Admin:** `https://where2eat.com/admin`

**Setup Required:**
- Configure reverse proxy (nginx/Vercel)
- Route `/admin/*` to admin Next.js app

### Option 3: Internal Network Only
- **Main Site:** Public internet
- **Admin:** Internal IP only (e.g., `http://10.0.0.50:3001`)

**Benefits:**
- Maximum security (not exposed to internet)
- VPN required for remote access

---

## 🔒 Additional Security Recommendations

### For Production

1. **Change Default Credentials**
   ```bash
   # Create a new super admin with strong password
   python scripts/seed_admin_simple.py
   # Then delete the default admin@where2eat.com user
   ```

2. **Environment Variables**
   ```bash
   # In admin/.env.local
   JWT_SECRET=<strong-random-secret-256-bits>
   NEXT_PUBLIC_API_URL=https://admin.where2eat.com/api

   # In api/.env
   JWT_SECRET=<same-as-above>
   ADMIN_SESSION_DURATION=24h
   ```

3. **HTTPS Only**
   - Always use HTTPS in production
   - httpOnly cookies already prevent XSS attacks

4. **Rate Limiting**
   ```javascript
   // Add to api/index.js
   const rateLimit = require('express-rate-limit');

   const loginLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 5, // 5 attempts
     message: 'Too many login attempts'
   });

   app.use('/api/admin/auth/login', loginLimiter);
   ```

5. **IP Whitelisting** (optional)
   - Restrict admin dashboard to specific IP ranges
   - Use firewall rules or nginx configuration

---

## 📱 Current Admin Features

### Dashboard Home (`/dashboard`)
- Overview metrics with trends
- Activity feed (real-time updates)
- Quick actions
- System information

### Restaurants (`/dashboard/restaurants`)
- List all restaurants (table view)
- Search and filter
- Create new restaurant
- Edit existing restaurant (6-tab form)
- Delete restaurant (admin+ only)

### Analytics (`/dashboard/analytics`)
- Restaurant analytics:
  - Growth charts
  - Cuisine distribution
  - Location breakdown
  - Sentiment analysis
- System health:
  - Database metrics
  - API performance
  - Memory usage

### Coming Soon
- Articles management (Sprint 4)
- Video processing (Sprint 5)
- User management (Sprint 6)
- Settings (Sprint 6)

---

## 🧪 Testing Access Locally

### Test as Different Roles

1. **Create test users:**
   ```python
   # In Python
   from src.admin_database import AdminDatabase

   db = AdminDatabase()

   # Create editor
   db.create_admin_user('editor@test.com', 'password123', 'Test Editor', 'editor')

   # Create viewer
   db.create_admin_user('viewer@test.com', 'password123', 'Test Viewer', 'viewer')
   ```

2. **Login with different accounts:**
   - Super admin: `admin@where2eat.com` / `admin123`
   - Editor: `editor@test.com` / `password123`
   - Viewer: `viewer@test.com` / `password123`

3. **Test permissions:**
   - Try to delete a restaurant as "viewer" → Should show "Access Denied"
   - Try to create a restaurant as "editor" → Should work
   - Try to access user management as "admin" → Will be available in Sprint 6

---

## 🔧 Troubleshooting

### "Cannot connect to API"
- ✅ Check if API server is running: `cd api && npm run dev`
- ✅ Verify API URL in `admin/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3001`

### "Session expired" / Auto-logout
- ✅ JWT token expired (24h default)
- ✅ Just login again
- ✅ Check browser console for errors

### "Access Denied" message
- ✅ Check your user role: Look at dashboard → System Information
- ✅ Verify required role for the action
- ✅ Contact super admin to upgrade your role

### Cannot login
- ✅ Verify credentials are correct
- ✅ Check if admin user exists in database: `sqlite3 data/where2eat.db "SELECT * FROM admin_users;"`
- ✅ Re-run seed script: `python scripts/seed_admin_simple.py`

---

## 📊 Quick Reference

| Feature | URL | Required Role |
|---------|-----|---------------|
| Login | `/login` | None (public) |
| Dashboard | `/dashboard` | Any authenticated user |
| View Restaurants | `/dashboard/restaurants` | viewer+ |
| Create Restaurant | `/dashboard/restaurants/new/edit` | editor+ |
| Edit Restaurant | `/dashboard/restaurants/:id/edit` | editor+ |
| Delete Restaurant | Restaurant table → Delete button | admin+ |
| Analytics | `/dashboard/analytics` | Any authenticated user |

---

## 📝 Summary

**Is the admin dashboard a different section?**
✅ Yes, it's a **completely separate Next.js application** with its own codebase.

**Different address?**
✅ Yes, it runs on **port 3001** (main site on 3000).
✅ In production, use **admin.where2eat.com** or similar.

**Only authorized users?**
✅ Yes, **all routes are protected** with JWT authentication.
✅ **Role-based access control** prevents unauthorized actions.
✅ **No way to access admin features** without logging in.

**Main Difference from Public Site:**
- Public site: Anyone can access
- Admin dashboard: Login required + role-based permissions

You're all set! The admin dashboard is secure by design. 🔐

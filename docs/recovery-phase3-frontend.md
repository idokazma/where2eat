# Recovery Phase 3: Frontend Security & Accuracy

## Status: Complete

## Objective
Add authentication gate to the admin page and make the about page stats dynamic.

## Changes

### 1. Admin Auth Gate (`web/src/app/admin/page.tsx`) — MODIFIED

**Before:** The admin dashboard was publicly accessible at `/admin` with no login required. Anyone could see stats, trigger video analysis, and access admin actions.

**After:** The page now shows a login form that authenticates against `POST /api/admin/auth/login`. Only after successful JWT authentication is the dashboard rendered.

**Implementation details:**
- `AdminLoginForm` component: email/password form that calls the auth API
- `AdminDashboard` component: the original dashboard, now receives the JWT token as prop
- Token stored in `sessionStorage` (cleared on tab close)
- On page load, verifies existing token via `GET /api/admin/auth/me`
- Invalid/expired tokens are cleared automatically
- Logout button clears token and returns to login form
- Admin actions (analyze video, cancel job) now include the `Authorization: Bearer` header

**Security choices:**
- `sessionStorage` (not `localStorage`) — token is cleared when the browser tab closes
- Token is verified on every page load, not just trusted from storage
- Login form uses `autoComplete` attributes for password manager support

### 2. Dynamic About Page Stats (`web/src/app/about/page.tsx`) — MODIFIED

**Before:** Hardcoded "200+" restaurants and "50+" episodes.

**After:** Fetches real counts from `GET /api/restaurants` on page load.
- Shows "..." while loading
- Counts unique `episode_info.video_id` values for episode count
- Falls back silently on API errors (stays in loading state)

## Tests

### Build Verification
- `npm run build` passes with no errors
- Both `/admin` and `/about` pages compile successfully

### Manual Test Plan
- [ ] Navigate to `/admin` — should see login form, not dashboard
- [ ] Enter invalid credentials — should show error message
- [ ] Enter valid credentials — should show dashboard with logout button
- [ ] Close tab and reopen `/admin` — should show login form again (sessionStorage cleared)
- [ ] Click logout — should return to login form
- [ ] Navigate to `/about` — should show real restaurant and episode counts
- [ ] If API is down, `/about` should show "..." for counts (no crash)

## Known Issues
- The admin login form is in English only (matches the existing admin dashboard language). Could be localized in a future pass.
- `sessionStorage` means each tab requires its own login. If you want persistent sessions across tabs, switch to `localStorage` with an expiry check.
- The about page makes an API call on every visit. Could be cached or use a dedicated `/api/stats` endpoint for better performance.

## Dependencies
- No new npm packages required
- Uses existing `getApiUrl` from `@/lib/config` for auth endpoint
- Uses existing shadcn/ui components (Card, Input, Button)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Where2Eat is a restaurant discovery system that scrapes YouTube podcasts (primarily Hebrew food content), extracts restaurant mentions using AI analysis, and presents location-based recommendations. The system consists of four main components:

1. **Python backend** (`src/`) - Scrapers, AI analyzers, database, and service layer
2. **Express.js / FastAPI API** (`api/`) - REST API with admin routes
3. **Next.js frontend** (`web/`) - Mobile-first Hebrew UI for restaurant discovery
4. **Admin dashboard** (`admin/`) - Separate Next.js app for content management

## Repository Structure

```
where2eat/
├── src/                    # Python backend modules
├── api/                    # Express.js + FastAPI API server
├── web/                    # Next.js 16 frontend (React 19)
├── admin/                  # Admin dashboard (Next.js)
├── tests/                  # Python test suite (14 test files)
├── scripts/                # CLI and utility scripts
├── data/                   # SQLite DB, restaurant JSON files, backups
├── analyses/               # AI analysis outputs (JSON + markdown)
├── transcripts/            # YouTube transcript cache
├── docs/                   # Architecture, specs, sprint plans
├── .claude/                # Claude Code skills, agents, MCP servers
├── .github/workflows/      # CI/CD (ci.yml, deploy.yml, pages.yml, scraper.yml)
├── Dockerfile              # Python 3.11 slim, runs FastAPI on port 8080
├── railway.json            # Railway deployment config
├── requirements.txt        # Python dependencies
├── setup.py                # Python package setup
└── CLAUDE.md               # This file
```

## Commands

### Python Backend

```bash
# Run all tests
python -m pytest tests/

# Run tests with coverage (required: >90%)
python -m pytest tests/ --cov=src --cov-report=html --cov-fail-under=90

# Run a single test file
python -m pytest tests/test_restaurant_search_agent.py -v

# Run mock tests (no network required)
python test_with_mock.py -v

# Analyze a YouTube video
python scripts/main.py 'https://www.youtube.com/watch?v=VIDEO_ID'

# Batch collect restaurant locations
python src/restaurant_location_collector.py --batch data/restaurants/
```

### Next.js Frontend (web/)

```bash
cd web
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Jest tests
npm run test:watch   # Jest watch mode
npm run test:coverage # Jest with coverage
```

### Express API (api/)

```bash
cd api
npm run dev          # Start with nodemon
npm start            # Production start (node index.js)
npm run start:fastapi # Start FastAPI server (uvicorn)
npm run dev:fastapi   # Start FastAPI with hot reload
```

### CLI (scripts/cli.py)

```bash
python scripts/cli.py process-video 'https://www.youtube.com/watch?v=VIDEO_ID'
python scripts/cli.py list-restaurants --location "תל אביב" --cuisine "Italian"
python scripts/cli.py import-json data/restaurants_backup/
python scripts/cli.py stats
python scripts/cli.py health
python scripts/cli.py analytics trends --period 3months
```

## Architecture

### Data Flow

```
YouTube URL → Transcript Collector → AI Analyzer → SQLite Database → Express/FastAPI API → Next.js Frontend
```

### Python Backend (src/)

| Module | Purpose |
|--------|---------|
| `database.py` | SQLite database layer (episodes, restaurants, jobs tables) |
| `backend_service.py` | Unified service layer coordinating all backend operations |
| `config.py` | Configuration settings (rate limits, feature flags) |
| `youtube_transcript_collector.py` | YouTube transcript fetcher with caching, rate limiting (30s), health checks |
| `youtube_channel_collector.py` | Processes entire YouTube channels |
| `claude_restaurant_analyzer.py` | Claude API-based restaurant extraction from transcripts |
| `openai_restaurant_analyzer.py` | OpenAI-based restaurant extraction (alternative provider) |
| `unified_restaurant_analyzer.py` | Unified interface for multiple LLM providers |
| `llm_config.py` | LLM provider configuration management |
| `restaurant_search_agent.py` | Enhanced restaurant search with Google Places |
| `restaurant_location_collector.py` | Geocoding and Google Business data collection |
| `restaurant_image_collector.py` | Restaurant photo collection |
| `restaurant_pipeline.py` | Pipeline orchestration for end-to-end processing |
| `restaurant_analyzer.py` | Restaurant extraction utilities |
| `google_places_enricher.py` | Google Places API enrichment |
| `map_integration.py` | GeoJSON and map visualization generation |
| `channel_batch_processor.py` | Batch processing for YouTube channels |
| `admin_database.py` | Admin-specific database operations |
| `subscription_manager.py` | YouTube channel/playlist subscription management |
| `video_queue_manager.py` | Video processing queue with priority scheduling and retry |
| `pipeline_scheduler.py` | APScheduler-based auto polling and processing orchestrator |
| `pipeline_logger.py` | Structured pipeline event logging with rotation |

### Frontend (web/)

- **Framework**: Next.js 16.1.1 with React 19.2.3, TypeScript 5, Tailwind CSS 4
- **Components**: shadcn/ui (Radix primitives), Framer Motion, Lucide React icons
- **Router**: App Router in `web/src/app/`
- **Internationalization**: Hebrew (primary) and English via `web/src/lib/translations/`
- **State**: React Context (`LanguageContext`, `FavoritesContext`)
- **API config**: `NEXT_PUBLIC_API_URL` env var, configured in `web/src/lib/config.ts`

**App Router Pages:**

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.tsx` | Home page with discovery feed |
| `/restaurant/[id]` | `app/restaurant/[id]/page.tsx` | Restaurant detail (dynamic) |
| `/map` | `app/map/page.tsx` | Map view |
| `/trending` | `app/trending/page.tsx` | Trending analytics |
| `/saved` | `app/saved/page.tsx` | Saved restaurants |
| `/settings` | `app/settings/page.tsx` | Settings |
| `/about` | `app/about/page.tsx` | About page |
| `/privacy` | `app/privacy/page.tsx` | Privacy policy |
| `/admin` | `app/admin/page.tsx` | Admin interface |
| `/more` | `app/more/page.tsx` | More options |

**Key component directories:**
- `components/layout/` - Header, BottomNav, PageLayout
- `components/ui/` - shadcn/ui primitives (button, card, sheet, tabs, etc.)
- `components/filters/` - FilterBar, CityPicker, NearMeToggle, LocationFilter
- `components/feed/` - DiscoveryFeed
- `components/skeletons/` - Loading skeleton components
- `components/micro-interactions/` - Toast notifications

**Custom hooks:** `useGeolocation`, `useLocationFilter`, `use-toast`

### API (api/)

- **Primary**: Express.js 5.2.1 with CORS, Helmet, Morgan logging, Swagger docs
- **Alternative**: FastAPI (Python) in `api/main.py` - used in Docker/Railway deployment
- **Auth**: JWT-based admin authentication with bcrypt

**Key Endpoints:**

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | API health check |
| GET | `/api/restaurants` | List all restaurants |
| GET | `/api/restaurants/search` | Advanced search with filters |
| GET | `/api/restaurants/:id` | Get single restaurant |
| GET | `/api/episodes/search` | Episode search |
| GET | `/api/analytics/timeline` | Timeline analytics |
| GET | `/api/analytics/trends` | Trending analysis |
| GET | `/api/places/search` | Google Places search |
| GET | `/api/places/details/:placeId` | Place details |
| POST | `/api/analyze` | Analyze a YouTube video |
| POST | `/api/analyze/channel` | Analyze entire channel |
| GET | `/api/jobs` | List background jobs |
| GET | `/api/jobs/:jobId/status` | Job status |
| | `/api/admin/*` | Admin routes (auth required) |
| | `/api/admin/subscriptions/*` | Channel subscription management (auth required) |
| | `/api/admin/pipeline/*` | Pipeline queue, logs, stats (auth required) |

**Admin route modules** (`api/routes/`): `admin-articles.js`, `admin-restaurants.js`, `admin-audit.js`, `admin-videos.js`, `admin-analytics.js`, `admin-bulk.js`, `admin-auth.js`

**Admin Dashboard Pages:**

| Route | Description |
|-------|-------------|
| `/dashboard/subscriptions` | Channel/playlist subscription management |
| `/dashboard/pipeline` | Pipeline queue monitor with retry/skip/prioritize |
| `/dashboard/pipeline/logs` | Filterable pipeline event log viewer |

### Admin Dashboard (admin/)

Separate Next.js app for content management:
- Restaurant CRUD with TanStack Table
- Article management with Tiptap rich text editor
- Analytics dashboard with Recharts
- JWT-based authentication with protected routes
- Pipeline monitoring: subscription management, video queue, processing logs
- Runs on port 3001 by default

### Data Storage

| Path | Contents |
|------|----------|
| `data/where2eat.db` | SQLite database (primary storage). Tables: episodes, restaurants, jobs, subscriptions, video_queue, pipeline_logs, admin_users, admin_sessions, restaurant_edits, settings, articles |
| `data/restaurants/` | Individual restaurant JSON files |
| `data/restaurants_backup/` | Restaurant backup files (20+ Hebrew-named JSONs) |
| `transcripts/` | YouTube transcript cache |
| `analyses/` | Claude analysis outputs (JSON + markdown) |

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR to main:

1. **test-path-resolution** - Path resolution tests (fast, no external deps)
2. **test-python** - Python tests with pytest (depends on step 1)
3. **test-frontend** - Frontend lint + Next.js build (Node 20)
4. **test-api** - API syntax check (`node --check index.js`)

Additional workflows: `deploy.yml`, `pages.yml`, `scraper.yml`

## Deployment

### Railway (API)
- Docker-based deployment using `Dockerfile` (Python 3.11 slim)
- Runs FastAPI via uvicorn on port 8080
- Config in `railway.json`: restart on failure, max 10 retries
- Required env vars: `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`
- Optional: `OPENAI_API_KEY`, `ALLOWED_ORIGINS`

### Vercel (Frontend)
- Next.js frontend deployed to Vercel
- Required env var: `NEXT_PUBLIC_API_URL` (points to Railway API)
- Optional: `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`

## TDD Requirements

**All development must follow Test-Driven Development:**

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass the test
3. **Refactor**: Improve code while tests pass

- Tests must fail initially before implementation
- Maintain >90% test coverage for new code
- Test naming: `test_[method]_[scenario]_[expected_result]`
- Use pytest with mocking for external APIs
- Frontend tests use Jest with React Testing Library

### Test Files (tests/)

| File | Coverage |
|------|----------|
| `test_youtube_transcript.py` | Transcript collector (caching, rate limiting, health) |
| `test_youtube_channel_collector.py` | Channel processing |
| `test_database.py` | Database persistence |
| `test_data_persistence.py` | Data persistence validation |
| `test_backend_service.py` | Service layer |
| `test_api_server.py` | API endpoints |
| `test_restaurant_extraction.py` | Restaurant extraction |
| `test_restaurant_search_agent.py` | Search agent |
| `test_unified_restaurant_analyzer.py` | Unified analyzer |
| `test_channel_batch_processor.py` | Batch processing |
| `test_pipeline_integration.py` | End-to-end pipeline |
| `test_path_resolution.py` | Path resolution |
| `test_subscription_manager.py` | Subscription CRUD, URL resolution |
| `test_video_queue_manager.py` | Queue operations, scheduling, retry |
| `test_pipeline_logger.py` | Pipeline logging, filtering, rotation |
| `test_pipeline_scheduler.py` | Scheduler orchestration, polling, processing |
| `test_auto_pipeline_integration.py` | End-to-end pipeline flow integration |

Frontend tests are in `web/src/components/__tests__/` and `web/src/lib/__tests__/`.

## Key Dependencies

### Python
- `youtube-transcript-api>=1.0.0` - Transcript fetching (no auth required)
- `openai==1.54.4` - OpenAI API client
- `google-api-python-client==2.108.0` - Google APIs (Places, Maps)
- `google-auth-httplib2==0.2.0`, `google-auth-oauthlib==1.1.0` - Google auth
- `python-dotenv==1.0.0` - Environment variables
- `apscheduler>=3.10.0` - Background job scheduling for auto video pipeline

### Frontend (web/)
- `next@16.1.1`, `react@19.2.3` - Framework
- `tailwindcss@4` with `@tailwindcss/postcss` - Styling
- `framer-motion@12.25.0` - Animations
- `@radix-ui/*` - Accessible UI primitives (dialog, tabs, separator, alert-dialog, slot)
- `lucide-react@0.562.0` - Icons
- `embla-carousel-react`, `react-masonry-css`, `react-window` - Layout
- `@vercel/analytics` - Analytics
- `jest@30.2.0`, `@testing-library/react@16.3.1` - Testing

### API (api/)
- `express@5.2.1` - HTTP framework
- `helmet@8.1.0` - Security headers
- `cors`, `morgan` - Middleware
- `jsonwebtoken`, `bcrypt` - Authentication
- `swagger-jsdoc`, `swagger-ui-express` - API docs
- `multer` - File uploads
- `express-validator` - Input validation

### Admin (admin/)
- `next@16.1.1`, `react@19` - Framework
- `@tanstack/react-query`, `@tanstack/react-table` - Data management
- `@tiptap/react` + extensions - Rich text editor
- `recharts` - Charts
- `react-hook-form`, `zod` - Form validation

## Environment Variables

Required in `.env`:
- `ANTHROPIC_API_KEY` - Claude API for restaurant analysis
- `GOOGLE_PLACES_API_KEY` - Google Places for location data
- `OPENAI_API_KEY` (optional) - Alternative to Claude

Frontend (`web/.env.local`):
- `NEXT_PUBLIC_API_URL` - API server URL (default: `http://localhost:3001`)
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (optional) - Google Maps in frontend

Admin (`admin/.env.production`):
- `NEXT_PUBLIC_API_URL` - API server URL

Pipeline scheduler (optional, in `.env`):
- `PIPELINE_POLL_INTERVAL_HOURS` (default: 12)
- `PIPELINE_PROCESS_INTERVAL_MINUTES` (default: 60)
- `PIPELINE_SCHEDULER_ENABLED` (default: true)
- `PIPELINE_MAX_INITIAL_VIDEOS` (default: 50)

Claude Code MCP tokens (in `.env`):
- `GITHUB_TOKEN` - GitHub MCP server
- `VERCEL_TOKEN` - Vercel MCP server
- `RAILWAY_TOKEN` - Railway MCP server

## Claude Code Configuration

### Custom Skills (`.claude/skills/`)
- **senior-frontend** - Frontend patterns, component generation, bundle analysis
- **senior-backend** - API design, database migrations, load testing
- **code-reviewer** - Code quality checking, PR analysis, review reports
- **webapp-testing** - Web application testing strategies
- **frontend-design** / **frontend-designer** - UI/UX with Next.js 16, React 19, Tailwind v4

### Agent Roles (`.claude/`)
- `fullstack-developer.md`, `frontend-developer.md`, `backend-architect.md`
- `ui-ux-designer.md`, `context-manager.md`, `debugger.md`

### MCP Servers (`.claude/mcp-servers/`)
- **GitHub** (`@modelcontextprotocol/server-github`) - PRs, issues, repository access
- **Vercel** (`vercel_server.py`) - Deployments, env vars, build logs
- **Railway** (`railway_server.py`) - Services, variables, deployment logs
- **SQLite** (`@modelcontextprotocol/server-sqlite`) - Query `data/where2eat.db`

```bash
# Setup MCP dependencies
pip install -r .claude/mcp-servers/requirements.txt
```

## Conventions

- **Language**: Hebrew is the primary UI language; code and comments are in English
- **RTL Layout**: Frontend uses RTL direction for Hebrew support
- **Component library**: shadcn/ui with Radix primitives - add new components via shadcn CLI
- **Styling**: Tailwind CSS 4 with `tw-animate-css` for animations
- **API proxy**: Frontend has a Next.js API route at `web/src/app/api/restaurants/route.ts`
- **Module system**: API uses CommonJS (`"type": "commonjs"` in api/package.json)
- **Python path**: Docker sets `PYTHONPATH="/app/src"` for imports from `src/`

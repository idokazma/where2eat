# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Where2Eat is a restaurant discovery system that scrapes YouTube podcasts (primarily Hebrew food content), extracts restaurant mentions using AI analysis, and presents location-based recommendations. The system has three main components: Python scrapers/analyzers, an Express.js API, and a Next.js frontend.

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
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

### Express API (api/)

```bash
cd api
npm run dev      # Start with nodemon
npm start        # Production start
```

## Architecture

### Data Flow
```
YouTube URL → Transcript Collector → AI Analyzer → SQLite Database → Express API → Frontend
```

### Backend Service Layer (NEW)

The backend now has a proper service layer with clear separation:

- `src/database.py` - SQLite database layer for persistence
- `src/backend_service.py` - Main service layer coordinating all backend operations
- `scripts/cli.py` - Command-line interface for backend operations

**CLI Usage:**
```bash
# Process a YouTube video
python scripts/cli.py process-video 'https://www.youtube.com/watch?v=VIDEO_ID'

# List restaurants with filters
python scripts/cli.py list-restaurants --location "תל אביב" --cuisine "Italian"

# Import from JSON files
python scripts/cli.py import-json data/restaurants_backup/

# Show database statistics
python scripts/cli.py stats

# System health check
python scripts/cli.py health

# Show analytics
python scripts/cli.py analytics trends --period 3months
```

### Core Python Modules (src/)

- `database.py` - SQLite database with episodes, restaurants, and jobs tables
- `backend_service.py` - Unified service layer for all backend operations
- `youtube_transcript_collector.py` - **Enhanced** YouTube transcript fetcher with:
  - **Database caching** - Checks cache before making API requests
  - **Rate limiting** - Enforces 1 request per 30 seconds (configurable)
  - **Health checks** - API connectivity monitoring
  - Non-blocking rate limiter using threading
- `youtube_channel_collector.py` - Processes entire YouTube channels
- `claude_restaurant_analyzer.py` / `openai_restaurant_analyzer.py` - AI-based restaurant extraction from transcripts
- `unified_restaurant_analyzer.py` - Unified interface for multiple LLM providers
- `restaurant_search_agent.py` - Enhanced restaurant search with Google Places
- `restaurant_location_collector.py` - Geocoding and Google Business data
- `restaurant_image_collector.py` - Restaurant photo collection
- `map_integration.py` - GeoJSON and map visualization generation
- `channel_batch_processor.py` - Batch processing for channels

### Frontend (web/)
- Next.js 16 with React 19, TypeScript, Tailwind CSS
- Uses shadcn/ui components (Radix primitives)
- App router in `web/src/app/`
- **Configurable API URL** via `NEXT_PUBLIC_API_URL` environment variable
- API configuration in `web/src/lib/config.ts`

### API (api/)
- Express.js with CORS, Helmet security
- Single `index.js` file
- Calls backend service layer for data operations

**Key Endpoints:**
- `GET /health` - API server health check
- `GET /api/youtube-transcript/health` - YouTube transcript collector health check
- `GET /api/restaurants` - List all restaurants
- `GET /api/restaurants/search` - Advanced restaurant search with filters
- `POST /api/analyze` - Analyze a YouTube video
- `POST /api/analyze/channel` - Process an entire YouTube channel

### Data Storage
- `data/where2eat.db` - SQLite database (primary storage)
- `data/restaurants/` - Individual restaurant JSON files (for import/export)
- `data/transcripts/` - Raw transcript data
- `analyses/` - Claude analysis markdown outputs
- `restaurant_locations/` - Location search results
- `map_integration/` - GeoJSON and HTML map outputs

## TDD Requirements

**All development must follow Test-Driven Development:**

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to pass the test
3. **Refactor**: Improve code while tests pass

- Tests must fail initially before implementation
- Maintain >90% test coverage for new code
- Test naming: `test_[method]_[scenario]_[expected_result]`
- Use pytest with mocking for external APIs

**Recent TDD Implementation:**
The YouTube transcript collector was enhanced following TDD:
- Added caching tests → Implemented database caching
- Added rate limiting tests → Implemented 30-second rate limiter
- Added health check tests → Implemented API connectivity monitoring
- All features tested before implementation ✓

## Key Dependencies

**Python:**
- `youtube-transcript-api` - Transcript fetching (no auth required)
- `openai` - OpenAI API client
- `google-api-python-client` - Google APIs (Places, Maps)
- `python-dotenv` - Environment variables

**Frontend:**
- Radix UI primitives for accessible components
- `lucide-react` for icons
- Tailwind with `tw-animate-css`

## Claude Code Enhancements

This project includes custom Claude Code configuration to enhance development:

### Custom Skills
- **Frontend Designer** (`.claude/skills/frontend-designer/`) - Expert knowledge of the Next.js 16, React 19, Tailwind v4 stack with project-specific design patterns

### MCP Servers
Model Context Protocol servers provide Claude with real-time access to external tools:

- **GitHub MCP** - Create PRs, manage issues, read repository files
- **Vercel MCP** - Deploy, manage environment variables, view build logs
- **Railway MCP** - Deploy services, configure variables, view logs
- **SQLite MCP** - Query the restaurant database with natural language

**Setup:**
```bash
# Install Python MCP dependencies
pip install -r .claude/mcp-servers/requirements.txt

# Configure API tokens in .env
GITHUB_TOKEN=ghp_xxx
VERCEL_TOKEN=xxx
RAILWAY_TOKEN=xxx
```

**Usage Examples:**
```
"Show my recent Vercel deployments"
"Query restaurants in Tel Aviv with rating > 4.0"
"Create a pull request for my frontend changes"
"Get Railway deployment logs"
```

See `.claude/README.md` for full documentation.

## Environment Variables

Required API keys (in `.env`):
- Claude API key for restaurant analysis
- Google Places API key for location data
- OpenAI API key (alternative to Claude)
- **GitHub token** (for Claude Code GitHub MCP)
- **Vercel token** (for Claude Code Vercel MCP)
- **Railway token** (for Claude Code Railway MCP)

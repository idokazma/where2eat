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

# Process a transcript file (when YouTube API is blocked)
python scripts/cli.py process-transcript path/to/transcript.txt

# Process multiple transcript files from a folder
python scripts/cli.py process-transcripts path/to/transcripts/ --recursive

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

**Supported Transcript Formats:**
- `.txt` - Plain text transcript
- `.json` - JSON with 'transcript' or 'segments' field
- `.srt` - SubRip subtitle format
- `.vtt` - WebVTT subtitle format

### Core Python Modules (src/)

- `database.py` - SQLite database with episodes, restaurants, and jobs tables
- `backend_service.py` - Unified service layer for all backend operations
- `transcript_file_loader.py` - Loads transcript files from disk (txt, json, srt, vtt)
- `youtube_transcript_collector.py` - Fetches YouTube transcripts using youtube-transcript-api
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

## Environment Variables

Required API keys (in `.env`):
- Claude API key for restaurant analysis
- Google Places API key for location data
- OpenAI API key (alternative to Claude)

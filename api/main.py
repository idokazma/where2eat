"""
Where2Eat FastAPI Server

A restaurant discovery API that extracts restaurant mentions from YouTube podcasts.
"""

import os
import sys
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path for Python imports
SRC_DIR = (Path(__file__).parent.parent / "src").resolve()
sys.path.insert(0, str(SRC_DIR))

from models.analyze import DEFAULT_VIDEO_URL

# Import routers
from routers import (
    restaurants_router,
    analytics_router,
    analyze_router,
    places_router,
    health_router,
    admin_router,
)


async def fetch_default_video_on_startup():
    """Fetch and analyze the default video on server startup."""
    print(f"\n{'='*60}")
    print(f"Starting up: Fetching and analyzing default video...")
    print(f"URL: {DEFAULT_VIDEO_URL}")
    print(f"{'='*60}\n")

    try:
        from youtube_transcript_collector import YouTubeTranscriptCollector
        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
        from datetime import datetime
        import json
        import uuid

        collector = YouTubeTranscriptCollector()
        result = collector.get_transcript(DEFAULT_VIDEO_URL, languages=['he', 'iw', 'en'])

        if result:
            print(f"[STARTUP] Successfully fetched transcript for default video")
            print(f"[STARTUP] Video ID: {result.get('video_id')}")
            print(f"[STARTUP] Language: {result.get('language')}")
            print(f"[STARTUP] Segments: {result.get('segment_count', 0)}")
            print(f"[STARTUP] Transcript length: {len(result.get('transcript', ''))} chars")
            print(f"[STARTUP] Cached: {result.get('cached', False)}")

            # Preview first 200 chars of transcript
            transcript_preview = result.get('transcript', '')[:200]
            print(f"[STARTUP] Preview: {transcript_preview}...")

            # Analyze the transcript
            print(f"[STARTUP] Analyzing transcript with LLM...")
            analyzer = UnifiedRestaurantAnalyzer()
            analysis_result = analyzer.analyze_transcript({
                'video_id': result.get('video_id'),
                'video_url': DEFAULT_VIDEO_URL,
                'language': result.get('language', 'he'),
                'transcript': result.get('transcript', '')
            })

            # Save restaurants to JSON files
            restaurants = analysis_result.get('restaurants', [])
            data_dir = Path(__file__).parent.parent / "data" / "restaurants"
            data_dir.mkdir(parents=True, exist_ok=True)

            saved_count = 0
            for restaurant in restaurants:
                restaurant_id = str(uuid.uuid4())
                restaurant_data = {
                    'id': restaurant_id,
                    'name_hebrew': restaurant.get('name_hebrew', ''),
                    'name_english': restaurant.get('name_english', ''),
                    'location': restaurant.get('location', {}),
                    'cuisine_type': restaurant.get('cuisine_type', ''),
                    'status': restaurant.get('status', ''),
                    'price_range': restaurant.get('price_range', ''),
                    'host_opinion': restaurant.get('host_opinion', ''),
                    'host_comments': restaurant.get('host_comments', ''),
                    'menu_items': restaurant.get('menu_items', []),
                    'special_features': restaurant.get('special_features', []),
                    'contact_info': restaurant.get('contact_info', {}),
                    'business_news': restaurant.get('business_news'),
                    'mention_context': restaurant.get('mention_context', ''),
                    'episode_info': analysis_result.get('episode_info', {}),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }

                file_path = data_dir / f"{restaurant_id}.json"
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(restaurant_data, f, ensure_ascii=False, indent=2)
                saved_count += 1

            print(f"[STARTUP] Analysis complete: found {len(restaurants)} restaurants, saved {saved_count}")
            print(f"\n{'='*60}")
            print(f"Server ready! Default video analyzed and {saved_count} restaurants loaded.")
            print(f"{'='*60}\n")
        else:
            print(f"[STARTUP] Warning: Could not fetch transcript for default video")
            print(f"[STARTUP] Server will continue without preloaded data")

    except Exception as e:
        print(f"[STARTUP] Error analyzing default video: {e}")
        import traceback
        traceback.print_exc()

        # Fallback: import from existing analyses if available
        print(f"[STARTUP] Attempting to import from existing analyses...")
        try:
            analyses_dir = Path(__file__).parent.parent / "analyses"
            data_dir = Path(__file__).parent.parent / "data" / "restaurants"
            data_dir.mkdir(parents=True, exist_ok=True)

            imported = 0
            for analysis_file in analyses_dir.glob('*_analysis.json'):
                if 'test' in analysis_file.name:
                    continue
                try:
                    with open(analysis_file, 'r', encoding='utf-8') as f:
                        analysis = json.load(f)

                    episode_info = analysis.get('episode_info', {})
                    restaurants = analysis.get('restaurants', [])

                    for restaurant in restaurants:
                        restaurant_id = str(uuid.uuid4())
                        restaurant_data = {
                            'id': restaurant_id,
                            'name_hebrew': restaurant.get('name_hebrew', ''),
                            'name_english': restaurant.get('name_english', ''),
                            'location': restaurant.get('location', {}),
                            'cuisine_type': restaurant.get('cuisine_type', ''),
                            'status': restaurant.get('status', ''),
                            'price_range': restaurant.get('price_range', ''),
                            'host_opinion': restaurant.get('host_opinion', ''),
                            'host_comments': restaurant.get('host_comments', ''),
                            'menu_items': restaurant.get('menu_items', []),
                            'special_features': restaurant.get('special_features', []),
                            'contact_info': restaurant.get('contact_info', {}),
                            'business_news': restaurant.get('business_news'),
                            'mention_context': restaurant.get('mention_context', ''),
                            'episode_info': episode_info,
                            'created_at': datetime.now().isoformat(),
                            'updated_at': datetime.now().isoformat()
                        }

                        file_path = data_dir / f'{restaurant_id}.json'
                        with open(file_path, 'w', encoding='utf-8') as f:
                            json.dump(restaurant_data, f, ensure_ascii=False, indent=2)
                        imported += 1
                except Exception as import_err:
                    print(f"[STARTUP] Error importing {analysis_file.name}: {import_err}")

            if imported > 0:
                print(f"[STARTUP] Imported {imported} restaurants from existing analyses")
                print(f"\n{'='*60}")
                print(f"Server ready! {imported} restaurants loaded from cache.")
                print(f"{'='*60}\n")
            else:
                print(f"[STARTUP] No existing analyses found to import")
                print(f"[STARTUP] Server will continue without preloaded data")
        except Exception as fallback_err:
            print(f"[STARTUP] Fallback import failed: {fallback_err}")
            print(f"[STARTUP] Server will continue without preloaded data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup: fetch default video
    await fetch_default_video_on_startup()
    yield
    # Shutdown: cleanup if needed
    print("[SHUTDOWN] Server shutting down...")


# Create FastAPI app with metadata for docs
app = FastAPI(
    lifespan=lifespan,
    title="Where2Eat API",
    description="""
## Restaurant Discovery API

Where2Eat extracts restaurant mentions from YouTube food podcasts and presents
location-based recommendations.

### Features

- **Restaurant Search**: Search and filter restaurants by location, cuisine, price range
- **Analytics**: Timeline and trend analytics for restaurant discoveries
- **Video Analysis**: Analyze YouTube videos and channels for restaurant mentions
- **Places Integration**: Google Places API integration for location data
- **Admin Panel**: Manage restaurants, users, and content

### Authentication

Admin endpoints require JWT authentication. Use `/api/admin/auth/login` to obtain a token.

### Quick Start

```bash
# Health check
curl http://localhost:8000/health

# List restaurants
curl http://localhost:8000/api/restaurants

# Search restaurants
curl "http://localhost:8000/api/restaurants/search?location=Tel+Aviv&cuisine=Italian"
```
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    contact={
        "name": "Where2Eat Team",
    },
    license_info={
        "name": "MIT",
    },
)

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://where2eat.vercel.app",
    "https://where2eat-delta.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(restaurants_router)
app.include_router(analytics_router)
app.include_router(analyze_router)
app.include_router(places_router)
app.include_router(admin_router)


@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint - redirects to docs."""
    return {
        "message": "Where2Eat API",
        "version": "2.0.0",
        "docs": "/docs",
        "redoc": "/redoc",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )

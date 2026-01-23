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
SRC_DIR = Path(__file__).parent.parent / "src"
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
    print(f"Starting up: Fetching default video...")
    print(f"URL: {DEFAULT_VIDEO_URL}")
    print(f"{'='*60}\n")

    try:
        from youtube_transcript_collector import YouTubeTranscriptCollector

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
            print(f"\n{'='*60}")
            print(f"Server ready! Default video loaded successfully.")
            print(f"{'='*60}\n")
        else:
            print(f"[STARTUP] Warning: Could not fetch transcript for default video")
            print(f"[STARTUP] Server will continue without preloaded data")

    except Exception as e:
        print(f"[STARTUP] Error fetching default video: {e}")
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

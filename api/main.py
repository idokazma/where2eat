"""
Where2Eat FastAPI Server

A restaurant discovery API that extracts restaurant mentions from YouTube podcasts.
"""

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path for Python imports
SRC_DIR = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))

# Import routers
from routers import (
    restaurants_router,
    analytics_router,
    analyze_router,
    places_router,
    health_router,
    admin_router,
)

# Create FastAPI app with metadata for docs
app = FastAPI(
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

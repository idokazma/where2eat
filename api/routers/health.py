"""Health check endpoints."""

import sys
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter

# Add src to path for imports
# Handle both local dev (api/routers/health.py) and Railway deployment
possible_src_paths = [
    Path("/app/src"),                              # Railway absolute path (highest priority)
    Path(__file__).parent.parent.parent / "src",  # Local: api/routers/../../src
    Path(__file__).parent.parent / "src",          # Fallback: /app/routers/../src
]
for src_path in possible_src_paths:
    if src_path.exists() and str(src_path.resolve()) not in sys.path:
        sys.path.insert(0, str(src_path.resolve()))
        break

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Health check",
    description="Basic health check endpoint.",
)
async def health_check():
    """Basic health check."""
    return {
        "status": "OK",
        "timestamp": datetime.now().isoformat(),
    }


@router.get(
    "/api/youtube-transcript/health",
    summary="YouTube transcript health check",
    description="Check YouTube transcript collector connectivity and status.",
)
async def youtube_transcript_health():
    """Check YouTube transcript collector health."""
    try:
        from youtube_transcript_collector import YouTubeTranscriptCollector

        collector = YouTubeTranscriptCollector()
        health = collector.health_check()
        return health
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now().isoformat(),
        }

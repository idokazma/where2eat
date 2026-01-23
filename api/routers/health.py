"""Health check endpoints."""

import sys
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter

# Add src to path for imports
SRC_DIR = (Path(__file__).parent.parent.parent / "src").resolve()
sys.path.insert(0, str(SRC_DIR))

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

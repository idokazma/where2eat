"""Video analysis API endpoints."""

import sys
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks

from models.analyze import (
    AnalyzeVideoRequest,
    AnalyzeChannelRequest,
    AnalyzeResponse,
    ChannelAnalyzeResponse,
    JobStatus,
    JobResults,
    JobListResponse,
    DEFAULT_VIDEO_URL,
)

# Add src to path for imports
# Handle both local dev (api/routers/analyze.py) and Railway deployment
possible_src_paths = [
    Path("/app/src"),                              # Railway absolute path (highest priority)
    Path(__file__).parent.parent.parent / "src",  # Local: api/routers/../../src
    Path(__file__).parent.parent / "src",          # Fallback: /app/routers/../src
]
for src_path in possible_src_paths:
    if src_path.exists() and str(src_path.resolve()) not in sys.path:
        sys.path.append(str(src_path.resolve()))
        break

router = APIRouter(tags=["Analysis"])


async def run_video_analysis(url: str):
    """Run video analysis in background using BackendService."""
    try:
        from backend_service import BackendService
        service = BackendService()
        result = service.process_video(
            video_url=url,
            enrich_with_google=True,
        )
        if result.get('success'):
            count = result.get('restaurants_found', 0)
            print(f"[ANALYSIS] Completed for {url}: {count} restaurants found")
        else:
            print(f"[ANALYSIS] Failed for {url}: {result.get('error')}")
    except Exception as e:
        print(f"[ANALYSIS] Failed for {url}: {e}")
        import traceback
        traceback.print_exc()


async def run_channel_analysis(channel_url: str, filters: dict, options: dict):
    """Run channel analysis in background."""
    try:
        from youtube_channel_collector import YouTubeChannelCollector

        collector = YouTubeChannelCollector()
        # Channel processing would happen here
        print(f"Channel analysis started for {channel_url}")
    except Exception as e:
        print(f"Channel analysis failed for {channel_url}: {e}")


@router.post(
    "/api/analyze",
    response_model=AnalyzeResponse,
    status_code=202,
    summary="Analyze YouTube video",
    description=f"Start analysis of a YouTube video to extract restaurant mentions. Default: {DEFAULT_VIDEO_URL}",
)
async def analyze_video(
    request: AnalyzeVideoRequest,
    background_tasks: BackgroundTasks,
):
    """Analyze a YouTube video for restaurant mentions."""
    # Use default URL if not provided
    url = request.url or DEFAULT_VIDEO_URL

    if "youtube.com" not in url and "youtu.be" not in url:
        raise HTTPException(status_code=400, detail="Valid YouTube URL required")

    # Start background analysis
    background_tasks.add_task(run_video_analysis, url)

    return AnalyzeResponse(
        message="Analysis started successfully",
        status="processing",
        url=url,
    )


@router.post(
    "/api/analyze/channel",
    response_model=ChannelAnalyzeResponse,
    status_code=202,
    summary="Analyze YouTube channel",
    description="Start analysis of an entire YouTube channel.",
)
async def analyze_channel(
    request: AnalyzeChannelRequest,
    background_tasks: BackgroundTasks,
):
    """Analyze a YouTube channel for restaurant mentions."""
    valid_patterns = [
        "youtube.com/channel",
        "youtube.com/c/",
        "youtube.com/user/",
        "youtube.com/@",
    ]
    if not any(p in request.channel_url for p in valid_patterns):
        raise HTTPException(status_code=400, detail="Valid YouTube channel URL required")

    job_id = str(uuid.uuid4())
    filters = request.filters or {}
    options = request.processing_options or {}

    # Start background analysis
    background_tasks.add_task(run_channel_analysis, request.channel_url, filters, options)

    max_results = filters.get("max_results", 50)
    batch_size = options.get("batch_size", 5)
    estimated_duration = (max_results * 2) // batch_size

    return ChannelAnalyzeResponse(
        job_id=job_id,
        message="Channel analysis started successfully",
        status="started",
        channel_url=request.channel_url,
        filters=filters,
        processing_options=options,
        estimated_duration_minutes=estimated_duration,
    )


@router.get(
    "/api/jobs",
    response_model=JobListResponse,
    summary="List jobs",
    description="List all analysis jobs with optional status filter.",
)
async def list_jobs(
    status: Optional[str] = Query(None, description="Filter by job status"),
):
    """List analysis jobs from the database."""
    try:
        from database import get_database
        db = get_database()

        with db.get_connection() as conn:
            cursor = conn.cursor()

            if status:
                cursor.execute(
                    "SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT 50",
                    (status,),
                )
            else:
                cursor.execute(
                    "SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50"
                )

            rows = cursor.fetchall()
            jobs = []
            for row in rows:
                row_dict = dict(row)
                completed = row_dict.get("progress_videos_completed", 0)
                total = row_dict.get("progress_videos_total", 0)
                percentage = (completed / total * 100) if total > 0 else 0.0
                jobs.append({
                    "job_id": row_dict.get("id", ""),
                    "status": row_dict.get("status", "unknown"),
                    "channel_info": {
                        "channel_url": row_dict.get("channel_url", ""),
                        "video_url": row_dict.get("video_url", ""),
                    },
                    "progress": {
                        "videos_completed": completed,
                        "videos_total": total,
                        "percentage": round(percentage, 1),
                    },
                    "started_at": row_dict.get("started_at", row_dict.get("created_at", "")),
                })

            return JobListResponse(jobs=jobs, count=len(jobs))
    except Exception:
        # If jobs table doesn't exist or query fails, return empty list
        return JobListResponse(jobs=[], count=0)


@router.get(
    "/api/jobs/{job_id}/status",
    response_model=JobStatus,
    summary="Get job status",
    description="Get the current status and progress of an analysis job.",
)
async def get_job_status(job_id: str):
    """Get job status and progress."""
    # Mock status for now
    return JobStatus(
        job_id=job_id,
        status="processing",
        progress={
            "videos_completed": 5,
            "videos_total": 20,
            "videos_failed": 1,
            "restaurants_found": 12,
            "current_video": {
                "title": "Processing video...",
                "progress": "analyzing_transcript",
            },
        },
        estimated_completion=(datetime.now() + timedelta(minutes=30)).isoformat(),
        started_at=datetime.now().isoformat(),
    )


@router.get(
    "/api/jobs/{job_id}/results",
    response_model=JobResults,
    summary="Get job results",
    description="Get the results of a completed analysis job.",
)
async def get_job_results(job_id: str):
    """Get job results."""
    # Mock results for now
    return JobResults(
        job_id=job_id,
        status="completed",
        summary={
            "videos_processed": 18,
            "videos_failed": 2,
            "restaurants_found": 45,
            "processing_duration_minutes": 87,
        },
        statistics={
            "top_cuisines": [
                {"cuisine": "Mediterranean", "count": 12},
                {"cuisine": "Italian", "count": 8},
            ],
            "top_cities": [
                {"city": "Tel Aviv", "count": 20},
                {"city": "Jerusalem", "count": 15},
            ],
        },
        failed_videos=[
            {
                "video_id": "abc123",
                "title": "Video Title",
                "error": "Transcript not available",
            }
        ],
    )


@router.delete(
    "/api/jobs/{job_id}",
    summary="Cancel job",
    description="Cancel a running analysis job.",
)
async def cancel_job(job_id: str):
    """Cancel a running job."""
    # Mock cancellation
    return {
        "job_id": job_id,
        "status": "cancelled",
        "message": "Job cancelled successfully",
    }


@router.post(
    "/api/reenrich",
    summary="Re-enrich restaurants",
    description="Re-enrich all restaurants missing Google Places data (coordinates, photos, ratings).",
)
async def reenrich_restaurants(background_tasks: BackgroundTasks):
    """Re-enrich all un-enriched restaurants with Google Places data."""
    async def _run_reenrich():
        try:
            from backend_service import BackendService
            service = BackendService()
            result = service.reenrich_all_restaurants()
            print(f"[RE-ENRICH] Done: {result}")
        except Exception as e:
            print(f"[RE-ENRICH] Failed: {e}")
            import traceback
            traceback.print_exc()

    background_tasks.add_task(_run_reenrich)
    return {"message": "Re-enrichment started", "status": "processing"}

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
)

# Add src to path for imports
SRC_DIR = Path(__file__).parent.parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))

router = APIRouter(tags=["Analysis"])


async def run_video_analysis(url: str):
    """Run video analysis in background."""
    try:
        from youtube_transcript_collector import YouTubeTranscriptCollector
        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer

        collector = YouTubeTranscriptCollector()
        result = collector.get_transcript(url, languages=['he', 'iw', 'en'])

        if result:
            analyzer = UnifiedRestaurantAnalyzer()
            # Analysis would happen here
            print(f"Analysis completed for {url}")
    except Exception as e:
        print(f"Analysis failed for {url}: {e}")


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
    description="Start analysis of a YouTube video to extract restaurant mentions.",
)
async def analyze_video(
    request: AnalyzeVideoRequest,
    background_tasks: BackgroundTasks,
):
    """Analyze a YouTube video for restaurant mentions."""
    if "youtube.com" not in request.url and "youtu.be" not in request.url:
        raise HTTPException(status_code=400, detail="Valid YouTube URL required")

    # Start background analysis
    background_tasks.add_task(run_video_analysis, request.url)

    return AnalyzeResponse(
        message="Analysis started successfully",
        status="processing",
        url=request.url,
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
    """List active analysis jobs."""
    # Mock jobs for now - would be replaced with actual job tracking
    mock_jobs = [
        {
            "job_id": "123e4567-e89b-12d3-a456-426614174000",
            "status": "processing",
            "channel_info": {
                "channel_title": "Food Channel",
                "channel_id": "UCtest123",
            },
            "progress": {
                "videos_completed": 15,
                "videos_total": 50,
                "percentage": 30.0,
            },
            "started_at": datetime.now().isoformat(),
        }
    ]

    if status:
        mock_jobs = [j for j in mock_jobs if j["status"] == status]

    return JobListResponse(jobs=mock_jobs, count=len(mock_jobs))


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

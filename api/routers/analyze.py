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
        sys.path.insert(0, str(src_path.resolve()))
        break

router = APIRouter(tags=["Analysis"])


async def run_video_analysis(url: str):
    """Run video analysis in background."""
    try:
        from youtube_transcript_collector import YouTubeTranscriptCollector
        from unified_restaurant_analyzer import UnifiedRestaurantAnalyzer
        import json
        from pathlib import Path
        import uuid

        collector = YouTubeTranscriptCollector()
        result = collector.get_transcript(url, languages=['he', 'iw', 'en'])

        if result:
            print(f"[ANALYSIS] Transcript fetched for {url}, analyzing...")
            analyzer = UnifiedRestaurantAnalyzer()

            # Actually analyze the transcript
            analysis_result = analyzer.analyze_transcript({
                'video_id': result.get('video_id'),
                'video_url': url,
                'language': result.get('language', 'he'),
                'transcript': result.get('transcript', '')
            })

            # Save restaurants to JSON files
            restaurants = analysis_result.get('restaurants', [])
            data_dir = Path(__file__).parent.parent.parent / "data" / "restaurants"
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

            print(f"[ANALYSIS] Completed for {url}: found {len(restaurants)} restaurants, saved {saved_count}")
        else:
            print(f"[ANALYSIS] No transcript found for {url}")
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

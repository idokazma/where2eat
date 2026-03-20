"""Admin pipeline management endpoints for FastAPI."""

import json
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends

from .admin import get_current_user, require_role

# Add src to path for imports
possible_src_paths = [
    Path("/app/src"),
    Path(__file__).parent.parent.parent / "src",
    Path(__file__).parent.parent / "src",
]
for src_path in possible_src_paths:
    if src_path.exists() and str(src_path.resolve()) not in sys.path:
        sys.path.insert(0, str(src_path.resolve()))
        break

router = APIRouter(prefix="/api/admin/pipeline", tags=["Admin - Pipeline"])


def _get_queue_manager():
    """Get VideoQueueManager instance."""
    from database import get_database
    from video_queue_manager import VideoQueueManager
    db = get_database()
    return VideoQueueManager(db)


def _get_pipeline_logger():
    """Get PipelineLogger instance."""
    from database import get_database
    from pipeline_logger import PipelineLogger
    db = get_database()
    return PipelineLogger(db)


@router.get(
    "",
    summary="Pipeline overview",
    description="Get pipeline queue depth, processing count, and status breakdown.",
)
async def pipeline_overview(
    user: dict = Depends(get_current_user),
):
    """Get pipeline overview stats."""
    try:
        from database import get_database
        db = get_database()

        with db.get_connection() as conn:
            cursor = conn.cursor()

            counts = {}
            for status in ["queued", "processing", "completed", "failed", "skipped"]:
                cursor.execute(
                    "SELECT COUNT(*) as count FROM video_queue WHERE status = ?",
                    (status,),
                )
                counts[status] = cursor.fetchone()["count"]

        return {
            "overview": {
                **counts,
                "total": sum(counts.values()),
            }
        }
    except Exception:
        return {
            "overview": {
                "queued": 0, "processing": 0, "completed": 0,
                "failed": 0, "skipped": 0, "total": 0,
            }
        }


@router.get(
    "/all-videos",
    summary="List all videos",
    description="Get paginated list of all videos with optional status and search filters.",
)
async def list_all_videos(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search title or channel"),
    subscription_id: Optional[str] = Query(None, description="Filter by subscription"),
    user: dict = Depends(get_current_user),
):
    """List all videos regardless of status."""
    queue_manager = _get_queue_manager()
    result = queue_manager.get_all_videos(
        page=page, limit=limit, status=status, search=search,
        subscription_id=subscription_id,
    )
    total = result["total"]
    return {
        "videos": result["items"],
        "status_summary": result["status_summary"],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": max(1, (total + limit - 1) // limit),
        },
    }


@router.get(
    "/queue",
    summary="List queued videos",
    description="Get paginated list of videos in the processing queue.",
)
async def list_queue(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """List queued videos."""
    queue_manager = _get_queue_manager()
    result = queue_manager.get_queue(page=page, limit=limit)
    total = result["total"]
    return {
        "queue": result["items"],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": max(1, (total + limit - 1) // limit),
        },
    }


@router.get(
    "/history",
    summary="List processed videos",
    description="Get paginated list of completed and failed videos.",
)
async def list_history(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """List completed/failed videos."""
    queue_manager = _get_queue_manager()
    result = queue_manager.get_history(page=page, limit=limit)
    total = result["total"]
    return {
        "history": result["items"],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": max(1, (total + limit - 1) // limit),
        },
    }


@router.get(
    "/logs",
    summary="Pipeline logs",
    description="Get filterable, paginated pipeline event logs.",
)
async def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    level: Optional[str] = Query(None, description="Filter by log level"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    user: dict = Depends(get_current_user),
):
    """Get pipeline logs."""
    pipeline_logger = _get_pipeline_logger()
    result = pipeline_logger.get_logs(
        level=level,
        event_type=event_type,
        page=page,
        limit=limit,
    )
    return {
        "logs": result["items"],
        "pagination": {
            "page": result["page"],
            "limit": result["limit"],
            "total": result["total"],
            "total_pages": max(1, (result["total"] + limit - 1) // limit),
        },
    }


@router.get(
    "/stats",
    summary="Pipeline statistics",
    description="Get pipeline processing statistics.",
)
async def pipeline_stats(
    user: dict = Depends(get_current_user),
):
    """Get pipeline statistics."""
    try:
        from database import get_database
        db = get_database()

        with db.get_connection() as conn:
            cursor = conn.cursor()

            # Status counts
            cursor.execute(
                "SELECT status, COUNT(*) as count FROM video_queue GROUP BY status"
            )
            status_counts = {row["status"]: row["count"] for row in cursor.fetchall()}

            # Average processing time
            cursor.execute("""
                SELECT AVG(
                    CAST((julianday(processing_completed_at) - julianday(processing_started_at)) * 86400 AS INTEGER)
                ) as avg_seconds
                FROM video_queue
                WHERE status = 'completed'
                  AND processing_completed_at IS NOT NULL
                  AND processing_started_at IS NOT NULL
            """)
            row = cursor.fetchone()
            avg_seconds = row["avg_seconds"] if row and row["avg_seconds"] else 0

            # Completed in last 24 hours
            cursor.execute("""
                SELECT COUNT(*) as count FROM video_queue
                WHERE status = 'completed'
                  AND processing_completed_at >= datetime('now', '-1 day')
            """)
            last_24h = cursor.fetchone()["count"]

            # Completed in last 7 days
            cursor.execute("""
                SELECT COUNT(*) as count FROM video_queue
                WHERE status = 'completed'
                  AND processing_completed_at >= datetime('now', '-7 days')
            """)
            last_7d = cursor.fetchone()["count"]

        total = sum(status_counts.values()) if status_counts else 0
        failed = status_counts.get("failed", 0)
        failure_rate = (failed / total * 100) if total > 0 else 0

        return {
            "stats": {
                "status_counts": status_counts,
                "avg_processing_seconds": round(avg_seconds, 1),
                "completed_last_24h": last_24h,
                "completed_last_7d": last_7d,
                "failure_rate_percent": round(failure_rate, 2),
                "total_items": total,
            }
        }
    except Exception:
        return {
            "stats": {
                "status_counts": {},
                "avg_processing_seconds": 0,
                "completed_last_24h": 0,
                "completed_last_7d": 0,
                "failure_rate_percent": 0,
                "total_items": 0,
            }
        }


@router.post(
    "/reset",
    summary="Reset all restaurant data",
    description="Delete all restaurants, episodes, video queue, and pipeline logs. "
                "Keeps subscriptions and admin users intact. Requires super_admin role.",
)
async def reset_data(
    user: dict = Depends(require_role(["super_admin"])),
):
    """Reset all restaurant data so videos can be re-analyzed from scratch."""
    try:
        import os
        from database import get_database

        db = get_database()
        deleted = {"restaurants": 0, "episodes": 0, "video_queue": 0, "pipeline_logs": 0}

        # 1. Clear SQLite tables (order matters due to foreign keys)
        with db.get_connection() as conn:
            cursor = conn.cursor()
            for table in ["restaurants", "episodes", "video_queue", "pipeline_logs"]:
                cursor.execute(f"SELECT COUNT(*) as cnt FROM {table}")
                count = cursor.fetchone()["cnt"]
                cursor.execute(f"DELETE FROM {table}")
                deleted[table] = count
            # Reset subscription stats so poll re-discovers videos
            cursor.execute(
                "UPDATE subscriptions SET "
                "last_checked_at = NULL, "
                "total_videos_found = 0, "
                "total_videos_processed = 0, "
                "total_restaurants_found = 0"
            )

        # 2. Clear PostgreSQL tables if DATABASE_URL is set
        pg_cleared = False
        if os.getenv("DATABASE_URL"):
            try:
                import importlib.util

                src_base_path = Path("/app/src/models/base.py")
                if not src_base_path.exists():
                    src_base_path = Path(__file__).parent.parent.parent / "src" / "models" / "base.py"

                if src_base_path.exists():
                    spec = importlib.util.spec_from_file_location("src_models_base_reset", src_base_path)
                    src_models_base = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(src_models_base)
                    get_db_session = src_models_base.get_db_session

                    src_restaurant_path = src_base_path.parent / "restaurant.py"
                    if src_restaurant_path.exists():
                        import types
                        models_package = types.ModuleType("models")
                        models_package.__path__ = [str(src_base_path.parent)]
                        models_package.__package__ = "models"
                        sys.modules["models"] = models_package
                        sys.modules["models.base"] = src_models_base
                        src_models_base.__package__ = "models"

                        spec2 = importlib.util.spec_from_file_location(
                            "models.restaurant", src_restaurant_path,
                            submodule_search_locations=[],
                        )
                        src_models_restaurant = importlib.util.module_from_spec(spec2)
                        src_models_restaurant.__package__ = "models"
                        spec2.loader.exec_module(src_models_restaurant)

                        with get_db_session() as session:
                            session.execute(
                                src_models_restaurant.RestaurantHistory.__table__.delete()
                            )
                            session.execute(
                                src_models_restaurant.Restaurant.__table__.delete()
                            )
                            session.execute(
                                src_models_restaurant.Episode.__table__.delete()
                            )
                            session.commit()
                        pg_cleared = True
            except Exception as pg_err:
                print(f"[RESET] PostgreSQL clear failed: {pg_err}")

        return {
            "success": True,
            "message": "All restaurant data cleared. Use POST /api/admin/pipeline/poll to re-fetch and re-queue videos.",
            "deleted": deleted,
            "postgresql_cleared": pg_cleared,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Reset failed: {str(e)}",
        )


@router.post(
    "/retry-all-failed",
    summary="Retry all failed videos",
    description="Reset all failed videos back to queued status. Requires admin role.",
)
async def retry_all_failed(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Retry all failed videos."""
    queue_manager = _get_queue_manager()
    result = queue_manager.retry_all_failed()
    return {
        "success": True,
        "message": f"Requeued {result['count']} failed videos",
        "count": result["count"],
    }


@router.post(
    "/clear-and-repoll",
    summary="Clear queue and re-poll",
    description="Clear all queued (not completed/processing) items and trigger a fresh poll. Requires admin role.",
)
async def clear_and_repoll(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Clear queued items and re-poll subscriptions."""
    try:
        from database import get_database
        from video_queue_manager import VideoQueueManager
        from pipeline_scheduler import PipelineScheduler

        db = get_database()
        queue_manager = VideoQueueManager(db)

        # Delete all queued items (not processing or completed)
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM video_queue WHERE status = 'queued'")
            cleared = cursor.fetchone()["count"]
            cursor.execute("DELETE FROM video_queue WHERE status = 'queued'")

        # Re-poll
        scheduler = PipelineScheduler(db=db)
        scheduler.poll_subscriptions()

        depth = queue_manager.get_queue_depth()

        return {
            "success": True,
            "cleared": cleared,
            "new_queue_depth": depth,
            "message": f"Cleared {cleared} queued items, re-polled. New queue depth: {depth}",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Clear and re-poll failed: {str(e)}",
        )


@router.get(
    "/{queue_id}/detail",
    summary="Get video detail with transcript",
    description="Get full details of a pipeline item including episode transcript and restaurants found.",
)
async def get_video_detail(
    queue_id: str,
    user: dict = Depends(get_current_user),
):
    """Get full video detail including transcript."""
    queue_manager = _get_queue_manager()
    video = queue_manager.get_video(queue_id)

    if not video:
        raise HTTPException(status_code=404, detail="Item not found")

    result = {
        "queue_item": video,
        "episode": None,
        "restaurants": [],
        "transcript": None,
        "transcript_length": 0,
    }

    # Parse error_log JSON if present
    if video.get("error_log"):
        try:
            result["queue_item"]["error_log"] = json.loads(video["error_log"])
        except (json.JSONDecodeError, TypeError):
            pass

    # If completed, fetch the linked episode with transcript
    episode_id = video.get("episode_id")
    if episode_id:
        from database import get_database
        db = get_database()
        episode = db.get_episode(episode_id=episode_id)
        if episode:
            transcript = episode.get("transcript", "")
            result["episode"] = {
                "id": episode["id"],
                "video_id": episode.get("video_id"),
                "video_url": episode.get("video_url"),
                "channel_name": episode.get("channel_name"),
                "title": episode.get("title"),
                "language": episode.get("language"),
                "analysis_date": episode.get("analysis_date"),
                "episode_summary": episode.get("episode_summary"),
                "food_trends": episode.get("food_trends", []),
            }
            result["transcript"] = transcript
            result["transcript_length"] = len(transcript) if transcript else 0

        # Fetch restaurants for this episode
        try:
            search_result = db.search_restaurants(
                episode_id=video.get("video_id"), limit=100
            )
            result["restaurants"] = search_result.get("restaurants", [])
        except Exception:
            pass

    return result


@router.post(
    "/poll",
    summary="Trigger immediate poll",
    description="Trigger an immediate poll of all active subscriptions. Requires admin role.",
)
async def trigger_poll(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Trigger immediate poll for all active subscriptions."""
    try:
        from database import get_database
        from pipeline_scheduler import PipelineScheduler

        db = get_database()
        scheduler = PipelineScheduler(db=db)
        scheduler.poll_subscriptions()

        queue_manager = _get_queue_manager()
        depth = queue_manager.get_queue_depth()

        return {
            "success": True,
            "message": "Poll completed",
            "queue_depth": depth,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Poll failed: {str(e)}",
        )


@router.post(
    "/reenrich",
    summary="Re-enrich restaurants missing Google Places data",
    description="Find restaurants without images or Google Places data and re-enrich them. "
                "Requires admin role.",
)
async def reenrich_restaurants(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Re-enrich restaurants missing Google Places data."""
    try:
        from backend_service import BackendService
        from database import get_database

        db = get_database()
        service = BackendService(db=db)
        result = service.reenrich_all_restaurants()
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Re-enrichment failed: {str(e)}",
        )


@router.post(
    "/upload-transcript",
    summary="Upload transcript for a video",
    description="Upload a locally-fetched transcript so the server can analyze it "
                "without calling YouTube. Requires admin role.",
)
async def upload_transcript(
    request: dict,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Upload a transcript fetched locally for server-side analysis."""
    video_id = request.get("video_id")
    transcript = request.get("transcript")
    language = request.get("language", "he")

    if not video_id or not transcript:
        raise HTTPException(status_code=400, detail="video_id and transcript are required")

    try:
        from database import get_database
        db = get_database()

        # Store the transcript as an episode so the pipeline can use it from cache
        episode_id = db.create_episode(
            video_id=video_id,
            video_url=f"https://www.youtube.com/watch?v={video_id}",
            language=language,
            transcript=transcript,
            analysis_date=None,
        )

        return {
            "success": True,
            "message": f"Transcript uploaded for {video_id}",
            "episode_id": episode_id,
            "transcript_length": len(transcript),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}",
        )


@router.post(
    "/upload-transcripts-batch",
    summary="Upload multiple transcripts",
    description="Upload locally-fetched transcripts in bulk. Requires admin role.",
)
async def upload_transcripts_batch(
    request: dict,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Upload multiple transcripts at once."""
    transcripts = request.get("transcripts", [])
    if not transcripts:
        raise HTTPException(status_code=400, detail="transcripts array is required")

    from database import get_database
    db = get_database()

    results = {"uploaded": 0, "failed": 0, "errors": []}
    for item in transcripts:
        video_id = item.get("video_id")
        transcript = item.get("transcript")
        language = item.get("language", "he")

        if not video_id or not transcript:
            results["failed"] += 1
            results["errors"].append(f"Missing video_id or transcript")
            continue

        try:
            db.create_episode(
                video_id=video_id,
                video_url=f"https://www.youtube.com/watch?v={video_id}",
                language=language,
                transcript=transcript,
                analysis_date=None,
            )
            results["uploaded"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{video_id}: {str(e)}")

    return {"success": True, **results}


@router.post(
    "/{queue_id}/retry",
    summary="Reprocess video",
    description="Requeue any video for (re)processing regardless of current status. Requires admin role.",
)
async def retry_video(
    queue_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Reprocess a video — works for any status (queued, failed, skipped, completed)."""
    queue_manager = _get_queue_manager()
    video = queue_manager.get_video(queue_id)

    if not video:
        raise HTTPException(status_code=404, detail="Item not found")
    if video["status"] == "processing":
        raise HTTPException(status_code=400, detail="Video is currently processing")

    from database import get_database
    db = get_database()
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE video_queue
               SET status = 'queued',
                   error_message = NULL,
                   processing_started_at = NULL,
                   processing_completed_at = NULL,
                   processing_steps = NULL,
                   attempt_count = 0,
                   scheduled_for = datetime('now')
               WHERE id = ?""",
            (queue_id,),
        )

    return {"success": True, "message": f"Video requeued for processing (was: {video['status']})"}


@router.post(
    "/{queue_id}/skip",
    summary="Skip queued video",
    description="Skip a queued video. Requires admin role.",
)
async def skip_video(
    queue_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Skip a queued video."""
    queue_manager = _get_queue_manager()
    video = queue_manager.get_video(queue_id)

    if not video:
        raise HTTPException(status_code=404, detail="Item not found")
    if video["status"] != "queued":
        raise HTTPException(status_code=400, detail="Only queued items can be skipped")

    queue_manager.skip_video(queue_id)
    return {"success": True, "message": "Video skipped"}


@router.post(
    "/{queue_id}/prioritize",
    summary="Prioritize video",
    description="Move a queued video to front of queue. Requires admin role.",
)
async def prioritize_video(
    queue_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Move video to front of queue."""
    queue_manager = _get_queue_manager()
    video = queue_manager.get_video(queue_id)

    if not video:
        raise HTTPException(status_code=404, detail="Item not found")
    if video["status"] != "queued":
        raise HTTPException(status_code=400, detail="Only queued items can be prioritized")

    queue_manager.prioritize(queue_id)
    return {"success": True, "message": "Video moved to front of queue"}


@router.post(
    "/enqueue",
    summary="Enqueue a video by ID",
    description="Add a video to the processing queue by its YouTube video ID.",
)
async def enqueue_video(
    body: dict,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Add a video to the queue for processing."""
    video_id = body.get("video_id")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id is required")

    priority = body.get("priority", 5)
    queue_manager = _get_queue_manager()
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    result = queue_manager.enqueue(
        video_id=video_id,
        video_url=video_url,
        priority=priority,
        video_title=body.get("title"),
        published_at=body.get("published_at"),
    )
    return {"success": True, "message": f"Enqueued {video_id}", "item": result}


@router.delete(
    "/{queue_id}",
    summary="Remove from queue",
    description="Remove a video from the queue. Requires admin role.",
)
async def remove_from_queue(
    queue_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Remove video from queue."""
    queue_manager = _get_queue_manager()
    success = queue_manager.remove(queue_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "message": "Video removed from queue"}


@router.get(
    "/subscription/{subscription_id}/videos",
    summary="Videos for a subscription",
    description="Get all videos associated with a specific subscription, including processing steps.",
)
async def subscription_videos(
    subscription_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    user: dict = Depends(get_current_user),
):
    """Get subscription metadata and its videos."""
    from database import get_database
    from subscription_manager import SubscriptionManager

    db = get_database()
    sub_mgr = SubscriptionManager(db)
    sub = sub_mgr.get_subscription(subscription_id)

    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    queue_manager = _get_queue_manager()
    result = queue_manager.get_all_videos(
        page=page, limit=limit, status=status,
        subscription_id=subscription_id,
    )

    return {
        "subscription": sub,
        "videos": result["items"],
        "status_summary": result["status_summary"],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": result["total"],
            "total_pages": max(1, (result["total"] + limit - 1) // limit),
        },
    }


# ==================== Scheduler Control ====================

def _get_scheduler():
    """Get the global pipeline scheduler instance from main."""
    try:
        from main import _pipeline_scheduler
        return _pipeline_scheduler
    except (ImportError, AttributeError):
        return None


@router.get(
    "/scheduler/status",
    summary="Scheduler status",
    description="Get detailed scheduler status including timing, intervals, and next run times.",
)
async def scheduler_status(
    user: dict = Depends(get_current_user),
):
    """Get scheduler status with detailed timing info."""
    scheduler = _get_scheduler()
    if scheduler is None:
        return {
            "running": False,
            "scheduler_enabled": False,
            "error": "Scheduler not initialized",
        }
    return scheduler.get_status()


@router.post(
    "/scheduler/start",
    summary="Start scheduler",
    description="Start the pipeline scheduler. Requires admin role.",
)
async def scheduler_start(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Start the pipeline scheduler."""
    scheduler = _get_scheduler()
    if scheduler is None:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")

    if scheduler._running:
        return {"success": False, "message": "Scheduler is already running", "status": scheduler.get_status()}

    scheduler._set_db_enabled(True)
    scheduler.start()
    return {"success": True, "message": "Scheduler started", "status": scheduler.get_status()}


@router.post(
    "/scheduler/stop",
    summary="Stop scheduler",
    description="Stop the pipeline scheduler. Requires admin role.",
)
async def scheduler_stop(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Stop the pipeline scheduler."""
    scheduler = _get_scheduler()
    if scheduler is None:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")

    if not scheduler._running:
        return {"success": False, "message": "Scheduler is not running", "status": scheduler.get_status()}

    scheduler.stop()
    return {"success": True, "message": "Scheduler stopped", "status": scheduler.get_status()}


@router.post(
    "/scheduler/process-now",
    summary="Process next video now",
    description="Trigger immediate processing of the next queued video. Requires admin role.",
)
async def scheduler_process_now(
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Process the next queued video immediately."""
    try:
        from database import get_database
        from pipeline_scheduler import PipelineScheduler

        db = get_database()
        scheduler = PipelineScheduler(db=db)
        scheduler.process_next_video()

        queue_manager = _get_queue_manager()
        depth = queue_manager.get_queue_depth()

        return {
            "success": True,
            "message": "Process completed",
            "queue_depth": depth,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Process failed: {str(e)}",
        )

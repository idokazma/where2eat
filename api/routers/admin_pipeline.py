"""Admin pipeline management endpoints for FastAPI."""

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
    "/{queue_id}/retry",
    summary="Retry failed video",
    description="Requeue a failed video for retry. Requires admin role.",
)
async def retry_video(
    queue_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Retry a failed video."""
    queue_manager = _get_queue_manager()
    video = queue_manager.get_video(queue_id)

    if not video:
        raise HTTPException(status_code=404, detail="Item not found")
    if video["status"] != "failed":
        raise HTTPException(status_code=400, detail="Only failed items can be retried")

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
                   attempt_count = 0
               WHERE id = ?""",
            (queue_id,),
        )

    return {"success": True, "message": "Video requeued for retry"}


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

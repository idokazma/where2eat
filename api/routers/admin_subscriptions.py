"""Admin subscription management endpoints for FastAPI."""

import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel

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

router = APIRouter(prefix="/api/admin/subscriptions", tags=["Admin - Subscriptions"])


# Request/response models
class AddSubscriptionRequest(BaseModel):
    source_url: str
    source_name: Optional[str] = None
    priority: Optional[int] = 5
    check_interval_hours: Optional[int] = 12


class UpdateSubscriptionRequest(BaseModel):
    source_name: Optional[str] = None
    priority: Optional[int] = None
    check_interval_hours: Optional[int] = None


def _get_subscription_manager():
    """Get SubscriptionManager instance."""
    from database import get_database
    from subscription_manager import SubscriptionManager
    db = get_database()
    return SubscriptionManager(db)


@router.get(
    "",
    summary="List subscriptions",
    description="List all YouTube channel/playlist subscriptions.",
)
async def list_subscriptions(
    active_only: bool = Query(True, description="Only return active subscriptions"),
    user: dict = Depends(get_current_user),
):
    """List all subscriptions."""
    manager = _get_subscription_manager()
    subscriptions = manager.list_subscriptions(active_only=active_only)
    return {"subscriptions": subscriptions}


@router.post(
    "",
    status_code=201,
    summary="Add subscription",
    description="Add a new YouTube channel or playlist subscription. Requires admin role.",
)
async def add_subscription(
    request: AddSubscriptionRequest,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Add a new subscription."""
    manager = _get_subscription_manager()
    try:
        subscription = manager.add_subscription(
            source_url=request.source_url,
            source_name=request.source_name,
            priority=request.priority,
            check_interval_hours=request.check_interval_hours,
        )
        return {"subscription": subscription}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{subscription_id}",
    summary="Get subscription",
    description="Get details of a specific subscription.",
)
async def get_subscription(
    subscription_id: str,
    user: dict = Depends(get_current_user),
):
    """Get subscription by ID."""
    manager = _get_subscription_manager()
    subscription = manager.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"subscription": subscription}


@router.put(
    "/{subscription_id}",
    summary="Update subscription",
    description="Update subscription settings. Requires admin role.",
)
async def update_subscription(
    subscription_id: str,
    request: UpdateSubscriptionRequest,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Update a subscription."""
    manager = _get_subscription_manager()

    # Build updates dict from non-None fields
    updates = {}
    if request.source_name is not None:
        updates["source_name"] = request.source_name
    if request.priority is not None:
        updates["priority"] = request.priority
    if request.check_interval_hours is not None:
        updates["check_interval_hours"] = request.check_interval_hours

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    success = manager.update_subscription(subscription_id, **updates)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")

    subscription = manager.get_subscription(subscription_id)
    return {"subscription": subscription}


@router.delete(
    "/{subscription_id}",
    summary="Delete subscription",
    description="Delete a subscription. Requires super_admin role.",
)
async def delete_subscription(
    subscription_id: str,
    user: dict = Depends(require_role(["super_admin"])),
):
    """Delete a subscription."""
    manager = _get_subscription_manager()
    success = manager.delete_subscription(subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"message": "Subscription deleted successfully"}


@router.post(
    "/{subscription_id}/pause",
    summary="Pause subscription",
    description="Pause a subscription. Requires admin role.",
)
async def pause_subscription(
    subscription_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Pause a subscription."""
    manager = _get_subscription_manager()
    success = manager.pause_subscription(subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    subscription = manager.get_subscription(subscription_id)
    return {"message": "Subscription paused successfully", "subscription": subscription}


@router.post(
    "/{subscription_id}/resume",
    summary="Resume subscription",
    description="Resume a paused subscription. Requires admin role.",
)
async def resume_subscription(
    subscription_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Resume a paused subscription."""
    manager = _get_subscription_manager()
    success = manager.resume_subscription(subscription_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    subscription = manager.get_subscription(subscription_id)
    return {"message": "Subscription resumed successfully", "subscription": subscription}


@router.post(
    "/{subscription_id}/check",
    summary="Check subscription now",
    description="Trigger immediate poll for new videos. Requires admin role.",
)
async def check_subscription(
    subscription_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Trigger immediate check for new videos."""
    manager = _get_subscription_manager()
    subscription = manager.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    try:
        from pipeline_scheduler import PipelineScheduler
        scheduler = PipelineScheduler()
        videos = scheduler._fetch_channel_videos(subscription)
        return {
            "success": True,
            "subscription_id": subscription_id,
            "videos_found": len(videos) if videos else 0,
            "videos": videos[:10] if videos else [],
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check subscription: {str(e)}"
        )


@router.post(
    "/{subscription_id}/refresh",
    summary="Refresh subscription",
    description=(
        "Fetch the latest videos from YouTube, queue the most recent ones "
        "for analysis, skip already-processed videos, and mark older videos "
        "as skipped for admin visibility. Requires admin role."
    ),
)
async def refresh_subscription(
    subscription_id: str,
    user: dict = Depends(require_role(["admin", "super_admin"])),
):
    """Refresh a subscription: fetch latest, queue new, skip old."""
    manager = _get_subscription_manager()
    subscription = manager.get_subscription(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")

    try:
        from pipeline_scheduler import PipelineScheduler
        from database import get_database
        db = get_database()
        scheduler = PipelineScheduler(db=db)
        result = scheduler.refresh_subscription(subscription_id)
        return {"success": True, **result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh subscription: {str(e)}"
        )

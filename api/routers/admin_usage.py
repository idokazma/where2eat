"""Admin usage-analytics endpoints (JWT required)."""

from fastapi import APIRouter, Depends, Query

from database import get_database
from routers.admin import require_role

router = APIRouter(prefix="/api/admin/usage", tags=["Admin usage"])
editor = Depends(require_role(["editor", "admin", "super_admin"]))


@router.get("/summary")
def usage_summary(days: int = Query(30, ge=1, le=365), user: dict = editor):
    """Aggregated, count-only usage metrics for the admin dashboard."""
    return get_database().get_usage_summary(days=days)

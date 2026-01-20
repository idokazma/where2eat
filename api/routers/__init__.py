"""API routers."""

from .restaurants import router as restaurants_router
from .analytics import router as analytics_router
from .analyze import router as analyze_router
from .places import router as places_router
from .health import router as health_router
from .admin import router as admin_router

__all__ = [
    "restaurants_router",
    "analytics_router",
    "analyze_router",
    "places_router",
    "health_router",
    "admin_router",
]

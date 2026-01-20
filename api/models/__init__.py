"""Pydantic models for the Where2Eat API."""

from .restaurant import (
    Restaurant,
    RestaurantCreate,
    RestaurantUpdate,
    RestaurantList,
    RestaurantSearchResponse,
    PaginatedRestaurants,
    Location,
    Rating,
    EpisodeInfo,
)
from .auth import (
    LoginRequest,
    TokenResponse,
    UserInfo,
    TokenData,
)
from .analytics import (
    TimelineEntry,
    TimelineResponse,
    TrendsResponse,
    Episode,
    EpisodeSearchResponse,
)
from .analyze import (
    AnalyzeVideoRequest,
    AnalyzeChannelRequest,
    AnalyzeResponse,
    ChannelAnalyzeResponse,
    JobStatus,
    JobResults,
    JobListResponse,
)

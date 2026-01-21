"""Pydantic models for analytics."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class TimelineEntry(BaseModel):
    """Single timeline entry."""
    date: str
    restaurants: List[Dict[str, Any]]
    count: int


class TimelineResponse(BaseModel):
    """Response for timeline analytics."""
    timeline: List[TimelineEntry]
    analytics: Dict[str, Any]
    summary: Dict[str, Any]


class TrendingRestaurant(BaseModel):
    """Trending restaurant data."""
    name_hebrew: str
    name_english: Optional[str] = None
    cuisine_type: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    host_opinion: Optional[str] = None


class RegionalPattern(BaseModel):
    """Regional analysis pattern."""
    region: str
    cities: Dict[str, int]
    total: int
    cuisines: Dict[str, int]
    average_rating: float
    total_ratings: int
    top_city: str
    top_cuisine: str


class CuisineTrend(BaseModel):
    """Cuisine trend data."""
    cuisine: str
    monthly_counts: Dict[str, int]
    total: int
    recent_mentions: int


class TrendsResponse(BaseModel):
    """Response for trends analytics."""
    trending_restaurants: List[Dict[str, Any]]
    regional_patterns: List[RegionalPattern]
    cuisine_trends: List[CuisineTrend]
    period_summary: Dict[str, Any]


class Episode(BaseModel):
    """Episode data."""
    episode_info: Optional[Dict[str, Any]] = None
    restaurants: List[Dict[str, Any]]
    food_trends: List[str] = []
    episode_summary: str = ""
    matching_restaurants: int = 0


class EpisodeSearchResponse(BaseModel):
    """Response for episode search."""
    episodes: List[Episode]
    count: int
    total_restaurants: int

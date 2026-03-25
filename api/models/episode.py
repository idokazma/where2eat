"""Pydantic models for episode-related data."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class EpisodeMention(BaseModel):
    """A single restaurant mention within an episode."""
    id: str
    restaurant_id: Optional[str] = None
    name_hebrew: str
    name_english: Optional[str] = None
    verdict: str
    mention_level: Optional[str] = None
    timestamp_seconds: Optional[float] = None
    timestamp_display: Optional[str] = None
    speaker: Optional[str] = None
    host_quotes: Optional[List[str]] = None
    host_comments: Optional[str] = None
    dishes_mentioned: Optional[List[str]] = None
    mention_context: Optional[str] = None
    skip_reason: Optional[str] = None
    city: Optional[str] = None
    cuisine_type: Optional[str] = None
    host_opinion: Optional[str] = None
    google_place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Joined restaurant fields (for add_to_page)
    image_url: Optional[str] = None
    google_rating: Optional[float] = None
    google_user_ratings_total: Optional[int] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    price_range: Optional[str] = None
    google_url: Optional[str] = None
    instagram_url: Optional[str] = None

    class Config:
        extra = "allow"


class EpisodeSummary(BaseModel):
    """Episode with mention count summary."""
    id: str
    video_id: str
    title: Optional[str] = None
    channel_name: Optional[str] = None
    published_at: Optional[str] = None
    episode_summary: Optional[str] = None
    thumbnail_url: Optional[str] = None
    add_to_page_count: int = 0
    reference_only_count: int = 0
    tasted_count: int = 0
    mentioned_count: int = 0


class EpisodeSummaryList(BaseModel):
    """Response model for episodes list."""
    episodes: List[EpisodeSummary]
    count: int


class EpisodeDetail(BaseModel):
    """Full episode detail with grouped mentions."""
    episode: EpisodeSummary
    mentions: Dict[str, List[EpisodeMention]]

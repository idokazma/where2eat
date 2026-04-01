"""Pydantic models for episode-related data."""

import json
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator


def _parse_json_list(v):
    """Parse a JSON string to list, or return the value if already a list."""
    if v is None:
        return None
    if isinstance(v, list):
        return v
    if isinstance(v, str):
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
        return [v] if v.strip() else None
    return None


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
    # Joined restaurant fields
    image_url: Optional[str] = None
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    price_range: Optional[str] = None
    google_url: Optional[str] = None
    instagram_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    special_features: Optional[List[str]] = None

    @field_validator('host_quotes', 'dishes_mentioned', 'special_features', mode='before')
    @classmethod
    def parse_json_lists(cls, v):
        return _parse_json_list(v)

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

"""Pydantic models for restaurant-related data."""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class Location(BaseModel):
    """Restaurant location details."""
    city: Optional[str] = None
    address: Optional[str] = None
    region: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class Rating(BaseModel):
    """Restaurant rating information."""
    google_rating: Optional[float] = None
    review_count: Optional[int] = None


class EpisodeInfo(BaseModel):
    """Information about the episode where restaurant was mentioned."""
    video_id: Optional[str] = None
    video_url: Optional[str] = None
    analysis_date: Optional[str] = None


class Restaurant(BaseModel):
    """Full restaurant model."""
    id: Optional[str] = None
    name_hebrew: str
    name_english: Optional[str] = None
    cuisine_type: Optional[str] = None
    location: Optional[Location] = None
    price_range: Optional[str] = None
    status: Optional[str] = None
    host_opinion: Optional[str] = None
    rating: Optional[Rating] = None
    episode_info: Optional[EpisodeInfo] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields


class RestaurantCreate(BaseModel):
    """Model for creating a restaurant."""
    name_hebrew: str
    name_english: Optional[str] = None
    cuisine_type: Optional[str] = None
    location: Optional[Location] = None
    price_range: Optional[str] = None
    status: Optional[str] = None
    host_opinion: Optional[str] = None

    class Config:
        extra = "allow"


class RestaurantUpdate(BaseModel):
    """Model for updating a restaurant."""
    name_hebrew: Optional[str] = None
    name_english: Optional[str] = None
    cuisine_type: Optional[str] = None
    location: Optional[Location] = None
    price_range: Optional[str] = None
    status: Optional[str] = None
    host_opinion: Optional[str] = None

    class Config:
        extra = "allow"


class RestaurantList(BaseModel):
    """Response model for restaurant list."""
    restaurants: List[Restaurant]
    count: int


class RestaurantSearchResponse(BaseModel):
    """Response model for restaurant search."""
    restaurants: List[Restaurant]
    timeline_data: Optional[List[Dict[str, Any]]] = None
    analytics: Optional[Dict[str, Any]] = None


class Pagination(BaseModel):
    """Pagination metadata."""
    page: int
    limit: int
    total: int
    totalPages: int


class PaginatedRestaurants(BaseModel):
    """Paginated restaurant response."""
    restaurants: List[Restaurant]
    pagination: Pagination

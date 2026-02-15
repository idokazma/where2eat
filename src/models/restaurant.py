"""
SQLAlchemy ORM models for Where2Eat.

Models:
- Episode: YouTube video episodes
- Restaurant: Restaurant entries extracted from episodes
- Job: Background processing jobs
- AdminUser: Admin dashboard users
- Article: Blog/content articles
- RestaurantHistory: Audit trail for restaurant changes
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime,
    ForeignKey, Boolean, Index, JSON
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .base import Base


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


class Episode(Base):
    """YouTube video episode containing restaurant mentions."""

    __tablename__ = 'episodes'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    video_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    video_url: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_id: Mapped[Optional[str]] = mapped_column(String(50))
    channel_name: Mapped[Optional[str]] = mapped_column(String(255))
    title: Mapped[Optional[str]] = mapped_column(String(500))
    language: Mapped[str] = mapped_column(String(10), default='he')
    analysis_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    transcript: Mapped[Optional[str]] = mapped_column(Text)
    food_trends: Mapped[Optional[Dict]] = mapped_column(JSON)
    episode_summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    restaurants: Mapped[List["Restaurant"]] = relationship("Restaurant", back_populates="episode")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'id': self.id,
            'video_id': self.video_id,
            'video_url': self.video_url,
            'channel_id': self.channel_id,
            'channel_name': self.channel_name,
            'title': self.title,
            'language': self.language,
            'analysis_date': self.analysis_date.isoformat() if self.analysis_date else None,
            'food_trends': self.food_trends,
            'episode_summary': self.episode_summary,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Restaurant(Base):
    """Restaurant extracted from a YouTube episode."""

    __tablename__ = 'restaurants'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    episode_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey('episodes.id'))

    # Names
    name_hebrew: Mapped[str] = mapped_column(String(255), nullable=False)
    name_english: Mapped[Optional[str]] = mapped_column(String(255))

    # Location
    city: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    neighborhood: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(String(255))
    region: Mapped[str] = mapped_column(String(50), default='Center')
    latitude: Mapped[Optional[float]] = mapped_column(Float)
    longitude: Mapped[Optional[float]] = mapped_column(Float)

    # Restaurant details
    cuisine_type: Mapped[Optional[str]] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), default='open')
    price_range: Mapped[Optional[str]] = mapped_column(String(20))
    host_opinion: Mapped[Optional[str]] = mapped_column(String(50))
    host_comments: Mapped[Optional[str]] = mapped_column(Text)

    # Structured data
    menu_items: Mapped[Optional[List]] = mapped_column(JSON)
    special_features: Mapped[Optional[List]] = mapped_column(JSON)

    # Contact info
    contact_hours: Mapped[Optional[str]] = mapped_column(String(255))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50))
    contact_website: Mapped[Optional[str]] = mapped_column(String(255))
    contact_social: Mapped[Optional[str]] = mapped_column(String(255))

    # Additional info
    business_news: Mapped[Optional[str]] = mapped_column(Text)
    mention_context: Mapped[Optional[str]] = mapped_column(Text)
    mention_timestamp: Mapped[Optional[float]] = mapped_column(Float)

    # Google Places data
    google_place_id: Mapped[Optional[str]] = mapped_column(String(100))
    google_name: Mapped[Optional[str]] = mapped_column(String(255))
    google_url: Mapped[Optional[str]] = mapped_column(String(500))
    google_rating: Mapped[Optional[float]] = mapped_column(Float)
    google_user_ratings_total: Mapped[Optional[int]] = mapped_column(Integer)
    enriched_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Photos
    photos: Mapped[Optional[List]] = mapped_column(JSON)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    episode: Mapped[Optional["Episode"]] = relationship("Episode", back_populates="restaurants")
    history: Mapped[List["RestaurantHistory"]] = relationship("RestaurantHistory", back_populates="restaurant")

    # Indexes
    __table_args__ = (
        Index('ix_restaurants_city_cuisine', 'city', 'cuisine_type'),
        Index('ix_restaurants_location', 'latitude', 'longitude'),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary matching the existing API format."""
        return {
            'id': self.id,
            'name_hebrew': self.name_hebrew,
            'name_english': self.name_english,
            'cuisine_type': self.cuisine_type or 'לא צוין',
            'location': {
                'city': self.city or 'לא צוין',
                'neighborhood': self.neighborhood,
                'address': self.address or 'לא צוין',
                'region': self.region or 'לא צוין',
                'lat': self.latitude,
                'lng': self.longitude,
            },
            'price_range': self.price_range or 'לא צוין',
            'status': self.status or 'לא צוין',
            'host_opinion': self.host_opinion or 'לא צוין',
            'host_comments': self.host_comments or 'לא צוין',
            'rating': {
                'google_rating': self.google_rating,
                'review_count': self.google_user_ratings_total,
            },
            'episode_info': {
                'video_id': self.episode.video_id if self.episode else None,
                'video_url': self.episode.video_url if self.episode else None,
                'analysis_date': self.episode.analysis_date.strftime('%Y-%m-%d') if self.episode and self.episode.analysis_date else None,
            } if self.episode else {},
            'contact_info': {
                'phone': self.contact_phone or 'לא צוין',
                'website': self.contact_website or 'לא צוין',
                'social_media': self.contact_social or 'לא צוין',
            },
            'business_news': self.business_news,
            'mention_context': self.mention_context,
            'mention_timestamp_seconds': int(self.mention_timestamp) if self.mention_timestamp else None,
            'menu_items': self.menu_items or [],
            'special_features': self.special_features or [],
            'food_trends': self.episode.food_trends if self.episode else [],
            'episode_summary': self.episode.episode_summary if self.episode else None,
            'google_places': {
                'place_id': self.google_place_id,
                'google_name': self.google_name,
                'google_url': self.google_url,
                'enriched_at': self.enriched_at.isoformat() if self.enriched_at else None,
            } if self.google_place_id else None,
            'photos': self.photos or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Job(Base):
    """Background processing job for video/channel analysis."""

    __tablename__ = 'jobs'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    job_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'video' or 'channel'
    status: Mapped[str] = mapped_column(String(20), default='pending', index=True)

    # Job input
    channel_url: Mapped[Optional[str]] = mapped_column(String(255))
    video_url: Mapped[Optional[str]] = mapped_column(String(255))
    filters: Mapped[Optional[Dict]] = mapped_column(JSON)
    processing_options: Mapped[Optional[Dict]] = mapped_column(JSON)

    # Progress tracking
    progress_videos_completed: Mapped[int] = mapped_column(Integer, default=0)
    progress_videos_total: Mapped[int] = mapped_column(Integer, default=0)
    progress_videos_failed: Mapped[int] = mapped_column(Integer, default=0)
    progress_restaurants_found: Mapped[int] = mapped_column(Integer, default=0)
    current_video_id: Mapped[Optional[str]] = mapped_column(String(20))
    current_video_title: Mapped[Optional[str]] = mapped_column(String(500))
    current_step: Mapped[Optional[str]] = mapped_column(String(100))

    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text)

    # Timestamps
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'id': self.id,
            'job_type': self.job_type,
            'status': self.status,
            'channel_url': self.channel_url,
            'video_url': self.video_url,
            'filters': self.filters,
            'processing_options': self.processing_options,
            'progress': {
                'videos_completed': self.progress_videos_completed,
                'videos_total': self.progress_videos_total,
                'videos_failed': self.progress_videos_failed,
                'restaurants_found': self.progress_restaurants_found,
                'current_video_id': self.current_video_id,
                'current_video_title': self.current_video_title,
                'current_step': self.current_step,
            },
            'error_message': self.error_message,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AdminUser(Base):
    """Admin dashboard user."""

    __tablename__ = 'admin_users'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # super_admin, admin, editor, viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Relationships
    articles: Mapped[List["Article"]] = relationship("Article", back_populates="author")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary (excluding password)."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }


class Article(Base):
    """Blog/content article."""

    __tablename__ = 'articles'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    excerpt: Mapped[Optional[str]] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    featured_image: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(20), default='draft', index=True)
    author_id: Mapped[str] = mapped_column(String(36), ForeignKey('admin_users.id'), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    tags: Mapped[Optional[List]] = mapped_column(JSON)

    # SEO
    seo_title: Mapped[Optional[str]] = mapped_column(String(255))
    seo_description: Mapped[Optional[str]] = mapped_column(Text)
    seo_keywords: Mapped[Optional[str]] = mapped_column(String(500))

    # Publishing
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True)
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime)

    # Analytics
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author: Mapped["AdminUser"] = relationship("AdminUser", back_populates="articles")

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'id': self.id,
            'title': self.title,
            'slug': self.slug,
            'excerpt': self.excerpt,
            'content': self.content,
            'featured_image': self.featured_image,
            'status': self.status,
            'author_id': self.author_id,
            'author': self.author.to_dict() if self.author else None,
            'category': self.category,
            'tags': self.tags,
            'seo': {
                'title': self.seo_title,
                'description': self.seo_description,
                'keywords': self.seo_keywords,
            },
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'scheduled_for': self.scheduled_for.isoformat() if self.scheduled_for else None,
            'view_count': self.view_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class RestaurantHistory(Base):
    """Audit trail for restaurant changes."""

    __tablename__ = 'restaurant_history'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey('restaurants.id'), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # create, update, delete
    changed_by: Mapped[Optional[str]] = mapped_column(String(36))  # admin user id or 'system'
    changes: Mapped[Optional[Dict]] = mapped_column(JSON)  # {field: {old: x, new: y}}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="history")

    # Index for querying history
    __table_args__ = (
        Index('ix_restaurant_history_restaurant_created', 'restaurant_id', 'created_at'),
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'id': self.id,
            'restaurant_id': self.restaurant_id,
            'action': self.action,
            'changed_by': self.changed_by,
            'changes': self.changes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

# Phase 2: PostgreSQL Migration Specification

This document outlines the plan for migrating from SQLite to PostgreSQL for production workloads.

## Overview

### Current State (Phase 1)
- SQLite database with Railway volume persistence
- DATABASE_DIR environment variable support
- Works for single-instance deployments

### Target State (Phase 2)
- PostgreSQL for production (Railway PostgreSQL service)
- SQLite for local development
- SQLAlchemy ORM for database abstraction
- Support for concurrent access and horizontal scaling

## Why PostgreSQL?

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Concurrent writes | Limited (file locking) | Full support |
| Connection pooling | N/A | Built-in |
| Horizontal scaling | Not possible | Supported |
| Backups | Manual file copy | pg_dump, point-in-time recovery |
| Full-text search | Limited | Excellent (tsvector) |
| JSON support | Basic | Advanced (JSONB) |
| Geographic queries | None | PostGIS extension |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│                   SQLAlchemy ORM Layer                       │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │   Models.py     │              │  Repositories   │       │
│  │  (Declarative)  │◄────────────►│   (CRUD ops)    │       │
│  └─────────────────┘              └─────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                   Database Abstraction                       │
│  ┌─────────────────┐              ┌─────────────────┐       │
│  │ SQLite Backend  │              │PostgreSQL Backend│       │
│  │ (Development)   │              │  (Production)    │       │
│  └─────────────────┘              └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Step 1: Add SQLAlchemy Dependencies

```bash
# Add to requirements.txt
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.9
alembic>=1.13.0  # For migrations
```

### Step 2: Create SQLAlchemy Models

Create `src/models/` directory with ORM models:

```python
# src/models/base.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

Base = declarative_base()

def get_database_url():
    """Get database URL based on environment."""
    # PostgreSQL (production)
    postgres_url = os.getenv('DATABASE_URL')
    if postgres_url:
        # Railway provides postgres:// but SQLAlchemy needs postgresql://
        if postgres_url.startswith('postgres://'):
            postgres_url = postgres_url.replace('postgres://', 'postgresql://', 1)
        return postgres_url

    # SQLite (development)
    db_dir = os.getenv('DATABASE_DIR', 'data')
    return f"sqlite:///{db_dir}/where2eat.db"

def get_engine():
    url = get_database_url()
    if url.startswith('sqlite'):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)

def get_session():
    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()
```

```python
# src/models/restaurant.py
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import JSON
from .base import Base
import uuid
from datetime import datetime

def get_json_type():
    """Return JSONB for PostgreSQL, JSON for SQLite."""
    from sqlalchemy import event
    # This will be resolved at runtime based on the dialect
    return JSON

class Episode(Base):
    __tablename__ = 'episodes'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(20), unique=True, nullable=False, index=True)
    video_url = Column(String(255), nullable=False)
    channel_id = Column(String(50))
    channel_name = Column(String(255))
    title = Column(String(500))
    language = Column(String(10), default='he')
    analysis_date = Column(DateTime)
    transcript = Column(Text)
    food_trends = Column(JSON)  # Will use JSONB on PostgreSQL
    episode_summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    restaurants = relationship("Restaurant", back_populates="episode")


class Restaurant(Base):
    __tablename__ = 'restaurants'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    episode_id = Column(String(36), ForeignKey('episodes.id'))
    name_hebrew = Column(String(255), nullable=False)
    name_english = Column(String(255))

    # Location fields
    city = Column(String(100), index=True)
    neighborhood = Column(String(100))
    address = Column(String(255))
    region = Column(String(50), default='Center')
    latitude = Column(Float)
    longitude = Column(Float)

    # Restaurant details
    cuisine_type = Column(String(100), index=True)
    status = Column(String(20), default='open')
    price_range = Column(String(20))
    host_opinion = Column(String(50))
    host_comments = Column(Text)

    # Structured data (JSON)
    menu_items = Column(JSON)
    special_features = Column(JSON)

    # Contact info
    contact_hours = Column(String(255))
    contact_phone = Column(String(50))
    contact_website = Column(String(255))

    # Additional info
    business_news = Column(Text)
    mention_context = Column(Text)
    mention_timestamp = Column(Float)

    # Google Places data
    google_place_id = Column(String(100))
    google_rating = Column(Float)
    google_user_ratings_total = Column(Integer)
    image_url = Column(String(500))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    episode = relationship("Episode", back_populates="restaurants")


class Job(Base):
    __tablename__ = 'jobs'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    job_type = Column(String(20), nullable=False)
    status = Column(String(20), default='pending', index=True)
    channel_url = Column(String(255))
    video_url = Column(String(255))
    filters = Column(JSON)
    processing_options = Column(JSON)
    progress_videos_completed = Column(Integer, default=0)
    progress_videos_total = Column(Integer, default=0)
    progress_videos_failed = Column(Integer, default=0)
    progress_restaurants_found = Column(Integer, default=0)
    current_video_id = Column(String(20))
    current_video_title = Column(String(500))
    current_step = Column(String(100))
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminUser(Base):
    __tablename__ = 'admin_users'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)  # super_admin, admin, editor, viewer
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)


class Article(Base):
    __tablename__ = 'articles'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(500), nullable=False)
    slug = Column(String(500), unique=True, nullable=False, index=True)
    excerpt = Column(Text)
    content = Column(Text, nullable=False)
    featured_image = Column(String(500))
    status = Column(String(20), default='draft', index=True)
    author_id = Column(String(36), ForeignKey('admin_users.id'), nullable=False)
    category = Column(String(100))
    tags = Column(JSON)
    seo_title = Column(String(255))
    seo_description = Column(Text)
    seo_keywords = Column(String(500))
    published_at = Column(DateTime, index=True)
    scheduled_for = Column(DateTime)
    view_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

### Step 3: Create Repository Layer

```python
# src/repositories/restaurant_repository.py
from sqlalchemy.orm import Session
from models.restaurant import Restaurant, Episode
from typing import List, Optional, Dict
import uuid

class RestaurantRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, name_hebrew: str, episode_id: str = None, **kwargs) -> Restaurant:
        restaurant = Restaurant(
            id=str(uuid.uuid4()),
            name_hebrew=name_hebrew,
            episode_id=episode_id,
            **kwargs
        )
        self.session.add(restaurant)
        self.session.commit()
        self.session.refresh(restaurant)
        return restaurant

    def get_by_id(self, restaurant_id: str) -> Optional[Restaurant]:
        return self.session.query(Restaurant).filter(Restaurant.id == restaurant_id).first()

    def get_all(self, limit: int = 100, offset: int = 0) -> List[Restaurant]:
        return self.session.query(Restaurant)\
            .order_by(Restaurant.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()

    def search(
        self,
        city: str = None,
        cuisine: str = None,
        price_range: str = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict:
        query = self.session.query(Restaurant)

        if city:
            query = query.filter(Restaurant.city.ilike(f'%{city}%'))
        if cuisine:
            query = query.filter(Restaurant.cuisine_type.ilike(f'%{cuisine}%'))
        if price_range:
            query = query.filter(Restaurant.price_range == price_range)

        total = query.count()
        restaurants = query.order_by(Restaurant.created_at.desc())\
            .offset(offset)\
            .limit(limit)\
            .all()

        return {
            'restaurants': restaurants,
            'total': total,
            'limit': limit,
            'offset': offset
        }

    def update(self, restaurant_id: str, **kwargs) -> Optional[Restaurant]:
        restaurant = self.get_by_id(restaurant_id)
        if not restaurant:
            return None

        for key, value in kwargs.items():
            if hasattr(restaurant, key):
                setattr(restaurant, key, value)

        self.session.commit()
        self.session.refresh(restaurant)
        return restaurant

    def delete(self, restaurant_id: str) -> bool:
        restaurant = self.get_by_id(restaurant_id)
        if not restaurant:
            return False

        self.session.delete(restaurant)
        self.session.commit()
        return True
```

### Step 4: Database Migration with Alembic

```bash
# Initialize Alembic
cd src
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Run migrations
alembic upgrade head
```

```python
# alembic/env.py configuration
from models.base import Base
from models.restaurant import Restaurant, Episode, Job, AdminUser, Article

target_metadata = Base.metadata
```

### Step 5: Add PostgreSQL to Railway

1. Go to Railway dashboard
2. Click "New Service" → "Database" → "PostgreSQL"
3. Railway automatically sets `DATABASE_URL` environment variable
4. The application will detect `DATABASE_URL` and use PostgreSQL

### Step 6: Data Migration Script

```python
# scripts/migrate_sqlite_to_postgres.py
"""
Migrate data from SQLite to PostgreSQL.
Run this once after setting up PostgreSQL.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database import Database as SQLiteDB
from src.models.base import get_engine, Base
from src.models.restaurant import Restaurant, Episode, Job, AdminUser, Article
from sqlalchemy.orm import sessionmaker

def migrate():
    # Source: SQLite
    sqlite_db = SQLiteDB()

    # Target: PostgreSQL
    postgres_url = os.getenv('DATABASE_URL')
    if not postgres_url:
        print("ERROR: DATABASE_URL not set")
        return

    if postgres_url.startswith('postgres://'):
        postgres_url = postgres_url.replace('postgres://', 'postgresql://', 1)

    from sqlalchemy import create_engine
    pg_engine = create_engine(postgres_url)

    # Create tables
    Base.metadata.create_all(pg_engine)

    Session = sessionmaker(bind=pg_engine)
    session = Session()

    # Migrate episodes
    print("Migrating episodes...")
    for ep in sqlite_db.get_all_episodes():
        episode = Episode(
            id=ep['id'],
            video_id=ep['video_id'],
            video_url=ep['video_url'],
            channel_id=ep.get('channel_id'),
            channel_name=ep.get('channel_name'),
            title=ep.get('title'),
            language=ep.get('language', 'he'),
            analysis_date=ep.get('analysis_date'),
            transcript=ep.get('transcript'),
            food_trends=ep.get('food_trends'),
            episode_summary=ep.get('episode_summary')
        )
        session.merge(episode)

    session.commit()
    print(f"Migrated {len(sqlite_db.get_all_episodes())} episodes")

    # Migrate restaurants
    print("Migrating restaurants...")
    for r in sqlite_db.get_all_restaurants():
        restaurant = Restaurant(
            id=r['id'],
            episode_id=r.get('episode_id'),
            name_hebrew=r['name_hebrew'],
            name_english=r.get('name_english'),
            city=r.get('location', {}).get('city'),
            neighborhood=r.get('location', {}).get('neighborhood'),
            address=r.get('location', {}).get('address'),
            region=r.get('location', {}).get('region', 'Center'),
            latitude=r.get('latitude'),
            longitude=r.get('longitude'),
            cuisine_type=r.get('cuisine_type'),
            status=r.get('status', 'open'),
            price_range=r.get('price_range'),
            host_opinion=r.get('host_opinion'),
            host_comments=r.get('host_comments'),
            menu_items=r.get('menu_items'),
            special_features=r.get('special_features'),
            contact_hours=r.get('contact_info', {}).get('hours'),
            contact_phone=r.get('contact_info', {}).get('phone'),
            contact_website=r.get('contact_info', {}).get('website'),
            business_news=r.get('business_news'),
            mention_context=r.get('mention_context'),
            mention_timestamp=r.get('mention_timestamp'),
            google_place_id=r.get('google_place_id'),
            google_rating=r.get('rating', {}).get('google_rating'),
            google_user_ratings_total=r.get('rating', {}).get('user_ratings_total'),
            image_url=r.get('image_url')
        )
        session.merge(restaurant)

    session.commit()
    print(f"Migrated {len(sqlite_db.get_all_restaurants())} restaurants")

    session.close()
    print("Migration complete!")

if __name__ == '__main__':
    migrate()
```

### Step 7: Update Existing Code

The existing `src/database.py` can be kept for backward compatibility, with a new `src/db/` module using SQLAlchemy:

```python
# src/db/__init__.py
from .session import get_db, init_db
from .repositories import RestaurantRepository, EpisodeRepository

__all__ = ['get_db', 'init_db', 'RestaurantRepository', 'EpisodeRepository']
```

## Environment Variables

| Variable | Development | Production |
|----------|-------------|------------|
| `DATABASE_URL` | (not set) | `postgresql://user:pass@host:5432/dbname` |
| `DATABASE_DIR` | `./data` | `/app/data` (for SQLite fallback) |

## Rollback Plan

If issues arise with PostgreSQL:
1. Set `DATABASE_URL` to empty string
2. Application falls back to SQLite
3. Data in PostgreSQL is preserved for later

## Testing

```python
# tests/test_database_abstraction.py
import pytest
from src.models.base import get_database_url, get_engine

def test_sqlite_url_in_development():
    """Without DATABASE_URL, should use SQLite."""
    import os
    os.environ.pop('DATABASE_URL', None)
    url = get_database_url()
    assert url.startswith('sqlite:///')

def test_postgres_url_in_production():
    """With DATABASE_URL, should use PostgreSQL."""
    import os
    os.environ['DATABASE_URL'] = 'postgres://user:pass@host:5432/db'
    url = get_database_url()
    assert url.startswith('postgresql://')
    os.environ.pop('DATABASE_URL')
```

## Timeline

| Phase | Task | Estimate |
|-------|------|----------|
| 2.1 | Add SQLAlchemy dependencies | 1 hour |
| 2.2 | Create ORM models | 2-3 hours |
| 2.3 | Create repository layer | 2-3 hours |
| 2.4 | Set up Alembic migrations | 1-2 hours |
| 2.5 | Add PostgreSQL to Railway | 30 minutes |
| 2.6 | Run data migration | 1 hour |
| 2.7 | Update API routers | 2-3 hours |
| 2.8 | Testing and validation | 2-3 hours |
| **Total** | | **12-16 hours** |

## Checklist

- [ ] Install SQLAlchemy and psycopg2-binary
- [ ] Create ORM models
- [ ] Create repository layer
- [ ] Set up Alembic migrations
- [ ] Add PostgreSQL service to Railway
- [ ] Run data migration script
- [ ] Update FastAPI routers to use repositories
- [ ] Add database health check endpoint
- [ ] Update tests
- [ ] Update documentation

## Related Issues

- Issue #46: Make SQLite database persistent on Railway deployment
- Phase 1 implemented: Railway Volume support (this PR)

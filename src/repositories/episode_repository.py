"""
Episode repository for YouTube video episode operations.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func

from models import Episode, Restaurant
from .base import BaseRepository


class EpisodeRepository(BaseRepository[Episode]):
    """
    Repository for Episode operations.
    """

    def __init__(self, db: Session):
        super().__init__(Episode, db)

    def get_by_video_id(self, video_id: str) -> Optional[Episode]:
        """Get episode by YouTube video ID."""
        return self.db.query(Episode)\
            .filter(Episode.video_id == video_id)\
            .first()

    def get_by_video_id_with_restaurants(self, video_id: str) -> Optional[Episode]:
        """Get episode with restaurants eagerly loaded."""
        return self.db.query(Episode)\
            .options(joinedload(Episode.restaurants))\
            .filter(Episode.video_id == video_id)\
            .first()

    def get_all_with_restaurants(self, limit: int = 50, offset: int = 0) -> List[Episode]:
        """Get all episodes with restaurants."""
        return self.db.query(Episode)\
            .options(joinedload(Episode.restaurants))\
            .order_by(desc(Episode.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()

    def get_by_channel(self, channel_id: str, limit: int = 50) -> List[Episode]:
        """Get episodes from a specific channel."""
        return self.db.query(Episode)\
            .filter(Episode.channel_id == channel_id)\
            .order_by(desc(Episode.analysis_date))\
            .limit(limit)\
            .all()

    def search(
        self,
        query: Optional[str] = None,
        channel_id: Optional[str] = None,
        language: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Search episodes with filters.
        """
        q = self.db.query(Episode)

        if query:
            q = q.filter(
                Episode.title.ilike(f'%{query}%') |
                Episode.episode_summary.ilike(f'%{query}%')
            )

        if channel_id:
            q = q.filter(Episode.channel_id == channel_id)

        if language:
            q = q.filter(Episode.language == language)

        total = q.count()

        episodes = q.order_by(desc(Episode.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()

        return {
            'episodes': episodes,
            'total': total,
            'limit': limit,
            'offset': offset,
        }

    def get_recent(self, days: int = 30, limit: int = 20) -> List[Episode]:
        """Get recently analyzed episodes."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        return self.db.query(Episode)\
            .filter(Episode.created_at >= cutoff)\
            .order_by(desc(Episode.created_at))\
            .limit(limit)\
            .all()

    def get_stats(self) -> Dict[str, Any]:
        """Get episode statistics."""
        total = self.count()

        # Count by channel
        channels = self.db.query(
            Episode.channel_name,
            func.count(Episode.id)
        ).group_by(Episode.channel_name).all()

        # Count by language
        languages = self.db.query(
            Episode.language,
            func.count(Episode.id)
        ).group_by(Episode.language).all()

        # Total restaurants
        total_restaurants = self.db.query(func.count(Restaurant.id)).scalar() or 0

        return {
            'total_episodes': total,
            'total_restaurants': total_restaurants,
            'by_channel': {name: count for name, count in channels if name},
            'by_language': {lang: count for lang, count in languages if lang},
        }

    def exists_by_video_id(self, video_id: str) -> bool:
        """Check if an episode with this video ID exists."""
        return self.db.query(
            self.db.query(Episode).filter(Episode.video_id == video_id).exists()
        ).scalar()

    def create_or_update(self, video_id: str, **kwargs) -> Episode:
        """Create or update an episode by video ID."""
        existing = self.get_by_video_id(video_id)

        if existing:
            for key, value in kwargs.items():
                if hasattr(existing, key):
                    setattr(existing, key, value)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        else:
            return self.create(video_id=video_id, **kwargs)

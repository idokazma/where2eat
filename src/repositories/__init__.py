"""
Repository layer for Where2Eat database operations.

Provides a clean abstraction over SQLAlchemy models with
specialized query methods for each entity type.

Usage:
    from repositories import RestaurantRepository, EpisodeRepository
    from models import get_db_session

    with get_db_session() as db:
        repo = RestaurantRepository(db)
        restaurants = repo.search(city='תל אביב', cuisine='Italian')
"""

from .base import BaseRepository
from .restaurant_repository import RestaurantRepository
from .episode_repository import EpisodeRepository
from .job_repository import JobRepository

__all__ = [
    'BaseRepository',
    'RestaurantRepository',
    'EpisodeRepository',
    'JobRepository',
]

"""
SQLAlchemy ORM models for Where2Eat.

Usage:
    from models import Restaurant, Episode, get_db, init_db

    # Initialize database on startup
    init_db()

    # Use in FastAPI route
    @app.get("/restaurants")
    def get_restaurants(db: Session = Depends(get_db)):
        return db.query(Restaurant).all()

    # Use in script
    with get_db_session() as db:
        restaurants = db.query(Restaurant).all()
"""

from .base import (
    Base,
    get_database_url,
    get_engine,
    get_db,
    get_db_session,
    init_db,
    is_sqlite,
    is_postgres,
    reset_engine,
)

from .restaurant import (
    Episode,
    Restaurant,
    Job,
    AdminUser,
    Article,
    RestaurantHistory,
)

__all__ = [
    # Base
    'Base',
    'get_database_url',
    'get_engine',
    'get_db',
    'get_db_session',
    'init_db',
    'is_sqlite',
    'is_postgres',
    'reset_engine',
    # Models
    'Episode',
    'Restaurant',
    'Job',
    'AdminUser',
    'Article',
    'RestaurantHistory',
]

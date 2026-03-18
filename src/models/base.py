"""
SQLAlchemy database configuration and session management.

Supports both SQLite (development) and PostgreSQL (production).
"""
import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from sqlalchemy.pool import StaticPool

Base = declarative_base()


def get_database_url() -> str:
    """
    Get database URL based on environment.

    Priority:
    1. DATABASE_URL (PostgreSQL in production)
    2. DATABASE_PATH (explicit SQLite path)
    3. DATABASE_DIR + where2eat.db
    4. Default: data/where2eat.db
    """
    # PostgreSQL (production) - Railway sets this automatically
    postgres_url = os.getenv('DATABASE_URL')
    if postgres_url:
        # Railway provides postgres:// but SQLAlchemy 2.0 needs postgresql://
        if postgres_url.startswith('postgres://'):
            postgres_url = postgres_url.replace('postgres://', 'postgresql://', 1)
        return postgres_url

    # Explicit SQLite path
    db_path = os.getenv('DATABASE_PATH')
    if db_path:
        return f"sqlite:///{db_path}"

    # SQLite with directory from env
    db_dir = os.getenv('DATABASE_DIR')
    if db_dir:
        return f"sqlite:///{db_dir}/where2eat.db"

    # Default SQLite path
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    default_path = os.path.join(project_root, 'data', 'where2eat.db')
    return f"sqlite:///{default_path}"


def is_sqlite() -> bool:
    """Check if using SQLite database."""
    return get_database_url().startswith('sqlite')


def is_postgres() -> bool:
    """Check if using PostgreSQL database."""
    url = get_database_url()
    return url.startswith('postgresql://') or url.startswith('postgres://')


def get_engine():
    """
    Create and return a SQLAlchemy engine.

    Configured appropriately for SQLite or PostgreSQL.
    """
    url = get_database_url()

    if url.startswith('sqlite'):
        # SQLite configuration
        # check_same_thread=False needed for FastAPI async
        # StaticPool for in-memory or single-connection scenarios
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            echo=os.getenv('SQL_ECHO', '').lower() == 'true'
        )
    else:
        # PostgreSQL configuration
        return create_engine(
            url,
            pool_pre_ping=True,  # Verify connections before using
            pool_size=5,
            max_overflow=10,
            pool_recycle=300,  # Recycle connections after 5 minutes
            echo=os.getenv('SQL_ECHO', '').lower() == 'true'
        )


# Global engine and session factory
_engine = None
_SessionLocal = None


def get_session_factory():
    """Get or create the session factory."""
    global _engine, _SessionLocal

    if _SessionLocal is None:
        _engine = get_engine()
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

    return _SessionLocal


def get_db() -> Generator[Session, None, None]:
    """
    Dependency for FastAPI to get database session.

    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for getting database session.

    Usage:
        with get_db_session() as db:
            db.query(Restaurant).all()
    """
    SessionLocal = get_session_factory()
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables.

    Call this on application startup.
    """
    global _engine

    if _engine is None:
        _engine = get_engine()

    # Import all models to ensure they're registered with Base
    from . import restaurant  # noqa: F401

    Base.metadata.create_all(bind=_engine)

    print(f"[DB] Database initialized: {get_database_url().split('@')[-1] if '@' in get_database_url() else get_database_url()}")
    print(f"[DB] Using: {'PostgreSQL' if is_postgres() else 'SQLite'}")


def reset_engine():
    """Reset the engine and session factory. Useful for testing."""
    global _engine, _SessionLocal
    if _engine:
        _engine.dispose()
    _engine = None
    _SessionLocal = None

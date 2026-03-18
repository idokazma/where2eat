"""
Base repository class with common CRUD operations.
"""
from typing import TypeVar, Generic, List, Optional, Type, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from models.base import Base

T = TypeVar('T', bound=Base)


class BaseRepository(Generic[T]):
    """
    Base repository providing common CRUD operations.

    Usage:
        class RestaurantRepository(BaseRepository[Restaurant]):
            def __init__(self, db: Session):
                super().__init__(Restaurant, db)
    """

    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: str) -> Optional[T]:
        """Get a single record by ID."""
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, limit: int = 100, offset: int = 0) -> List[T]:
        """Get all records with pagination."""
        return self.db.query(self.model).offset(offset).limit(limit).all()

    def count(self) -> int:
        """Get total count of records."""
        return self.db.query(func.count(self.model.id)).scalar() or 0

    def create(self, **kwargs) -> T:
        """Create a new record."""
        instance = self.model(**kwargs)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def update(self, id: str, **kwargs) -> Optional[T]:
        """Update an existing record."""
        instance = self.get_by_id(id)
        if not instance:
            return None

        for key, value in kwargs.items():
            if hasattr(instance, key) and value is not None:
                setattr(instance, key, value)

        self.db.commit()
        self.db.refresh(instance)
        return instance

    def delete(self, id: str) -> bool:
        """Delete a record by ID."""
        instance = self.get_by_id(id)
        if not instance:
            return False

        self.db.delete(instance)
        self.db.commit()
        return True

    def bulk_create(self, items: List[Dict[str, Any]]) -> List[T]:
        """Create multiple records at once."""
        instances = [self.model(**item) for item in items]
        self.db.add_all(instances)
        self.db.commit()
        for instance in instances:
            self.db.refresh(instance)
        return instances

    def exists(self, id: str) -> bool:
        """Check if a record exists."""
        return self.db.query(
            self.db.query(self.model).filter(self.model.id == id).exists()
        ).scalar()

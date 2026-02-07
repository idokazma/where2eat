"""
Restaurant repository with specialized query methods.
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_, desc

from models import Restaurant, Episode, RestaurantHistory
from .base import BaseRepository


class RestaurantRepository(BaseRepository[Restaurant]):
    """
    Repository for Restaurant operations.

    Provides methods for searching, filtering, and managing restaurants.
    """

    def __init__(self, db: Session):
        super().__init__(Restaurant, db)

    def get_by_id_with_episode(self, id: str) -> Optional[Restaurant]:
        """Get restaurant with its episode eagerly loaded."""
        return self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .filter(Restaurant.id == id)\
            .first()

    def get_all_with_episodes(self, limit: int = 100, offset: int = 0) -> List[Restaurant]:
        """Get all restaurants with episodes eagerly loaded."""
        return self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .order_by(desc(Restaurant.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()

    def search(
        self,
        city: Optional[str] = None,
        cuisine: Optional[str] = None,
        price_range: Optional[str] = None,
        status: Optional[str] = None,
        query: Optional[str] = None,
        min_rating: Optional[float] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Search restaurants with multiple filters.

        Returns dict with restaurants list and pagination info.
        """
        q = self.db.query(Restaurant).options(joinedload(Restaurant.episode))

        # Apply filters
        if city:
            q = q.filter(Restaurant.city.ilike(f'%{city}%'))

        if cuisine:
            q = q.filter(Restaurant.cuisine_type.ilike(f'%{cuisine}%'))

        if price_range:
            q = q.filter(Restaurant.price_range == price_range)

        if status:
            q = q.filter(Restaurant.status == status)

        if min_rating:
            q = q.filter(Restaurant.google_rating >= min_rating)

        if query:
            # Search in name, address, and comments
            search_filter = or_(
                Restaurant.name_hebrew.ilike(f'%{query}%'),
                Restaurant.name_english.ilike(f'%{query}%'),
                Restaurant.address.ilike(f'%{query}%'),
                Restaurant.host_comments.ilike(f'%{query}%'),
            )
            q = q.filter(search_filter)

        # Get total count before pagination
        total = q.count()

        # Apply pagination
        restaurants = q.order_by(desc(Restaurant.created_at))\
            .offset(offset)\
            .limit(limit)\
            .all()

        return {
            'restaurants': restaurants,
            'total': total,
            'limit': limit,
            'offset': offset,
            'has_more': (offset + limit) < total,
        }

    def get_by_city(self, city: str, limit: int = 50) -> List[Restaurant]:
        """Get restaurants in a specific city."""
        return self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .filter(Restaurant.city.ilike(f'%{city}%'))\
            .order_by(desc(Restaurant.google_rating))\
            .limit(limit)\
            .all()

    def get_by_cuisine(self, cuisine: str, limit: int = 50) -> List[Restaurant]:
        """Get restaurants by cuisine type."""
        return self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .filter(Restaurant.cuisine_type.ilike(f'%{cuisine}%'))\
            .order_by(desc(Restaurant.google_rating))\
            .limit(limit)\
            .all()

    def get_nearby(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0,
        limit: int = 20
    ) -> List[Restaurant]:
        """
        Get restaurants near a location.

        Uses simple bounding box for performance, then sorts by distance.
        """
        # Approximate degrees per km (at Israel's latitude ~32°)
        deg_per_km = 0.009  # ~1/111

        lat_delta = radius_km * deg_per_km
        lng_delta = radius_km * deg_per_km * 1.2  # Adjust for longitude

        restaurants = self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .filter(
                and_(
                    Restaurant.latitude.isnot(None),
                    Restaurant.longitude.isnot(None),
                    Restaurant.latitude.between(lat - lat_delta, lat + lat_delta),
                    Restaurant.longitude.between(lng - lng_delta, lng + lng_delta),
                )
            )\
            .limit(limit * 2)\
            .all()

        # Calculate actual distance and filter/sort
        def distance(r):
            if r.latitude is None or r.longitude is None:
                return float('inf')
            return ((r.latitude - lat) ** 2 + (r.longitude - lng) ** 2) ** 0.5

        restaurants = sorted(restaurants, key=distance)
        return restaurants[:limit]

    def get_top_rated(self, limit: int = 20) -> List[Restaurant]:
        """Get top-rated restaurants."""
        return self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .filter(Restaurant.google_rating.isnot(None))\
            .order_by(desc(Restaurant.google_rating))\
            .limit(limit)\
            .all()

    def get_recent(self, days: int = 30, limit: int = 20) -> List[Restaurant]:
        """Get recently added restaurants."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=days)

        return self.db.query(Restaurant)\
            .options(joinedload(Restaurant.episode))\
            .filter(Restaurant.created_at >= cutoff)\
            .order_by(desc(Restaurant.created_at))\
            .limit(limit)\
            .all()

    def get_stats(self) -> Dict[str, Any]:
        """Get restaurant statistics."""
        total = self.count()

        # Count by city
        cities = self.db.query(
            Restaurant.city,
            func.count(Restaurant.id)
        ).group_by(Restaurant.city).all()

        # Count by cuisine
        cuisines = self.db.query(
            Restaurant.cuisine_type,
            func.count(Restaurant.id)
        ).group_by(Restaurant.cuisine_type).all()

        # Average rating
        avg_rating = self.db.query(func.avg(Restaurant.google_rating)).scalar()

        return {
            'total': total,
            'by_city': {city: count for city, count in cities if city},
            'by_cuisine': {cuisine: count for cuisine, count in cuisines if cuisine},
            'average_rating': round(float(avg_rating), 2) if avg_rating else None,
        }

    def get_unique_cities(self) -> List[str]:
        """Get list of unique cities."""
        result = self.db.query(Restaurant.city)\
            .filter(Restaurant.city.isnot(None))\
            .distinct()\
            .all()
        return [city for (city,) in result if city]

    def get_unique_cuisines(self) -> List[str]:
        """Get list of unique cuisine types."""
        result = self.db.query(Restaurant.cuisine_type)\
            .filter(Restaurant.cuisine_type.isnot(None))\
            .distinct()\
            .all()
        return [cuisine for (cuisine,) in result if cuisine]

    def create_with_history(self, changed_by: str = 'system', **kwargs) -> Restaurant:
        """Create a restaurant and record the action in history."""
        restaurant = self.create(**kwargs)

        # Create history record
        history = RestaurantHistory(
            restaurant_id=restaurant.id,
            action='create',
            changed_by=changed_by,
            changes={'created': kwargs}
        )
        self.db.add(history)
        self.db.commit()

        return restaurant

    def update_with_history(
        self,
        id: str,
        changed_by: str = 'system',
        **kwargs
    ) -> Optional[Restaurant]:
        """Update a restaurant and record changes in history."""
        restaurant = self.get_by_id(id)
        if not restaurant:
            return None

        # Track changes
        changes = {}
        for key, new_value in kwargs.items():
            if hasattr(restaurant, key):
                old_value = getattr(restaurant, key)
                if old_value != new_value:
                    changes[key] = {'old': old_value, 'new': new_value}
                    setattr(restaurant, key, new_value)

        if changes:
            # Create history record
            history = RestaurantHistory(
                restaurant_id=restaurant.id,
                action='update',
                changed_by=changed_by,
                changes=changes
            )
            self.db.add(history)

        self.db.commit()
        self.db.refresh(restaurant)
        return restaurant

    def get_history(self, restaurant_id: str, limit: int = 50) -> List[RestaurantHistory]:
        """Get change history for a restaurant."""
        return self.db.query(RestaurantHistory)\
            .filter(RestaurantHistory.restaurant_id == restaurant_id)\
            .order_by(desc(RestaurantHistory.created_at))\
            .limit(limit)\
            .all()

    def import_from_dict(self, data: Dict[str, Any], episode_id: Optional[str] = None) -> Restaurant:
        """
        Import a restaurant from a dictionary (e.g., from JSON file).

        Maps the old JSON format to the new model fields.
        """
        location = data.get('location', {})
        contact = data.get('contact_info', {})
        rating = data.get('rating', {})
        google_places = data.get('google_places', {})
        episode_info = data.get('episode_info', {})

        return self.create(
            id=data.get('id'),
            episode_id=episode_id,
            name_hebrew=data.get('name_hebrew', ''),
            name_english=data.get('name_english'),
            city=location.get('city'),
            neighborhood=location.get('neighborhood'),
            address=location.get('address'),
            region=location.get('region', 'Center'),
            latitude=location.get('lat'),
            longitude=location.get('lng'),
            cuisine_type=data.get('cuisine_type'),
            status=data.get('status', 'open'),
            price_range=data.get('price_range'),
            host_opinion=data.get('host_opinion'),
            host_comments=data.get('host_comments'),
            menu_items=data.get('menu_items'),
            special_features=data.get('special_features'),
            contact_phone=contact.get('phone'),
            contact_website=contact.get('website'),
            contact_social=contact.get('social_media'),
            business_news=data.get('business_news'),
            mention_context=data.get('mention_context'),
            mention_timestamp=data.get('mention_timestamp'),
            google_place_id=google_places.get('place_id'),
            google_name=google_places.get('google_name'),
            google_url=google_places.get('google_url'),
            google_rating=rating.get('google_rating'),
            google_user_ratings_total=rating.get('review_count'),
            photos=data.get('photos'),
        )

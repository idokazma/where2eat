"""Restaurant API endpoints.

Supports both SQLAlchemy (PostgreSQL/SQLite) and legacy JSON file storage.
"""

import json
import uuid
import os
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

try:
    from sqlalchemy.orm import Session
except ImportError:
    Session = None

from models.restaurant import (
    Restaurant as RestaurantSchema,
    RestaurantCreate,
    RestaurantUpdate,
    RestaurantList,
    RestaurantSearchResponse,
)

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])

# Data directory path for legacy JSON storage
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "restaurants"


def _get_data_directory() -> Path:
    """Get the data directory, respecting DATABASE_DIR env var for Railway volumes."""
    db_dir = os.getenv('DATABASE_DIR')
    if db_dir:
        return Path(db_dir)
    default_dir = Path(__file__).parent.parent.parent / "data"
    if default_dir.exists():
        return default_dir
    railway_dir = Path("/app/data")
    if railway_dir.exists():
        return railway_dir
    return default_dir


def _get_sqlite_db():
    """Get a native SQLite Database instance (used by the pipeline)."""
    try:
        from database import Database
        db_path = _get_data_directory() / "where2eat.db"
        if db_path.exists():
            return Database(str(db_path))
    except Exception as e:
        print(f"Warning: Could not open SQLite database: {e}")
    return None


def use_sqlalchemy() -> bool:
    """Check if we should use SQLAlchemy (PostgreSQL/SQLite ORM)."""
    return os.getenv('DATABASE_URL') is not None or os.getenv('USE_SQLALCHEMY', '').lower() == 'true'


def get_db_session():
    """Get database session if using SQLAlchemy."""
    if not use_sqlalchemy():
        return None
    try:
        import importlib.util

        # Explicitly load src/models/base.py to avoid collision with api/models
        src_base_path = Path(__file__).parent.parent.parent / "src" / "models" / "base.py"
        if not src_base_path.exists():
            # Try Railway absolute path
            src_base_path = Path("/app/src/models/base.py")

        if not src_base_path.exists():
            print(f"Warning: Could not find src/models/base.py at {src_base_path}")
            return None

        spec = importlib.util.spec_from_file_location("src_models_base", src_base_path)
        src_models_base = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(src_models_base)

        return src_models_base.get_db_session()
    except Exception as e:
        print(f"Warning: Could not get database session: {e}")
        return None


# ============================================================================
# Native SQLite operations (primary - used by the pipeline)
# ============================================================================

def _is_valid_restaurant(r: dict) -> bool:
    """Filter out garbage entries from poor AI extraction.

    Checks that a restaurant has a real name and location, not a
    partial Hebrew sentence fragment.
    """
    name = (r.get("name_hebrew") or "").strip()
    if not name or len(name) < 2:
        return False
    # City must be set to something real (not "לא צוין" which means "not specified")
    city = ""
    loc = r.get("location")
    if isinstance(loc, dict):
        city = (loc.get("city") or "").strip()
    elif isinstance(loc, str):
        city = loc.strip()
    else:
        city = (r.get("city") or "").strip()
    if not city or city == "לא צוין":
        return False
    return True


def load_all_restaurants_sqlite() -> List[dict]:
    """Load all restaurants from the native SQLite database (pipeline storage)."""
    db = _get_sqlite_db()
    if not db:
        return []
    try:
        restaurants = db.get_all_restaurants(include_episode_info=True)
        return [r for r in restaurants if _is_valid_restaurant(r)]
    except Exception as e:
        print(f"Warning: Failed to load from SQLite: {e}")
        return []


# ============================================================================
# Legacy JSON file operations (backward compatibility)
# ============================================================================

def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_all_restaurants() -> List[dict]:
    """Load all restaurants from pipeline-processed data only.

    Only serves restaurants that were processed by the video pipeline,
    not seeded from JSON backup files.
    """
    # 1. Try native SQLite (pipeline storage) first
    restaurants = load_all_restaurants_sqlite()
    if restaurants:
        return restaurants

    # 2. Try SQLAlchemy (PostgreSQL) if configured
    if use_sqlalchemy():
        ctx = get_db_session()
        if ctx:
            try:
                with ctx as db:
                    restaurants = load_all_restaurants_db(db)
                    if restaurants:
                        return [r for r in restaurants if _is_valid_restaurant(r)]
            except Exception as e:
                print(f"Warning: SQLAlchemy error: {e}")

    return []


def load_all_restaurants_json() -> List[dict]:
    """Load all restaurants from JSON files."""
    ensure_data_dir()
    restaurants = []
    for file_path in DATA_DIR.glob("*.json"):
        if file_path.name == ".gitkeep":
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if _is_valid_restaurant(data):
                    restaurants.append(data)
        except Exception as e:
            print(f"Warning: Failed to read {file_path}: {e}")
    return restaurants


# ============================================================================
# SQLAlchemy operations
# ============================================================================

def load_all_restaurants_db(db: Session) -> List[dict]:
    """Load all restaurants from SQLAlchemy database.

    Raises on failure so the caller can fall back to SQLite/JSON.
    """
    import sys
    src_path = Path(__file__).parent.parent.parent / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
    from repositories import RestaurantRepository
    repo = RestaurantRepository(db)
    restaurants = repo.get_all_with_episodes(limit=1000)
    return [r.to_dict() for r in restaurants]


def search_restaurants_db(
    db: Session,
    city: Optional[str] = None,
    cuisine: Optional[str] = None,
    price_range: Optional[str] = None,
    status: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Search restaurants using SQLAlchemy.

    Raises on failure so the caller can fall back to SQLite/JSON.
    """
    import sys
    src_path = Path(__file__).parent.parent.parent / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))
    from repositories import RestaurantRepository
    repo = RestaurantRepository(db)
    result = repo.search(
        city=city,
        cuisine=cuisine,
        price_range=price_range,
        status=status,
        query=query,
        limit=limit,
        offset=offset,
    )
    return {
        'restaurants': [r.to_dict() for r in result['restaurants']],
        'total': result['total'],
        'limit': result['limit'],
        'offset': result['offset'],
    }


# ============================================================================
# API Endpoints
# ============================================================================

@router.get(
    "",
    response_model=RestaurantList,
    summary="List all restaurants",
    description="Returns all restaurants in the database.",
)
async def list_restaurants():
    """Get all restaurants."""
    restaurants = load_all_restaurants()
    return RestaurantList(restaurants=restaurants, count=len(restaurants))


@router.get(
    "/search",
    response_model=RestaurantSearchResponse,
    summary="Search restaurants",
    description="Advanced restaurant search with filtering, sorting, and pagination.",
)
async def search_restaurants(
    location: Optional[str] = Query(None, description="Filter by city/location"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine type"),
    price_range: Optional[str] = Query(None, description="Filter by price range"),
    status: Optional[str] = Query(None, description="Filter by status"),
    host_opinion: Optional[str] = Query(None, description="Filter by host opinion"),
    date_start: Optional[str] = Query(None, description="Filter by start date"),
    date_end: Optional[str] = Query(None, description="Filter by end date"),
    episode_id: Optional[str] = Query(None, description="Filter by episode ID"),
    query: Optional[str] = Query(None, description="Search query"),
    sort_by: str = Query("published_at", description="Sort field"),
    sort_direction: str = Query("desc", description="Sort direction (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Search restaurants with filters."""
    offset = (page - 1) * limit

    # Try SQLAlchemy first if configured
    if use_sqlalchemy():
        ctx = get_db_session()
        if ctx:
            try:
                with ctx as db:
                    result = search_restaurants_db(
                        db,
                        city=location,
                        cuisine=cuisine,
                        price_range=price_range,
                        status=status,
                        query=query,
                        limit=limit,
                        offset=offset,
                    )
                    restaurants = result['restaurants']
                    total = result['total']

                    analytics = {
                        "total_count": total,
                        "page": page,
                        "limit": limit,
                        "total_pages": (total + limit - 1) // limit,
                        "filter_counts": {"cuisine": {}, "location": {}, "price_range": {}, "host_opinion": {}},
                        "date_distribution": {},
                    }

                    return RestaurantSearchResponse(
                        restaurants=restaurants,
                        timeline_data=[],
                        analytics=analytics,
                    )
            except Exception as e:
                print(f"Warning: SQLAlchemy error, falling back: {e}")

    # Load from SQLite (pipeline storage) or JSON files
    restaurants = load_all_restaurants()

    # Apply filters
    filtered = restaurants

    if location:
        filtered = [
            r for r in filtered
            if location.lower() in ((r.get("location") or {}).get("city") or "").lower()
        ]

    if cuisine:
        filtered = [
            r for r in filtered
            if cuisine.lower() in (r.get("cuisine_type") or "").lower()
        ]

    if price_range:
        filtered = [r for r in filtered if r.get("price_range") == price_range]

    if status:
        filtered = [r for r in filtered if r.get("status") == status]

    if host_opinion:
        filtered = [r for r in filtered if r.get("host_opinion") == host_opinion]

    if query:
        query_lower = query.lower()
        filtered = [
            r for r in filtered
            if query_lower in (r.get("name_hebrew") or "").lower()
            or query_lower in (r.get("name_english") or "").lower()
            or query_lower in (r.get("host_comments") or "").lower()
        ]

    if episode_id:
        filtered = [
            r for r in filtered
            if r.get("episode_info", {}).get("video_id") == episode_id
        ]

    if date_start or date_end:
        def in_date_range(r):
            analysis_date = r.get("episode_info", {}).get("analysis_date")
            if not analysis_date:
                return False
            if date_start and analysis_date < date_start:
                return False
            if date_end and analysis_date > date_end:
                return False
            return True
        filtered = [r for r in filtered if in_date_range(r)]

    # Generate analytics
    analytics = {
        "total_count": len(filtered),
        "page": page,
        "limit": limit,
        "total_pages": (len(filtered) + limit - 1) // limit,
        "filter_counts": {
            "cuisine": {},
            "location": {},
            "price_range": {},
            "host_opinion": {},
        },
        "date_distribution": {},
    }

    for r in filtered:
        if r.get("cuisine_type"):
            cuisine_type = r["cuisine_type"]
            analytics["filter_counts"]["cuisine"][cuisine_type] = (
                analytics["filter_counts"]["cuisine"].get(cuisine_type, 0) + 1
            )
        if (r.get("location") or {}).get("city"):
            city = r["location"]["city"]
            analytics["filter_counts"]["location"][city] = (
                analytics["filter_counts"]["location"].get(city, 0) + 1
            )
        if r.get("price_range"):
            pr = r["price_range"]
            analytics["filter_counts"]["price_range"][pr] = (
                analytics["filter_counts"]["price_range"].get(pr, 0) + 1
            )
        if r.get("host_opinion"):
            ho = r["host_opinion"]
            analytics["filter_counts"]["host_opinion"][ho] = (
                analytics["filter_counts"]["host_opinion"].get(ho, 0) + 1
            )

    # Apply sorting
    def get_sort_value(r):
        if sort_by == "name":
            return r.get("name_hebrew") or ""
        elif sort_by == "location":
            return (r.get("location") or {}).get("city") or ""
        elif sort_by == "cuisine":
            return r.get("cuisine_type") or ""
        elif sort_by == "rating":
            return (r.get("rating") or {}).get("google_rating", 0) or 0
        elif sort_by == "published_at":
            return r.get("published_at") or (r.get("episode_info") or {}).get("published_at") or (r.get("episode_info") or {}).get("analysis_date") or ""
        else:  # analysis_date
            return (r.get("episode_info") or {}).get("analysis_date") or ""

    filtered.sort(key=get_sort_value, reverse=(sort_direction == "desc"))

    # Apply pagination
    start_index = (page - 1) * limit
    paginated = filtered[start_index : start_index + limit]

    # Generate timeline data
    date_groups = {}
    for r in paginated:
        analysis_date = r.get("episode_info", {}).get("analysis_date")
        if analysis_date:
            date_key = analysis_date.split("T")[0]
            if date_key not in date_groups:
                date_groups[date_key] = []
            date_groups[date_key].append({
                "name_hebrew": r.get("name_hebrew"),
                "name_english": r.get("name_english"),
                "cuisine_type": r.get("cuisine_type"),
                "location": r.get("location"),
                "host_opinion": r.get("host_opinion"),
                "episode_id": r.get("episode_info", {}).get("video_id"),
            })

    timeline_data = [
        {"date": date, "restaurants": rests, "count": len(rests)}
        for date, rests in sorted(date_groups.items(), reverse=True)
    ]

    return RestaurantSearchResponse(
        restaurants=paginated,
        timeline_data=timeline_data,
        analytics=analytics,
    )


@router.get(
    "/{restaurant_id}",
    response_model=RestaurantSchema,
    summary="Get restaurant by ID",
    description="Returns a single restaurant by its ID.",
)
async def get_restaurant(restaurant_id: str):
    """Get a single restaurant by ID."""
    # 1. Try native SQLite first (pipeline storage)
    db = _get_sqlite_db()
    if db:
        try:
            restaurant = db.get_restaurant(restaurant_id)
            if restaurant:
                return restaurant
        except Exception as e:
            print(f"Warning: SQLite error: {e}")

    # 2. Try SQLAlchemy if configured
    if use_sqlalchemy():
        ctx = get_db_session()
        if ctx:
            try:
                import sys
                src_path = Path(__file__).parent.parent.parent / "src"
                if str(src_path) not in sys.path:
                    sys.path.insert(0, str(src_path))
                from repositories import RestaurantRepository
                with ctx as db:
                    repo = RestaurantRepository(db)
                    restaurant = repo.get_by_id_with_episode(restaurant_id)
                    if restaurant:
                        return restaurant.to_dict()
            except Exception as e:
                print(f"Warning: SQLAlchemy error, falling back to JSON: {e}")

    # 3. Fallback to JSON file
    file_path = DATA_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post(
    "",
    response_model=RestaurantSchema,
    status_code=201,
    summary="Create restaurant",
    description="Create a new restaurant.",
)
async def create_restaurant(restaurant: RestaurantCreate):
    """Create a new restaurant."""
    restaurant_id = str(uuid.uuid4())

    # Try SQLAlchemy first
    if use_sqlalchemy():
        ctx = get_db_session()
        if ctx:
            try:
                import sys
                src_path = Path(__file__).parent.parent.parent / "src"
                if str(src_path) not in sys.path:
                    sys.path.insert(0, str(src_path))
                from repositories import RestaurantRepository
                with ctx as db:
                    repo = RestaurantRepository(db)
                    data = restaurant.model_dump()
                    location = data.pop('location', {}) or {}

                    new_restaurant = repo.create(
                        id=restaurant_id,
                        name_hebrew=data.get('name_hebrew', ''),
                        name_english=data.get('name_english'),
                        cuisine_type=data.get('cuisine_type'),
                        city=location.get('city'),
                        address=location.get('address'),
                        region=location.get('region'),
                        latitude=location.get('lat'),
                        longitude=location.get('lng'),
                        price_range=data.get('price_range'),
                        status=data.get('status'),
                        host_opinion=data.get('host_opinion'),
                    )
                    return new_restaurant.to_dict()
            except Exception as e:
                print(f"Warning: SQLAlchemy error, falling back to JSON: {e}")

    # Fallback to JSON file
    ensure_data_dir()
    file_path = DATA_DIR / f"{restaurant_id}.json"

    restaurant_data = restaurant.model_dump()
    restaurant_data["id"] = restaurant_id
    restaurant_data["created_at"] = datetime.now().isoformat()
    restaurant_data["updated_at"] = datetime.now().isoformat()

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(restaurant_data, f, ensure_ascii=False, indent=2)

    return restaurant_data


@router.put(
    "/{restaurant_id}",
    response_model=RestaurantSchema,
    summary="Update restaurant",
    description="Update an existing restaurant.",
)
async def update_restaurant(restaurant_id: str, restaurant: RestaurantUpdate):
    """Update a restaurant."""
    # Try SQLAlchemy first
    if use_sqlalchemy():
        ctx = get_db_session()
        if ctx:
            try:
                import sys
                src_path = Path(__file__).parent.parent.parent / "src"
                if str(src_path) not in sys.path:
                    sys.path.insert(0, str(src_path))
                from repositories import RestaurantRepository
                with ctx as db:
                    repo = RestaurantRepository(db)
                    data = restaurant.model_dump(exclude_unset=True)
                    location = data.pop('location', None)

                    update_data = {k: v for k, v in data.items() if v is not None}
                    if location:
                        if location.get('city'):
                            update_data['city'] = location['city']
                        if location.get('address'):
                            update_data['address'] = location['address']
                        if location.get('region'):
                            update_data['region'] = location['region']
                        if location.get('lat'):
                            update_data['latitude'] = location['lat']
                        if location.get('lng'):
                            update_data['longitude'] = location['lng']

                    updated = repo.update(restaurant_id, **update_data)
                    if not updated:
                        raise HTTPException(status_code=404, detail="Restaurant not found")
                    return updated.to_dict()
            except HTTPException:
                raise
            except Exception as e:
                print(f"Warning: SQLAlchemy error, falling back to JSON: {e}")

    # Fallback to JSON file
    file_path = DATA_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Load existing data to preserve fields not in update
    with open(file_path, "r", encoding="utf-8") as f:
        existing = json.load(f)

    restaurant_data = restaurant.model_dump(exclude_unset=True)
    restaurant_data["id"] = restaurant_id
    restaurant_data["updated_at"] = datetime.now().isoformat()
    restaurant_data["created_at"] = existing.get("created_at")

    # Merge with existing data
    existing.update(restaurant_data)

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    return existing


@router.delete(
    "/{restaurant_id}",
    summary="Delete restaurant",
    description="Delete a restaurant by ID.",
)
async def delete_restaurant(restaurant_id: str):
    """Delete a restaurant."""
    # Try SQLAlchemy first
    if use_sqlalchemy():
        ctx = get_db_session()
        if ctx:
            try:
                import sys
                src_path = Path(__file__).parent.parent.parent / "src"
                if str(src_path) not in sys.path:
                    sys.path.insert(0, str(src_path))
                from repositories import RestaurantRepository
                with ctx as db:
                    repo = RestaurantRepository(db)
                    if not repo.delete(restaurant_id):
                        raise HTTPException(status_code=404, detail="Restaurant not found")
                    return {"message": "Restaurant deleted successfully"}
            except HTTPException:
                raise
            except Exception as e:
                print(f"Warning: SQLAlchemy error, falling back to JSON: {e}")

    # Fallback to JSON file
    file_path = DATA_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    file_path.unlink()
    return {"message": "Restaurant deleted successfully"}

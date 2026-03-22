"""Restaurant API endpoints.

Supports both SQLAlchemy (PostgreSQL/SQLite) and legacy JSON file storage.
"""

import json
import math
import uuid
import os
import traceback
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

    # 3. Fallback to JSON files
    return load_all_restaurants_json()


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
    # Filter out hidden restaurants from public listing
    restaurants = [r for r in restaurants if not r.get("is_hidden")]
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
    limit: int = Query(20, ge=1, le=500, description="Items per page"),
    include_hidden: bool = Query(False, description="Include hidden restaurants (for admin)"),
    user_lat: Optional[float] = Query(None, description="User latitude for distance sorting"),
    user_lng: Optional[float] = Query(None, description="User longitude for distance sorting"),
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

    # Filter out hidden restaurants from public search (admin can override)
    if not include_hidden:
        filtered = [r for r in filtered if not r.get("is_hidden")]

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
    # Distance sort when user coordinates are provided
    if user_lat is not None and user_lng is not None:
        def _haversine_dist(r):
            loc = r.get("location") or {}
            lat = loc.get("lat") or (loc.get("coordinates") or {}).get("latitude")
            lng = loc.get("lng") or (loc.get("coordinates") or {}).get("longitude")
            if lat is None or lng is None:
                # Also check top-level lat/lng
                lat = lat or r.get("latitude")
                lng = lng or r.get("longitude")
            if lat is None or lng is None:
                return float("inf")
            d_lat = math.radians(lat - user_lat)
            d_lng = math.radians(lng - user_lng)
            a = (math.sin(d_lat / 2) ** 2 +
                 math.cos(math.radians(user_lat)) *
                 math.cos(math.radians(lat)) *
                 math.sin(d_lng / 2) ** 2)
            return 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        filtered.sort(key=_haversine_dist)
    else:
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
                # Fallback: attach episode_info from episodes table if denormalized columns are empty
                if restaurant.get('episode_id') and not restaurant.get('episode_info'):
                    try:
                        episode = db.get_episode(episode_id=restaurant['episode_id'])
                        if episode:
                            restaurant['episode_info'] = {
                                'video_id': episode.get('video_id'),
                                'video_url': episode.get('video_url'),
                                'channel_name': episode.get('channel_name'),
                                'title': episode.get('title'),
                                'analysis_date': episode.get('analysis_date'),
                                'published_at': episode.get('published_at'),
                            }
                    except Exception:
                        pass
                # Return 404 for hidden restaurants on public endpoint
                if restaurant.get("is_hidden"):
                    raise HTTPException(status_code=404, detail="Restaurant not found")
                return restaurant
        except HTTPException:
            raise
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
    data = restaurant.model_dump()
    restaurant_id = data.get('id') or str(uuid.uuid4())

    # 1. Try native SQLite first (matches GET endpoint pattern)
    db = _get_sqlite_db()
    if db:
        try:
            # Check for existing restaurant with same ID
            existing = db.get_restaurant(restaurant_id)
            if existing:
                # Already exists — update instead of creating duplicate
                flat = {}
                location = data.get('location') or {}
                for k, v in data.items():
                    if k not in ('location', 'id') and v is not None:
                        flat[k] = v
                if location:
                    if location.get('city'):
                        flat['city'] = location['city']
                    if location.get('lat'):
                        flat['latitude'] = location['lat']
                    if location.get('lng'):
                        flat['longitude'] = location['lng']
                db.update_restaurant(restaurant_id, **flat)
                return db.get_restaurant(restaurant_id)

            new_id = db.create_restaurant(
                name_hebrew=data.get('name_hebrew', ''),
                episode_id=data.get('episode_id'),
                id=restaurant_id,
                **{k: v for k, v in data.items() if k not in ('name_hebrew', 'episode_id', 'id')},
            )
            result = db.get_restaurant(new_id)
            if result:
                return result
        except Exception as e:
            print(f"Warning: SQLite create error: {e}")

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
                with ctx as db_session:
                    repo = RestaurantRepository(db_session)
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

    # 3. Fallback to JSON file
    ensure_data_dir()
    file_path = DATA_DIR / f"{restaurant_id}.json"

    data["id"] = restaurant_id
    data["created_at"] = datetime.now().isoformat()
    data["updated_at"] = datetime.now().isoformat()

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return data


@router.put(
    "/{restaurant_id}",
    response_model=RestaurantSchema,
    summary="Update restaurant",
    description="Update an existing restaurant.",
)
async def update_restaurant(restaurant_id: str, restaurant: RestaurantUpdate):
    """Update a restaurant."""
    data = restaurant.model_dump(exclude_unset=True)
    location = data.pop('location', None)

    update_data = {k: v for k, v in data.items() if v is not None}
    # Map API field name to DB column name
    if 'mention_timestamp_seconds' in update_data:
        update_data['mention_timestamp'] = update_data.pop('mention_timestamp_seconds')
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

    # 1. Try native SQLite first (pipeline storage)
    db = _get_sqlite_db()
    if db:
        try:
            existing = db.get_restaurant(restaurant_id)
            if existing:
                success = db.update_restaurant(restaurant_id, **update_data)
                if success:
                    return db.get_restaurant(restaurant_id)
        except Exception as e:
            print(f"Warning: SQLite update error: {e}")

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
                with ctx as db_session:
                    repo = RestaurantRepository(db_session)
                    updated = repo.update(restaurant_id, **update_data)
                    if not updated:
                        raise HTTPException(status_code=404, detail="Restaurant not found")
                    return updated.to_dict()
            except HTTPException:
                raise
            except Exception as e:
                print(f"Warning: SQLAlchemy error, falling back to JSON: {e}")

    # 3. Fallback to JSON file
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


def _run_enrichment(restaurant_id: str):
    """Run Google Places enrichment synchronously (called from thread pool)."""
    db = _get_sqlite_db()
    if not db:
        return {"success": False, "error": "Database not available"}

    restaurant = db.get_restaurant(restaurant_id)
    if not restaurant:
        return {"success": False, "error": "Restaurant not found"}

    try:
        from google_places_enricher import GooglePlacesEnricher

        api_key = os.getenv("GOOGLE_PLACES_API_KEY")
        if not api_key:
            return {"success": False, "error": "GOOGLE_PLACES_API_KEY not configured"}

        enricher = GooglePlacesEnricher(api_key)

        # Clear previous enrichment so it re-runs fresh
        restaurant.pop("google_place_id", None)
        restaurant.pop("google_places_enriched", None)
        restaurant.pop("image_url", None)
        restaurant.pop("photos", None)
        restaurant.pop("og_image_url", None)
        gp = restaurant.get("google_places")
        if isinstance(gp, dict):
            gp.pop("place_id", None)

        enriched = enricher.enrich_restaurant(restaurant)

        if enriched.get("google_places_enriched") or (
            isinstance(enriched.get("google_places"), dict)
            and enriched["google_places"].get("place_id")
        ):
            update_data = {}
            coords = enriched.get("location", {}).get("coordinates", {})
            if coords:
                update_data["latitude"] = coords.get("latitude")
                update_data["longitude"] = coords.get("longitude")
            gp = enriched.get("google_places", {})
            if gp and gp.get("place_id"):
                update_data["google_place_id"] = gp["place_id"]
                update_data["google_name"] = gp.get("google_name")
                update_data["google_url"] = gp.get("google_url")
            rating = enriched.get("rating", {})
            if rating:
                update_data["google_rating"] = rating.get("google_rating")
                update_data["google_user_ratings_total"] = rating.get("total_reviews") or rating.get("user_ratings_total")
            if enriched.get("image_url"):
                update_data["image_url"] = enriched["image_url"]
            if enriched.get("photos"):
                update_data["photos"] = json.dumps(enriched["photos"], ensure_ascii=False)
            if enriched.get("og_image_url"):
                update_data["og_image_url"] = enriched["og_image_url"]
            loc = enriched.get("location", {})
            if loc.get("full_address"):
                update_data["address"] = loc["full_address"]

            if update_data:
                db.update_restaurant(restaurant_id, **update_data)

            updated = db.get_restaurant(restaurant_id)
            return {"success": True, "restaurant": updated}
        else:
            return {"success": False, "error": "Google Places enrichment found no match"}

    except ImportError as e:
        print(f"[REPROCESS] ImportError: {e}")
        traceback.print_exc()
        return {"success": False, "error": f"Module not available: {e}"}
    except Exception as e:
        print(f"[REPROCESS] Error enriching {restaurant_id}: {e}")
        traceback.print_exc()
        return {"success": False, "error": f"Enrichment failed: {str(e)}"}


@router.post(
    "/{restaurant_id}/reprocess",
    summary="Reprocess restaurant",
    description="Re-run Google Places enrichment for a restaurant using its current (possibly edited) fields.",
)
async def reprocess_restaurant(restaurant_id: str):
    """Re-enrich a single restaurant via Google Places using its current DB fields."""
    import asyncio
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _run_enrichment, restaurant_id)

    if not result.get("success") and "not found" in result.get("error", "").lower():
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.delete(
    "/{restaurant_id}",
    summary="Delete restaurant",
    description="Delete a restaurant by ID.",
)
async def delete_restaurant(restaurant_id: str):
    """Delete a restaurant."""
    # Try native SQLite first
    db = _get_sqlite_db()
    if db:
        try:
            existing = db.get_restaurant(restaurant_id)
            if existing:
                if db.delete_restaurant(restaurant_id):
                    return {"message": "Restaurant deleted successfully"}
        except Exception as e:
            print(f"Warning: SQLite delete error: {e}")

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

"""Restaurant API endpoints."""

import os
import json
import uuid
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query

from models.restaurant import (
    Restaurant,
    RestaurantCreate,
    RestaurantUpdate,
    RestaurantList,
    RestaurantSearchResponse,
)

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])

# Data directory path
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "restaurants"


def ensure_data_dir():
    """Ensure the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_all_restaurants() -> List[dict]:
    """Load all restaurants from JSON files."""
    ensure_data_dir()
    restaurants = []
    for file_path in DATA_DIR.glob("*.json"):
        if file_path.name == ".gitkeep":
            continue
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                restaurants.append(data)
        except Exception as e:
            print(f"Warning: Failed to read {file_path}: {e}")
    return restaurants


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
    sort_by: str = Query("analysis_date", description="Sort field"),
    sort_direction: str = Query("desc", description="Sort direction (asc/desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Search restaurants with filters."""
    restaurants = load_all_restaurants()

    # Apply filters
    filtered = restaurants

    if location:
        filtered = [
            r for r in filtered
            if r.get("location", {}).get("city", "").lower().find(location.lower()) >= 0
        ]

    if cuisine:
        filtered = [
            r for r in filtered
            if r.get("cuisine_type", "").lower().find(cuisine.lower()) >= 0
        ]

    if price_range:
        filtered = [r for r in filtered if r.get("price_range") == price_range]

    if status:
        filtered = [r for r in filtered if r.get("status") == status]

    if host_opinion:
        filtered = [r for r in filtered if r.get("host_opinion") == host_opinion]

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
        if r.get("location", {}).get("city"):
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
            return r.get("name_hebrew", "")
        elif sort_by == "location":
            return r.get("location", {}).get("city", "")
        elif sort_by == "cuisine":
            return r.get("cuisine_type", "")
        elif sort_by == "rating":
            return r.get("rating", {}).get("google_rating", 0) or 0
        else:  # analysis_date
            return r.get("episode_info", {}).get("analysis_date", "")

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
        {"date": date, "restaurants": restaurants, "count": len(restaurants)}
        for date, restaurants in sorted(date_groups.items(), reverse=True)
    ]

    return RestaurantSearchResponse(
        restaurants=paginated,
        timeline_data=timeline_data,
        analytics=analytics,
    )


@router.get(
    "/{restaurant_id}",
    response_model=Restaurant,
    summary="Get restaurant by ID",
    description="Returns a single restaurant by its ID.",
)
async def get_restaurant(restaurant_id: str):
    """Get a single restaurant by ID."""
    file_path = DATA_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post(
    "",
    response_model=Restaurant,
    status_code=201,
    summary="Create restaurant",
    description="Create a new restaurant.",
)
async def create_restaurant(restaurant: RestaurantCreate):
    """Create a new restaurant."""
    ensure_data_dir()
    restaurant_id = str(uuid.uuid4())
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
    response_model=Restaurant,
    summary="Update restaurant",
    description="Update an existing restaurant.",
)
async def update_restaurant(restaurant_id: str, restaurant: RestaurantUpdate):
    """Update a restaurant."""
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
    file_path = DATA_DIR / f"{restaurant_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Restaurant not found")

    file_path.unlink()
    return {"message": "Restaurant deleted successfully"}

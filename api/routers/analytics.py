"""Analytics API endpoints."""

from typing import Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from models.analytics import (
    TimelineResponse,
    TrendsResponse,
    EpisodeSearchResponse,
)
from routers.restaurants import load_all_restaurants

router = APIRouter(prefix="/api", tags=["Analytics"])


@router.get(
    "/episodes/search",
    response_model=EpisodeSearchResponse,
    summary="Search episodes",
    description="Search and filter podcast episodes with their restaurant mentions.",
)
async def search_episodes(
    date_start: Optional[str] = Query(None, description="Filter by start date"),
    date_end: Optional[str] = Query(None, description="Filter by end date"),
    cuisine_filter: Optional[str] = Query(None, description="Filter by cuisine type"),
    location_filter: Optional[str] = Query(None, description="Filter by location"),
    min_restaurants: int = Query(1, ge=1, description="Minimum restaurants per episode"),
    sort_by: str = Query("analysis_date", description="Sort field"),
    sort_direction: str = Query("desc", description="Sort direction"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """Search episodes with restaurant mentions."""
    restaurants = load_all_restaurants()

    # Group restaurants by episode
    episode_groups = {}
    for r in restaurants:
        video_id = r.get("episode_info", {}).get("video_id")
        if video_id:
            if video_id not in episode_groups:
                episode_groups[video_id] = {
                    "episode_info": r.get("episode_info"),
                    "restaurants": [],
                    "food_trends": [],
                    "episode_summary": "",
                }
            episode_groups[video_id]["restaurants"].append(r)

    # Convert to list and apply filters
    episodes = list(episode_groups.values())

    # Date filtering
    if date_start or date_end:
        def in_date_range(ep):
            analysis_date = ep.get("episode_info", {}).get("analysis_date")
            if not analysis_date:
                return False
            if date_start and analysis_date < date_start:
                return False
            if date_end and analysis_date > date_end:
                return False
            return True
        episodes = [ep for ep in episodes if in_date_range(ep)]

    # Cuisine filtering
    if cuisine_filter:
        episodes = [
            ep for ep in episodes
            if any(
                cuisine_filter.lower() in r.get("cuisine_type", "").lower()
                for r in ep["restaurants"]
            )
        ]

    # Location filtering
    if location_filter:
        episodes = [
            ep for ep in episodes
            if any(
                location_filter.lower() in r.get("location", {}).get("city", "").lower()
                for r in ep["restaurants"]
            )
        ]

    # Minimum restaurants filter
    episodes = [ep for ep in episodes if len(ep["restaurants"]) >= min_restaurants]

    # Add matching count
    for ep in episodes:
        ep["matching_restaurants"] = len(ep["restaurants"])

    # Sorting
    def get_sort_value(ep):
        if sort_by == "restaurant_count":
            return len(ep["restaurants"])
        return ep.get("episode_info", {}).get("analysis_date", "")

    episodes.sort(key=get_sort_value, reverse=(sort_direction == "desc"))

    # Pagination
    start_index = (page - 1) * limit
    paginated = episodes[start_index : start_index + limit]

    # Calculate totals
    total_restaurants = sum(len(ep["restaurants"]) for ep in episodes)

    return EpisodeSearchResponse(
        episodes=paginated,
        count=len(episodes),
        total_restaurants=total_restaurants,
    )


@router.get(
    "/analytics/timeline",
    response_model=TimelineResponse,
    summary="Timeline analytics",
    description="Get restaurant discovery timeline with analytics.",
)
async def get_timeline(
    date_start: Optional[str] = Query(None, description="Filter by start date"),
    date_end: Optional[str] = Query(None, description="Filter by end date"),
    granularity: str = Query("day", description="Granularity: day, week, month"),
    cuisine_filter: Optional[str] = Query(None, description="Filter by cuisine type"),
    location_filter: Optional[str] = Query(None, description="Filter by location"),
):
    """Get timeline analytics."""
    restaurants = load_all_restaurants()

    # Apply filters
    filtered = restaurants

    if cuisine_filter:
        filtered = [
            r for r in filtered
            if cuisine_filter.lower() in r.get("cuisine_type", "").lower()
        ]

    if location_filter:
        filtered = [
            r for r in filtered
            if location_filter.lower() in r.get("location", {}).get("city", "").lower()
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

    # Group by time period
    timeline_groups = {}
    for r in filtered:
        analysis_date = r.get("episode_info", {}).get("analysis_date")
        if analysis_date:
            try:
                date = datetime.fromisoformat(analysis_date.replace("Z", "+00:00"))
                if granularity == "week":
                    start_of_week = date - timedelta(days=date.weekday())
                    date_key = start_of_week.strftime("%Y-%m-%d")
                elif granularity == "month":
                    date_key = date.strftime("%Y-%m")
                else:  # day
                    date_key = date.strftime("%Y-%m-%d")

                if date_key not in timeline_groups:
                    timeline_groups[date_key] = []
                timeline_groups[date_key].append({
                    "name_hebrew": r.get("name_hebrew"),
                    "name_english": r.get("name_english"),
                    "cuisine_type": r.get("cuisine_type"),
                    "location": r.get("location"),
                    "host_opinion": r.get("host_opinion"),
                    "episode_id": r.get("episode_info", {}).get("video_id"),
                })
            except Exception:
                pass

    timeline = [
        {"date": date, "restaurants": rests, "count": len(rests)}
        for date, rests in sorted(timeline_groups.items(), reverse=True)
    ]

    # Generate analytics
    analytics = {
        "cuisine_distribution": {},
        "location_distribution": {},
        "opinion_distribution": {},
        "price_distribution": {},
        "monthly_discoveries": {},
        "top_episodes": [],
    }

    for r in filtered:
        if r.get("cuisine_type"):
            ct = r["cuisine_type"]
            analytics["cuisine_distribution"][ct] = analytics["cuisine_distribution"].get(ct, 0) + 1
        if r.get("location", {}).get("city"):
            city = r["location"]["city"]
            analytics["location_distribution"][city] = analytics["location_distribution"].get(city, 0) + 1
        if r.get("host_opinion"):
            ho = r["host_opinion"]
            analytics["opinion_distribution"][ho] = analytics["opinion_distribution"].get(ho, 0) + 1
        if r.get("price_range"):
            pr = r["price_range"]
            analytics["price_distribution"][pr] = analytics["price_distribution"].get(pr, 0) + 1

    # Top episodes by restaurant count
    episode_groups = {}
    for r in filtered:
        video_id = r.get("episode_info", {}).get("video_id")
        if video_id:
            if video_id not in episode_groups:
                episode_groups[video_id] = {
                    "video_id": video_id,
                    "video_url": r.get("episode_info", {}).get("video_url"),
                    "count": 0,
                    "restaurants": [],
                }
            episode_groups[video_id]["count"] += 1
            episode_groups[video_id]["restaurants"].append(r.get("name_hebrew"))

    analytics["top_episodes"] = sorted(
        episode_groups.values(), key=lambda x: x["count"], reverse=True
    )[:10]

    # Date range
    dates = [
        datetime.fromisoformat(r.get("episode_info", {}).get("analysis_date", "").replace("Z", "+00:00"))
        for r in filtered
        if r.get("episode_info", {}).get("analysis_date")
    ]
    date_range = {
        "start": min(dates).timestamp() * 1000 if dates else 0,
        "end": max(dates).timestamp() * 1000 if dates else 0,
    }

    return TimelineResponse(
        timeline=timeline,
        analytics=analytics,
        summary={
            "total_restaurants": len(filtered),
            "unique_episodes": len(episode_groups),
            "date_range": date_range,
        },
    )


@router.get(
    "/analytics/trends",
    response_model=TrendsResponse,
    summary="Trend analytics",
    description="Get restaurant and cuisine trends over time.",
)
async def get_trends(
    period: str = Query("3months", description="Period: 1month, 3months, 6months, 1year"),
    trending_threshold: int = Query(3, ge=1, description="Minimum mentions to be trending"),
):
    """Get trend analytics."""
    restaurants = load_all_restaurants()

    # Calculate period start date
    now = datetime.now()
    if period == "1month":
        period_start = now - timedelta(days=30)
    elif period == "6months":
        period_start = now - timedelta(days=180)
    elif period == "1year":
        period_start = now - timedelta(days=365)
    else:  # 3months
        period_start = now - timedelta(days=90)

    # Filter restaurants within period
    period_restaurants = []
    for r in restaurants:
        analysis_date = r.get("episode_info", {}).get("analysis_date")
        if analysis_date:
            try:
                date = datetime.fromisoformat(analysis_date.replace("Z", "+00:00"))
                if date >= period_start:
                    period_restaurants.append(r)
            except Exception:
                pass

    # Trending restaurants (multiple mentions)
    restaurant_groups = {}
    for r in period_restaurants:
        name = r.get("name_hebrew")
        if name:
            if name not in restaurant_groups:
                restaurant_groups[name] = []
            restaurant_groups[name].append(r)

    trending_restaurants = [
        mentions[0]
        for name, mentions in restaurant_groups.items()
        if len(mentions) >= trending_threshold
    ][:10]

    # Regional patterns
    regional_groups = {
        "North": {"cities": {}, "total": 0, "cuisines": {}, "ratings": []},
        "Center": {"cities": {}, "total": 0, "cuisines": {}, "ratings": []},
        "South": {"cities": {}, "total": 0, "cuisines": {}, "ratings": []},
    }

    for r in period_restaurants:
        region = r.get("location", {}).get("region", "Center")
        city = r.get("location", {}).get("city")
        cuisine = r.get("cuisine_type")
        rating = r.get("rating", {}).get("google_rating")

        if region in regional_groups:
            regional_groups[region]["total"] += 1
            if city:
                regional_groups[region]["cities"][city] = regional_groups[region]["cities"].get(city, 0) + 1
            if cuisine:
                regional_groups[region]["cuisines"][cuisine] = regional_groups[region]["cuisines"].get(cuisine, 0) + 1
            if rating:
                regional_groups[region]["ratings"].append(rating)

    regional_patterns = []
    for region, data in regional_groups.items():
        ratings = data["ratings"]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0
        top_city = max(data["cities"].items(), key=lambda x: x[1])[0] if data["cities"] else ""
        top_cuisine = max(data["cuisines"].items(), key=lambda x: x[1])[0] if data["cuisines"] else ""

        regional_patterns.append({
            "region": region,
            "cities": data["cities"],
            "total": data["total"],
            "cuisines": data["cuisines"],
            "average_rating": avg_rating,
            "total_ratings": len(ratings),
            "top_city": top_city,
            "top_cuisine": top_cuisine,
        })

    # Cuisine trends by month
    cuisine_trends = {}
    last_month = now - timedelta(days=30)

    for r in period_restaurants:
        cuisine = r.get("cuisine_type")
        analysis_date = r.get("episode_info", {}).get("analysis_date")
        if cuisine and analysis_date:
            try:
                date = datetime.fromisoformat(analysis_date.replace("Z", "+00:00"))
                month_key = date.strftime("%Y-%m")

                if cuisine not in cuisine_trends:
                    cuisine_trends[cuisine] = {
                        "cuisine": cuisine,
                        "monthly_counts": {},
                        "total": 0,
                        "recent_mentions": 0,
                    }

                cuisine_trends[cuisine]["total"] += 1
                cuisine_trends[cuisine]["monthly_counts"][month_key] = (
                    cuisine_trends[cuisine]["monthly_counts"].get(month_key, 0) + 1
                )

                if date >= last_month:
                    cuisine_trends[cuisine]["recent_mentions"] += 1
            except Exception:
                pass

    cuisine_trends_list = sorted(
        cuisine_trends.values(), key=lambda x: x["total"], reverse=True
    )[:10]

    # Most active region
    most_active_region = max(
        regional_patterns, key=lambda x: x["total"]
    )["region"] if regional_patterns else ""

    return TrendsResponse(
        trending_restaurants=trending_restaurants,
        regional_patterns=regional_patterns,
        cuisine_trends=cuisine_trends_list,
        period_summary={
            "period": period,
            "restaurants_discovered": len(period_restaurants),
            "most_active_region": most_active_region,
        },
    )

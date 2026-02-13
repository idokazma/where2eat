"""Google Places API endpoints."""

import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter(prefix="/api/places", tags=["Places"])


def get_api_key() -> str:
    """Get Google Places API key from environment."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Google Places API key not configured"
        )
    return api_key


@router.get(
    "/search",
    summary="Search places",
    description="Search for places using Google Places Text Search API.",
)
async def search_places(
    query: str = Query(..., description="Search query"),
    location: Optional[str] = Query(None, description="Location bias"),
):
    """Search for places."""
    if not query:
        raise HTTPException(status_code=400, detail="Search query required")

    api_key = get_api_key()
    search_url = f"https://maps.googleapis.com/maps/api/place/textsearch/json"

    params = {
        "query": query,
        "key": api_key,
    }
    if location:
        params["location"] = location

    async with httpx.AsyncClient() as client:
        response = await client.get(search_url, params=params)
        data = response.json()

    if data.get("status") == "OK":
        places = [
            {
                "place_id": place.get("place_id"),
                "name": place.get("name"),
                "formatted_address": place.get("formatted_address"),
                "geometry": place.get("geometry"),
                "rating": place.get("rating"),
                "price_level": place.get("price_level"),
                "types": place.get("types"),
                "photos": place.get("photos", [])[:3],
            }
            for place in data.get("results", [])
        ]
        return {"places": places}
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Google Places API error: {data.get('status')}",
        )


@router.get(
    "/details/{place_id}",
    summary="Get place details",
    description="Get detailed information about a place.",
)
async def get_place_details(place_id: str):
    """Get place details."""
    api_key = get_api_key()
    fields = "place_id,name,formatted_address,geometry,rating,price_level,formatted_phone_number,website,opening_hours,photos,reviews"
    details_url = f"https://maps.googleapis.com/maps/api/place/details/json"

    params = {
        "place_id": place_id,
        "fields": fields,
        "key": api_key,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(details_url, params=params)
        data = response.json()

    if data.get("status") == "OK":
        return {"place": data.get("result")}
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Google Places API error: {data.get('status')}",
        )


@router.get(
    "/photo/{reference}",
    summary="Proxy Google Places photo",
    description="Fetches a Google Places photo by reference, hiding the API key.",
)
async def get_photo(
    reference: str,
    maxwidth: int = Query(800, ge=100, le=1600),
):
    """Proxy a Google Places photo to hide the API key."""
    api_key = get_api_key()
    photo_url = (
        f"https://maps.googleapis.com/maps/api/place/photo"
        f"?maxwidth={maxwidth}&photoreference={reference}&key={api_key}"
    )

    async with httpx.AsyncClient(follow_redirects=True) as client:
        resp = await client.get(photo_url)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch photo")

    content_type = resp.headers.get("content-type", "image/jpeg")
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=604800, immutable"},
    )

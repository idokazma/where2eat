"""Google Places photo proxy endpoints."""

import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter(prefix="/api/photos", tags=["Photos"])


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
    "/{reference:path}",
    summary="Proxy Google Places photo",
    description="""
    Fetches a Google Places photo by reference, hiding the API key from the client.

    Supports both old and new Google Places API photo references:
    - Old API: plain photo reference string (e.g., "Aaw_Ecb3...")
    - New API: photo name starting with "places/" (e.g., "places/PLACE_ID/photos/PHOTO_ID")

    The photo is cached for 7 days (604800 seconds).
    """,
    response_class=Response,
)
async def get_photo(
    reference: str,
    maxwidth: int = Query(
        800,
        ge=100,
        le=1600,
        description="Maximum width of the photo in pixels"
    ),
):
    """
    Proxy a Google Places photo to hide the API key.

    Args:
        reference: Photo reference (old API) or photo name (new API format: places/.../photos/...)
        maxwidth: Maximum width of the photo in pixels (100-1600)

    Returns:
        Image response with proper caching headers

    Raises:
        HTTPException: If reference is missing, API key is not configured, or photo fetch fails
    """
    if not reference:
        raise HTTPException(
            status_code=400,
            detail="Photo reference is required"
        )

    api_key = get_api_key()

    # Detect API version based on reference format
    # New API format: "places/PLACE_ID/photos/PHOTO_ID"
    is_new_api = reference.startswith("places/") and "/photos/" in reference

    if is_new_api:
        # New Places API (v1) - use photo name directly in path
        photo_url = (
            f"https://places.googleapis.com/v1/{reference}/media"
            f"?maxWidthPx={maxwidth}&key={api_key}"
        )
    else:
        # Old Places API - use photo reference as query parameter
        photo_url = (
            f"https://maps.googleapis.com/maps/api/place/photo"
            f"?maxwidth={maxwidth}&photoreference={reference}&key={api_key}"
        )

    # Fetch photo from Google with redirect following
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            resp = await client.get(photo_url)
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="Photo fetch timed out"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch photo: {str(e)}"
            )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Failed to fetch photo from Google Places API (status: {resp.status_code})"
        )

    # Get content type from response, default to JPEG
    content_type = resp.headers.get("content-type", "image/jpeg")

    # Return image with caching headers
    # Cache for 7 days (604800 seconds) with immutable flag
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={
            "Cache-Control": "public, max-age=604800, immutable",
        },
    )

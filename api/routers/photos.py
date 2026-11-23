"""Google Places photo proxy endpoints.

Read-through cache (owner decision 22.11.2026): every photo fetched from Google
is saved on our volume (photo_cache/) and served from there afterwards, so each
photo is paid for once instead of on every view. Google's terms forbid caching
Places content; the owner accepted that risk. DELETE /api/admin/place-photos
removes the saved copies.
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx
from cost_ledger import async_places_request, BudgetExceeded
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, Response

router = APIRouter(prefix="/api/photos", tags=["Photos"])

CACHE_WIDTH = 1200          # one saved copy per photo serves every requested width
MISS_TTL_SECONDS = 7 * 24 * 3600   # a photo Google could not give is not paid for again for a week
FRESH_TTL_SECONDS = 3600
CACHE_HEADERS = {
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
}
# place_id -> (fetched_at, fresh photo names): one Place Details call per place, not per photo.
_fresh_names: Dict[str, Tuple[float, List[str]]] = {}


def cache_dir() -> Optional[Path]:
    """The saved-photo folder on the volume, or None when storage is unavailable."""
    try:
        from routers.venue_images import asset_root
        path = asset_root().parent / "photo_cache"
        path.mkdir(parents=True, exist_ok=True)
        return path
    except Exception:
        return None


def _media_url(reference: str, api_key: str) -> str:
    if reference.startswith("places/") and "/photos/" in reference:
        return f"https://places.googleapis.com/v1/{reference}/media?maxWidthPx={CACHE_WIDTH}&key={api_key}"
    return (f"https://maps.googleapis.com/maps/api/place/photo"
            f"?maxwidth={CACHE_WIDTH}&photoreference={reference}&key={api_key}")


def _reference_index(place_id: str, reference: str) -> int:
    """Position of an (expired) reference in the restaurant's stored photo list."""
    try:
        from database import Database
        restaurant = Database().get_restaurant(place_id) or {}
        refs = [p.get("photo_reference") for p in restaurant.get("photos") or [] if isinstance(p, dict)]
        return refs.index(reference) if reference in refs else 0
    except Exception:
        return 0


async def _fresh_name(client: httpx.AsyncClient, reference: str, api_key: str) -> Optional[str]:
    """Google photo names expire. Get the place's current names and pick the same position."""
    place_id = reference.split("/")[1]
    cached = _fresh_names.get(place_id)
    if cached and time.time() - cached[0] < FRESH_TTL_SECONDS:
        names = cached[1]
    else:
        details = await async_places_request(
            client, f"https://places.googleapis.com/v1/places/{place_id}", enforce=False,
            headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": "photos"})
        if details.status_code != 200:
            return None
        names = [p["name"] for p in (details.json() or {}).get("photos") or [] if p.get("name")]
        _fresh_names[place_id] = (time.time(), names)
    if not names:
        return None
    index = _reference_index(place_id, reference)
    return names[index] if index < len(names) else names[0]


def _save(folder: Path, key: str, raw: bytes) -> Optional[bytes]:
    """Store a clean JPEG copy; None when the bytes are not an image we can re-encode."""
    try:
        from routers.place_photos import shrink
        from routers.venue_images import atomic_write
        content, _, _ = shrink(raw)
        atomic_write(folder / f"{key}.jpg", content)
        return content
    except Exception:
        return None


def get_api_key() -> str:
    """Get Google Places API key from environment."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Google Places API key not configured"
        )
    return api_key


def _place_photo_names(place_id: str) -> Optional[List[str]]:
    """The saved photo names of our restaurant with this Google ID; None when it is not ours."""
    from database import Database
    with Database().get_connection() as conn:
        row = conn.execute("SELECT photos FROM restaurants WHERE google_place_id = ? LIMIT 1",
                           (place_id,)).fetchone()
    if row is None:
        return None
    try:
        photos = json.loads(row["photos"] or "[]")
        while isinstance(photos, str):
            photos = json.loads(photos)
    except (TypeError, ValueError):
        photos = []
    return [p["photo_reference"] for p in photos if isinstance(p, dict) and p.get("photo_reference")]


def _save_place_photo_names(place_id: str, details: list) -> None:
    """Keep the list on every restaurant row with this Google ID that has none yet."""
    from database import Database
    photos = [{"photo_reference": p["name"], "photo_url": "", "width": p.get("widthPx"),
               "height": p.get("heightPx")} for p in details if p.get("name")]
    with Database().get_connection() as conn:
        conn.execute("UPDATE restaurants SET photos = ? WHERE google_place_id = ? "
                     "AND (photos IS NULL OR photos IN ('', '[]', 'null'))",
                     (json.dumps(photos, ensure_ascii=False), place_id))


@router.get(
    "/place/{place_id}/{index}",
    summary="A place's n-th Google photo, for places whose photo list is not saved yet",
    response_class=Response,
)
async def get_place_photo(place_id: str, index: int, maxwidth: int = Query(800, ge=100, le=1600)):
    """Owner decision 23.11.2026: fill missing photos on the fly. The place's photo list is
    fetched once (one paid Place Details call) and saved on the restaurant; the photo itself
    goes through the saved-copy cache under its own name, so it is paid for once."""
    if index < 0 or index > 9:
        raise HTTPException(status_code=404, detail="Photo not available")
    names = _place_photo_names(place_id)
    if names is None:
        raise HTTPException(status_code=404, detail="Unknown place")
    if not names:
        api_key = get_api_key()
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            try:
                details = await async_places_request(
                    client, f"https://places.googleapis.com/v1/places/{place_id}", enforce=False,
                    headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": "photos"})
            except BudgetExceeded:
                raise HTTPException(status_code=404, detail="Photo not available (paid photo fetches paused)",
                                    headers={"Cache-Control": "no-store"})
            except httpx.TimeoutException:
                raise HTTPException(status_code=504, detail="Photo list fetch timed out")
            except httpx.RequestError:
                raise HTTPException(status_code=502, detail="Photo provider request failed")
        if details.status_code != 200:
            raise HTTPException(status_code=404, detail="Photo list not available")
        listed = [p for p in (details.json() or {}).get("photos") or [] if p.get("name")]
        _save_place_photo_names(place_id, listed)
        names = [p["name"] for p in listed]
        _fresh_names[place_id] = (time.time(), names)
    if index >= len(names):
        raise HTTPException(status_code=404, detail="Photo not available")
    return await get_photo(names[index], maxwidth)


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

    key = hashlib.sha256(reference.encode()).hexdigest()
    folder = cache_dir()
    if folder:
        saved = folder / f"{key}.jpg"
        if saved.is_file() and not saved.is_symlink():
            return FileResponse(saved, media_type="image/jpeg", headers=CACHE_HEADERS)
        miss = folder / f"{key}.miss"
        if miss.is_file() and time.time() - miss.stat().st_mtime < MISS_TTL_SECONDS:
            raise HTTPException(status_code=404, detail="Photo not available")

    api_key = get_api_key()
    is_new_api = reference.startswith("places/") and "/photos/" in reference

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            resp = await async_places_request(client, _media_url(reference, api_key), enforce=False)
            if resp.status_code != 200 and is_new_api:
                fresh = await _fresh_name(client, reference, api_key)
                if fresh:
                    resp = await async_places_request(client, _media_url(fresh, api_key), enforce=False)
        except BudgetExceeded:
            raise HTTPException(status_code=404, detail="Photo not available (paid photo fetches paused)",
                                headers={"Cache-Control": "no-store"})
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Photo fetch timed out")
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Photo provider request failed")

    if resp.status_code != 200:
        if folder and 400 <= resp.status_code < 500:
            (folder / f"{key}.miss").touch()
        raise HTTPException(
            status_code=404 if 400 <= resp.status_code < 500 else resp.status_code,
            detail=f"Failed to fetch photo from Google Places API (status: {resp.status_code})",
        )

    content = _save(folder, key, resp.content) if folder else None
    if content is not None:
        return Response(content=content, media_type="image/jpeg", headers=CACHE_HEADERS)
    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=604800, immutable"},
    )

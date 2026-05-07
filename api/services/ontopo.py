"""
Ontopo availability service.

Uses the public Ontopo REST API (ontopo.com, not .co.il which is CF-protected).
Anonymous JWT auth — no account required, no reservation created.
"""

import time
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

ONTOPO_BASE = "https://ontopo.com/api"
_token_cache: dict = {"token": None, "expires_at": 0}


async def _get_token(client: httpx.AsyncClient) -> str:
    """Get or refresh anonymous JWT token (valid ~15 min)."""
    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    resp = await client.post(f"{ONTOPO_BASE}/loginAnonymously", timeout=10)
    resp.raise_for_status()
    token = resp.json()["jwt_token"]
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + 14 * 60  # 14 min to be safe
    return token


async def resolve_slug(name_slug: str) -> Optional[str]:
    """Resolve a human-readable slug to Ontopo's numeric ID."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{ONTOPO_BASE}/slug_content",
                json={"slug": name_slug},
                timeout=8,
            )
            data = resp.json()
            return data.get("slug") if data.get("slug") else None
        except Exception as e:
            logger.warning(f"Ontopo slug resolve failed for {name_slug}: {e}")
            return None


async def check_availability(
    numeric_slug: str,
    date: str,           # YYYYMMDD
    time_str: str,       # HHMM (24h)
    party_size: int = 2,
) -> dict:
    """
    Check availability for a restaurant on Ontopo.
    Returns structured result — no reservation is created.

    Result format:
    {
        "available": bool,
        "slots": [{"area": str, "time": str, "method": str}],
        "recommended": [{"area": str, "time": str}],
        "alternative_dates": ["YYYY-MM-DD HH:MM", ...],
        "booking_url": str,
        "raw": dict,
    }
    """
    async with httpx.AsyncClient() as client:
        try:
            token = await _get_token(client)
            resp = await client.post(
                f"{ONTOPO_BASE}/availability_search",
                headers={"token": token},
                json={
                    "slug": str(numeric_slug),
                    "locale": "he",
                    "criteria": {
                        "size": str(party_size),
                        "date": date,
                        "time": time_str,
                    },
                },
                timeout=10,
            )
            data = resp.json()
        except Exception as e:
            logger.error(f"Ontopo availability check failed: {e}")
            return {"available": False, "error": str(e), "slots": [], "alternative_dates": []}

    # Parse slots
    slots = []
    for area in data.get("areas", []):
        area_name = area.get("name") or area.get("id", "")
        for option in area.get("options", []):
            method = option.get("method", "")
            t = option.get("time", "")
            slots.append({
                "area": area_name,
                "time": f"{t[:2]}:{t[2:]}" if len(t) == 4 else t,
                "method": method,  # "seat" | "standby" | "disabled"
            })

    available_slots = [s for s in slots if s["method"] == "seat"]

    # Parse recommended
    recommended = []
    for r in data.get("recommended", []):
        if r.get("method") == "seat":
            t = r.get("time", "")
            recommended.append({
                "area": r.get("id", ""),
                "time": f"{t[:2]}:{t[2:]}" if len(t) == 4 else t,
            })

    # Parse alternative dates
    alt_dates = []
    for d in data.get("dates", []):
        if len(d) >= 8:
            date_part = d[:8]
            time_part = d[8:12] if len(d) >= 12 else "2000"
            formatted = f"{date_part[6:8]}/{date_part[4:6]}/{date_part[:4]} {time_part[:2]}:{time_part[2:]}"
            alt_dates.append(formatted)

    booking_url = (
        f"https://ontopo.com/he/il/page/{numeric_slug}"
        f"?date={date}&time={time_str}&size={party_size}"
    )

    return {
        "available": len(available_slots) > 0,
        "slots": available_slots,
        "all_slots": slots,
        "recommended": recommended,
        "alternative_dates": alt_dates[:5],
        "booking_url": booking_url,
        "raw": data,
    }

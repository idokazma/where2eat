"""
Tabit availability service.

Uses the public Tabit API (tgm-api.tabit.cloud).
No auth required for read operations.
Temp reservations expire automatically after ~5 minutes.
"""

import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)

TABIT_API = "https://tgm-api.tabit.cloud"
BRIDGE_API = "https://bridge.tabit.cloud"


async def find_org_id(restaurant_name: str) -> Optional[str]:
    """Search for a restaurant's Tabit org ID by name."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{BRIDGE_API}/organizations",
                params={"name": restaurant_name, "limit": 5},
                timeout=8,
            )
            orgs = resp.json()
            if isinstance(orgs, list) and orgs:
                return orgs[0].get("id")
            return None
        except Exception as e:
            logger.warning(f"Tabit org lookup failed for {restaurant_name}: {e}")
            return None


async def get_booking_config(org_id: str) -> dict:
    """
    Get restaurant booking configuration — read-only, no side effects.
    Returns booking_windows (scheduled hours by day-of-week), capacity, etc.
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{TABIT_API}/rsv/booking/configuration",
                params={"organization": org_id},
                timeout=8,
            )
            return resp.json()
        except Exception as e:
            logger.error(f"Tabit config fetch failed for {org_id}: {e}")
            return {}


async def check_availability(
    org_id: str,
    date: str,           # YYYY-MM-DD
    time_str: str,       # HH:MM (24h)
    party_size: int = 2,
    restaurant_name: str = "",
) -> dict:
    """
    Check real-time availability via temp reservation.
    The temp reservation expires automatically after ~5 minutes.

    Result format:
    {
        "available": bool,
        "slots": [{"time": str, "area": str}],
        "alternative_slots": [{"time": str}],
        "booking_url": str | None,
    }
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{TABIT_API}/rsv/booking/temp-reservations",
                json={
                    "organization": org_id,
                    "date": date,
                    "time": time_str,
                    "seats": party_size,
                },
                timeout=10,
            )
            data = resp.json()
        except Exception as e:
            logger.error(f"Tabit availability check failed: {e}")
            return {"available": False, "error": str(e), "slots": []}

    # If we got a reservation ID — slot is available
    reservation_id = data.get("id") or data.get("reservation_id")
    available = bool(reservation_id)

    # Delete temp reservation if created (cleanup, though it expires anyway)
    if reservation_id:
        try:
            async with httpx.AsyncClient() as client2:
                await client2.delete(
                    f"{TABIT_API}/rsv/booking/temp-reservations/{reservation_id}",
                    params={"organization": org_id},
                    timeout=5,
                )
        except Exception:
            pass  # Fine to ignore — it expires in 5 min anyway

    # Parse alternative slots if main slot is taken
    alt_slots = []
    for alt in data.get("alternative_results", []):
        t = alt.get("time", "")
        alt_slots.append({"time": t})

    return {
        "available": available,
        "slots": [{"time": time_str, "area": ""}] if available else [],
        "alternative_slots": alt_slots,
        "booking_url": None,  # Set by caller using restaurant-specific Tabit URL
        "raw": data,
    }

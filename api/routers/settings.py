"""Site-content settings: public read of whitelisted keys + admin editing.

All values pass through a fixed whitelist - admins can only edit known
site-content keys, never arbitrary configuration. Every change is recorded
in settings_history with the admin who made it, and can be restored.
"""

import os
import re
from typing import Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from database import get_database
from routers.admin import require_role
from fastapi import Depends

router = APIRouter(prefix="/api", tags=["Settings"])
editor = Depends(require_role(["editor", "admin", "super_admin"]))

# Every editable key, with its default and a validator-friendly shape.
# "bool" values are stored as "true"/"false" strings.
EDITABLE_SETTINGS: Dict[str, Dict] = {
    "site.hero_title": {"default": "", "kind": "text", "max": 120},
    "site.hero_highlight": {"default": "", "kind": "text", "max": 60},
    "site.hero_subtitle": {"default": "", "kind": "text", "max": 200},
    "site.banner_text": {"default": "", "kind": "text", "max": 200},
    "site.banner_link": {"default": "", "kind": "url", "max": 300},
    "social.instagram": {"default": "", "kind": "url", "max": 300},
    "social.youtube_mdaberim": {"default": "", "kind": "url", "max": 300},
    "social.youtube_gil": {"default": "", "kind": "url", "max": 300},
    "about.text": {"default": "", "kind": "text", "max": 2000},
    "display.restaurant_count": {"default": "true", "kind": "bool"},
    "display.creator_filter": {"default": "true", "kind": "bool"},
    "site.maintenance_mode": {"default": "false", "kind": "bool"},
}

URL_RE = re.compile(r"^https?://[A-Za-z0-9.\-]+(?::\d+)?(/\S*)?$")

# ---- Vercel Web Analytics proxy (optional) ----
# Token lives only in the backend environment, never in source or client.
VERCEL_TOKEN = os.getenv("VERCEL_API_TOKEN")
VERCEL_TEAM_ID = os.getenv("VERCEL_TEAM_ID")
VERCEL_PROJECT_ID = os.getenv("VERCEL_PROJECT_ID")


class SettingsUpdate(BaseModel):
    values: Dict[str, str] = Field(max_length=50)

    @field_validator("values")
    @classmethod
    def validate_values(cls, v: Dict[str, str]) -> Dict[str, str]:
        for key, value in v.items():
            spec = EDITABLE_SETTINGS.get(key)
            if spec is None:
                raise ValueError(f"unknown setting key: {key}")
            if not isinstance(value, str):
                raise ValueError(f"{key}: value must be a string")
            if "max" in spec and len(value) > spec["max"]:
                raise ValueError(f"{key}: too long (max {spec['max']})")
            if spec["kind"] == "bool" and value not in ("true", "false"):
                raise ValueError(f"{key}: must be 'true' or 'false'")
            if spec["kind"] == "url" and value and not URL_RE.match(value):
                raise ValueError(f"{key}: must be an http(s) URL")
        return v


def _public_settings(db) -> Dict[str, str]:
    stored = db.get_settings(list(EDITABLE_SETTINGS.keys()))
    return {key: stored.get(key, spec["default"])
            for key, spec in EDITABLE_SETTINGS.items()}


@router.get("/settings/public")
def get_public_settings():
    """Public site-content values (defaults merged). No auth, no private data."""
    return _public_settings(get_database())


@router.get("/admin/settings")
def get_all_settings(user: dict = editor):
    """All editable settings with current values. Requires editor+."""
    return _public_settings(get_database())


@router.put("/admin/settings")
def update_settings(update: SettingsUpdate, user: dict = editor):
    """Update editable settings. Every change is recorded in history."""
    db = get_database()
    changed_by = user.get("email") or user.get("id")
    changed = []
    for key, value in update.values.items():
        spec = EDITABLE_SETTINGS[key]
        before = db.get_settings([key]).get(key, spec["default"])
        db.set_setting(key, value, changed_by=changed_by)
        if before != value:
            changed.append(key)
    return {"updated": changed}


@router.get("/admin/settings/history")
def settings_history(key: Optional[str] = Query(default=None),
                     limit: int = Query(default=50, ge=1, le=200),
                     user: dict = editor):
    """Recent setting changes (for restore). Requires editor+."""
    return {"history": get_database().get_settings_history(key=key, limit=limit)}


@router.post("/admin/settings/restore/{history_id}")
def restore_setting(history_id: str, user: dict = editor):
    """Restore a setting to a value from its history. Requires editor+."""
    db = get_database()
    rows = db.get_settings_history(limit=200)
    row = next((r for r in rows if r["id"] == history_id), None)
    if row is None:
        raise HTTPException(status_code=404, detail="History entry not found")
    if row["key"] not in EDITABLE_SETTINGS:
        raise HTTPException(status_code=400, detail="Key is no longer editable")
    if row["old_value"] is None:
        raise HTTPException(status_code=400, detail="No previous value to restore")
    changed_by = user.get("email") or user.get("id")
    db.set_setting(row["key"], row["old_value"], changed_by=changed_by)
    return {"restored": row["key"], "value": row["old_value"]}


# ---- Vercel Web Analytics proxy ----

@router.get("/admin/analytics/vercel")
async def vercel_analytics(days: int = Query(default=30, ge=1, le=31),
                           user: dict = editor):
    """Proxy Vercel Web Analytics aggregates (Hobby plan: last 31 days).

    Disabled (404) unless VERCEL_API_TOKEN/TEAM_ID/PROJECT_ID are set in the
    backend environment. The token never reaches the client or the source.
    """
    if not (VERCEL_TOKEN and VERCEL_TEAM_ID and VERCEL_PROJECT_ID):
        raise HTTPException(status_code=404, detail="Vercel analytics not configured")
    import time
    until = int(time.time() * 1000)
    since = int((time.time() - days * 86400) * 1000)
    base = "https://api.vercel.com/v1/query/web-analytics"
    headers = {"Authorization": f"Bearer {VERCEL_TOKEN}"}
    params = {"projectId": VERCEL_PROJECT_ID, "teamId": VERCEL_TEAM_ID,
              "since": since, "until": until}
    result: Dict = {"days": days, "source": "vercel", "retention_days": 31}
    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        count_resp = await client.get(f"{base}/visits/count", params=params)
        if count_resp.status_code != 200:
            raise HTTPException(status_code=502,
                                detail="Vercel analytics query failed")
        result["totals"] = count_resp.json().get("data", {})
        for name, dim in [("daily", "day"), ("referrers", "referrerHostname"),
                          ("paths", "requestPath"), ("devices", "deviceType"),
                          ("countries", "country")]:
            resp = await client.get(f"{base}/visits/aggregate",
                                    params={**params, "by": dim, "limit": 40})
            result[name] = resp.json().get("data", []) if resp.status_code == 200 else []
    return result

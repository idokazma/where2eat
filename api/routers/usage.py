"""Public usage-analytics ingest endpoint.

Privacy-minimal by design: no IP storage, no cookies, no user agents, no
free-text fields. Clients send batched events with a random per-tab session
id (sessionStorage lifetime). The OriginGateMiddleware already restricts
this endpoint to the site's own origins.
"""

import re
import time
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from database import get_database

router = APIRouter(prefix="/api/usage", tags=["Usage"])

ALLOWED_EVENT_TYPES = {"page_view", "session_start", "restaurant_view", "outbound_click", "feature_use"}
ALLOWED_FEATURES = {
    "map_open", "stories_open", "story_play", "favorite_toggle",
    "near_me_toggle", "creator_filter", "search_run", "layout_toggle",
    "language_toggle", "saved_page_open", "instagram_preview",
}
ALLOWED_TARGETS = {"youtube", "instagram", "navigation", "website", "order", "google_maps"}
ALLOWED_DEVICES = {"mobile", "tablet", "desktop", "unknown"}

MAX_EVENTS_PER_BATCH = 20
MAX_SESSION_EVENTS_PER_MINUTE = 120

# path: site-relative only, no scheme/host, no query string (query strings can
# carry free text such as search terms, which we deliberately do not store)
PATH_RE = re.compile(r"^/[A-Za-z0-9_\-/.\[\]%]*$")
DOMAIN_RE = re.compile(r"^[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")
SESSION_RE = re.compile(r"^[A-Za-z0-9\-]{8,64}$")
BOT_UA_RE = re.compile(r"bot|crawler|spider|curl|wget|python-requests|headless", re.I)

# Retention: raw events are kept 90 days, then pruned on ingest (at most once
# per day per process, tracked in memory).
RETENTION_DAYS = 90
_last_prune_day: str = ""


def _prune_old_events(db) -> None:
    global _last_prune_day
    today = datetime.now().strftime("%Y-%m-%d")
    if _last_prune_day == today:
        return
    _last_prune_day = today
    cutoff = (datetime.now() - timedelta(days=RETENTION_DAYS)).isoformat()
    try:
        with db.get_connection() as conn:
            conn.cursor().execute("DELETE FROM usage_events WHERE ts < ?", (cutoff,))
    except Exception:
        pass  # pruning must never break ingest


# Simple in-memory rate limiter: session_id -> list of recent timestamps (seconds)
_session_hits: dict = {}
_RATE_WINDOW_SEC = 60


def _rate_limited(session_id: str, n: int) -> bool:
    now = time.time()
    hits = _session_hits.get(session_id, [])
    hits = [t for t in hits if now - t < _RATE_WINDOW_SEC]
    limited = len(hits) + n > MAX_SESSION_EVENTS_PER_MINUTE
    if not limited:
        hits.extend([now] * n)
        _session_hits[session_id] = hits
    # Occasional cleanup so the map does not grow forever
    if len(_session_hits) > 10000:
        for key in [k for k, v in _session_hits.items() if not v or now - v[-1] >= _RATE_WINDOW_SEC]:
            _session_hits.pop(key, None)
    return limited


class UsageEvent(BaseModel):
    event_type: str
    ts: Optional[str] = None
    path: Optional[str] = Field(default=None, max_length=150)
    page_type: Optional[str] = Field(default=None, max_length=30)
    restaurant_id: Optional[str] = Field(default=None, max_length=64)
    feature: Optional[str] = Field(default=None, max_length=30)
    target: Optional[str] = Field(default=None, max_length=20)
    referrer_domain: Optional[str] = Field(default=None, max_length=100)
    device_class: Optional[str] = Field(default=None, max_length=10)
    session_id: str = Field(max_length=64)

    @field_validator("session_id")
    @classmethod
    def valid_session(cls, v: str) -> str:
        if not SESSION_RE.match(v):
            raise ValueError("invalid session id")
        return v

    @field_validator("path")
    @classmethod
    def valid_path(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not PATH_RE.match(v):
            raise ValueError("path must be site-relative without query string")
        return v

    @field_validator("referrer_domain")
    @classmethod
    def valid_referrer(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not DOMAIN_RE.match(v):
            raise ValueError("referrer must be a bare domain")
        return v.lower()


class UsageBatch(BaseModel):
    events: List[UsageEvent] = Field(max_length=MAX_EVENTS_PER_BATCH)


@router.post("/event", status_code=202)
async def ingest_usage_events(batch: UsageBatch, request: Request):
    """Accept a batch of usage events. Returns 202 with the accepted count.

    Invalid event types/fields are dropped rather than failing the batch, so
    one bad event never blocks the rest. Bot user agents are ignored.
    """
    ua = request.headers.get("user-agent", "")
    if BOT_UA_RE.search(ua):
        return {"accepted": 0}

    accepted: List[dict] = []
    per_session: dict = {}
    for event in batch.events:
        if event.event_type not in ALLOWED_EVENT_TYPES:
            continue
        if event.feature is not None and event.feature not in ALLOWED_FEATURES:
            continue
        if event.target is not None and event.target not in ALLOWED_TARGETS:
            continue
        if event.device_class is not None and event.device_class not in ALLOWED_DEVICES:
            continue
        # referrer only meaningful on session_start; strip elsewhere
        if event.event_type != "session_start":
            event.referrer_domain = None
        # admin traffic is never usage data, even if a client sends it
        if event.path and event.path.startswith("/admin"):
            continue
        per_session[event.session_id] = per_session.get(event.session_id, 0) + 1
        accepted.append(event)

    for session_id, count in per_session.items():
        if _rate_limited(session_id, count):
            raise HTTPException(status_code=429, detail="Too many events")

    db = get_database()
    _prune_old_events(db)
    stored = 0
    now = datetime.now().isoformat()
    for event in accepted:
        db.insert_usage_event({
            "ts": event.ts or now,
            "event_type": event.event_type,
            "path": event.path,
            "page_type": event.page_type,
            "restaurant_id": event.restaurant_id,
            "feature": event.feature,
            "target": event.target,
            "referrer_domain": event.referrer_domain,
            "device_class": event.device_class,
            "session_id": event.session_id,
        })
        stored += 1

    return {"accepted": stored}

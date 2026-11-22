"""
Tests for usage analytics: storage (Database) and API surface.

Storage tests use a temporary database like other backend tests.
API tests build a minimal FastAPI app around the routers with a temp DB,
so no server or production data is involved.
"""

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "api"))

from database import Database, get_database  # noqa: E402

import database as database_module  # noqa: E402


@pytest.fixture
def db(tmp_path):
    return Database(str(tmp_path / "test.db"))


def _event(session="session-00000001", **overrides):
    base = {
        "ts": datetime.now().isoformat(),
        "event_type": "page_view",
        "path": "/",
        "page_type": "home",
        "restaurant_id": None,
        "feature": None,
        "target": None,
        "referrer_domain": None,
        "device_class": "mobile",
        "session_id": session,
    }
    base.update(overrides)
    return base


class TestUsageEventStorage:
    def test_insert_and_roundtrip(self, db):
        db.insert_usage_event(_event())
        summary = db.get_usage_summary(days=1)
        assert summary["totals"]["page_views"] == 1
        assert summary["totals"]["sessions"] == 1

    def test_days_window_excludes_old_events(self, db):
        old = (datetime.now() - timedelta(days=40)).isoformat()
        db.insert_usage_event(_event(ts=old))
        db.insert_usage_event(_event(session="session-00000002"))
        summary = db.get_usage_summary(days=30)
        assert summary["totals"]["page_views"] == 1
        # wide window catches both
        wide = db.get_usage_summary(days=90)
        assert wide["totals"]["page_views"] == 2

    def test_session_counts_are_distinct(self, db):
        for _ in range(3):
            db.insert_usage_event(_event())
        db.insert_usage_event(_event(session="session-00000002"))
        summary = db.get_usage_summary(days=1)
        assert summary["totals"]["sessions"] == 2
        assert summary["totals"]["page_views"] == 4

    def test_daily_buckets(self, db):
        today = datetime.now().isoformat()
        yesterday = (datetime.now() - timedelta(days=1)).isoformat()
        db.insert_usage_event(_event(ts=today))
        db.insert_usage_event(_event(ts=yesterday, session="session-00000002"))
        summary = db.get_usage_summary(days=7)
        days = [row["day"] for row in summary["daily"]]
        assert days == sorted(days)
        assert len(summary["daily"]) == 2

    def test_page_breakdown(self, db):
        db.insert_usage_event(_event(page_type="map", path="/map"))
        db.insert_usage_event(_event(page_type="map", path="/map"))
        db.insert_usage_event(_event(page_type="stories", path="/stories"))
        db.insert_usage_event(_event(page_type="home", path="/"))
        summary = db.get_usage_summary(days=1)
        pages = {row["page_type"]: row["views"] for row in summary["pages"]}
        assert pages["map"] == 2
        assert pages["stories"] == 1
        assert pages["home"] == 1

    def test_top_restaurants(self, db):
        for _ in range(2):
            db.insert_usage_event(_event(event_type="restaurant_view", restaurant_id="r1"))
        db.insert_usage_event(_event(event_type="restaurant_view", restaurant_id="r2"))
        db.insert_usage_event(_event(
            event_type="outbound_click", restaurant_id="r1", target="instagram"))
        summary = db.get_usage_summary(days=1)
        tops = {row["restaurant_id"]: row for row in summary["top_restaurants"]}
        assert tops["r1"]["views"] == 2
        assert tops["r1"]["outbound"] == 1
        assert tops["r2"]["views"] == 1
        assert summary["totals"]["restaurant_views"] == 3
        assert summary["totals"]["outbound_clicks"] == 1

    def test_feature_and_referrer_and_device_breakdowns(self, db):
        db.insert_usage_event(_event(
            event_type="session_start", referrer_domain="instagram.com"))
        db.insert_usage_event(_event(
            event_type="feature_use", feature="search_run"))
        db.insert_usage_event(_event(
            event_type="feature_use", feature="search_run",
            session="session-00000002"))
        summary = db.get_usage_summary(days=1)
        features = {row["feature"]: row["uses"] for row in summary["features"]}
        assert features["search_run"] == 2
        referrers = {row["source"]: row["visits"]
                     for row in summary["referrers"]}
        assert referrers["instagram.com"] == 1
        devices = {row["device"]: row["sessions"]
                   for row in summary["devices"]}
        assert devices["mobile"] >= 1

    def test_empty_summary_shape(self, db):
        summary = db.get_usage_summary(days=30)
        assert summary["totals"]["page_views"] in (0, None)
        assert summary["daily"] == []
        assert summary["top_restaurants"] == []


# ============================================================
# API-level tests
# ============================================================

fastapi = pytest.importorskip("fastapi")
from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from routers import usage as usage_router  # noqa: E402
from routers import admin_usage as admin_usage_router  # noqa: E402
from routers.admin import require_role  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database_module, "_db_instance",
                        Database(str(tmp_path / "api_test.db")))
    app = FastAPI()
    app.include_router(usage_router.router)
    app.include_router(admin_usage_router.router)
    # editor is a Depends(require_role([...])) instance; override its callable
    app.dependency_overrides[admin_usage_router.editor.dependency] = \
        lambda: {"role": "editor", "email": "t@t"}
    yield TestClient(app)
    monkeypatch.setattr(database_module, "_db_instance", None)


def _payload(session="sess-abcd1234", **overrides):
    base = {
        "event_type": "page_view",
        "path": "/",
        "page_type": "home",
        "device_class": "mobile",
        "session_id": session,
    }
    base.update(overrides)
    return base


class TestUsageIngestEndpoint:
    def test_accepts_valid_batch(self, client):
        resp = client.post("/api/usage/event",
                           json={"events": [_payload()]})
        assert resp.status_code == 202
        assert resp.json()["accepted"] == 1
        stored = get_database().get_usage_summary(days=1)
        assert stored["totals"]["page_views"] == 1

    def test_drops_unknown_event_type_but_keeps_valid(self, client):
        resp = client.post("/api/usage/event", json={"events": [
            _payload(event_type="not_a_real_type"),
            _payload(),
        ]})
        assert resp.status_code == 202
        assert resp.json()["accepted"] == 1

    def test_rejects_bad_session_id(self, client):
        resp = client.post("/api/usage/event", json={"events": [
            _payload(session="short"),
        ]})
        assert resp.status_code == 422

    def test_rejects_path_with_query_string(self, client):
        resp = client.post("/api/usage/event", json={"events": [
            _payload(path="/map?search=pizza"),
        ]})
        assert resp.status_code == 422

    def test_strips_referrer_from_non_session_start(self, client):
        resp = client.post("/api/usage/event", json={"events": [
            _payload(referrer_domain="instagram.com"),
            _payload(event_type="session_start",
                     referrer_domain="instagram.com", session="sess-efgh5678"),
        ]})
        assert resp.status_code == 202
        summary = get_database().get_usage_summary(days=1)
        referrers = {r["source"] for r in summary["referrers"]}
        assert "instagram.com" in referrers
        # page_view event kept no referrer (only 1 referrer row overall)
        assert len(summary["referrers"]) == 1

    def test_ignores_bot_user_agents(self, client):
        resp = client.post(
            "/api/usage/event",
            json={"events": [_payload()]},
            headers={"user-agent": "curl/8.0"},
        )
        assert resp.json()["accepted"] == 0

    def test_rate_limit(self, client):
        usage_router._session_hits.clear()
        # limit is 120 events/min per session: six batches of 20 fit
        for _ in range(6):
            resp = client.post("/api/usage/event",
                               json={"events": [_payload()] * 20})
            assert resp.status_code == 202
        seventh = client.post("/api/usage/event",
                              json={"events": [_payload()] * 20})
        assert seventh.status_code == 429
        usage_router._session_hits.clear()

    def test_batch_size_cap(self, client):
        resp = client.post("/api/usage/event",
                           json={"events": [_payload()] * 21})
        assert resp.status_code == 422


class TestAdminUsageEndpoint:
    def test_summary_shape(self, client):
        client.post("/api/usage/event", json={"events": [
            _payload(),
            _payload(event_type="restaurant_view", restaurant_id="r1",
                     session="sess-zzzz9999"),
        ]})
        resp = client.get("/api/admin/usage/summary?days=7")
        assert resp.status_code == 200
        data = resp.json()
        for key in ("totals", "daily", "pages", "top_restaurants",
                    "features", "referrers", "devices", "outbound_by_target",
                    "hourly"):
            assert key in data
        assert data["totals"]["restaurant_views"] == 1


# ============================================================
# Site settings endpoints
# ============================================================

from routers import settings as settings_router  # noqa: E402


@pytest.fixture
def settings_client(tmp_path, monkeypatch):
    monkeypatch.setattr(database_module, "_db_instance",
                        Database(str(tmp_path / "settings_test.db")))
    app = FastAPI()
    app.include_router(settings_router.router)
    app.dependency_overrides[settings_router.editor.dependency] = \
        lambda: {"role": "editor", "email": "ed@t"}
    yield TestClient(app)
    monkeypatch.setattr(database_module, "_db_instance", None)


class TestSiteSettings:
    def test_public_defaults(self, settings_client):
        resp = settings_client.get("/api/settings/public")
        assert resp.status_code == 200
        data = resp.json()
        assert data["display.restaurant_count"] == "true"
        assert data["site.maintenance_mode"] == "false"

    def test_update_and_read_back(self, settings_client):
        resp = settings_client.put("/api/admin/settings", json={
            "values": {"site.hero_subtitle": "כותרת חדשה",
                       "site.banner_link": "https://example.com/x"}})
        assert resp.status_code == 200
        assert set(resp.json()["updated"]) == {
            "site.hero_subtitle", "site.banner_link"}
        data = settings_client.get("/api/settings/public").json()
        assert data["site.hero_subtitle"] == "כותרת חדשה"

    def test_rejects_unknown_key(self, settings_client):
        resp = settings_client.put("/api/admin/settings", json={
            "values": {"evil.key": "x"}})
        assert resp.status_code == 422

    def test_rejects_bad_bool_and_bad_url(self, settings_client):
        assert settings_client.put("/api/admin/settings", json={
            "values": {"site.maintenance_mode": "yes"}}).status_code == 422
        assert settings_client.put("/api/admin/settings", json={
            "values": {"social.instagram": "not-a-url"}}).status_code == 422

    def test_history_and_restore(self, settings_client):
        settings_client.put("/api/admin/settings", json={
            "values": {"site.hero_subtitle": "v1"}})
        settings_client.put("/api/admin/settings", json={
            "values": {"site.hero_subtitle": "v2"}})
        history = settings_client.get(
            "/api/admin/settings/history?key=site.hero_subtitle").json()["history"]
        assert len(history) == 2
        newest = history[0]
        assert newest["old_value"] == "v1"
        resp = settings_client.post(
            f"/api/admin/settings/restore/{newest['id']}")
        assert resp.status_code == 200
        data = settings_client.get("/api/settings/public").json()
        assert data["site.hero_subtitle"] == "v1"

    def test_vercel_proxy_disabled_without_env(self, settings_client):
        resp = settings_client.get("/api/admin/analytics/vercel")
        assert resp.status_code == 404


class TestMentionEditing:
    def test_quote_edit_stores_json_and_invalidates_verified(self, db):
        # seed an episode + mention with a verified quote
        with db.get_connection() as conn:
            conn.cursor().execute('''
                INSERT INTO episodes (id, video_id, video_url, title, channel_name)
                VALUES ('ep1', 'v1', 'https://youtube.com/watch?v=v1', 'פרק 1', 'test')
            ''')
            conn.cursor().execute('''
                INSERT INTO episode_mentions
                    (id, episode_id, video_id, name_hebrew, verdict, host_quotes, verified_quote)
                VALUES ('m1', 'ep1', 'v1', 'מסעדה', 'recommended', '["ישן"]', '{"text": "מאומת", "reviewed_by": "a1"}')
            ''')
        ok = db.update_episode_mention("m1", host_quotes='["חדש"]')
        assert ok
        with db.get_connection() as conn:
            row = conn.cursor().execute(
                "SELECT host_quotes, verified_quote FROM episode_mentions WHERE id='m1'").fetchone()
        assert row["host_quotes"] == '["חדש"]'
        assert row["verified_quote"] is None

    def test_update_mention_rejects_unknown_fields(self, db):
        assert db.update_episode_mention("nope", evil_column="x") is False

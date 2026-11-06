"""Run real FastAPI auth dependencies without production startup or requests."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'api'))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers.admin_maintenance import router
from routers.admin import get_current_user
from unittest.mock import patch
import pytest

@pytest.fixture
def client():
    app=FastAPI();app.include_router(router);return TestClient(app)

def test_no_auth_is_401(client):
    assert client.get('/api/admin/maintenance/episodes/e1/delete-preview').status_code==401

def test_viewer_forbidden(client):
    client.app.dependency_overrides[get_current_user]=lambda:{'id':'v','role':'viewer'}
    assert client.post('/api/admin/maintenance/merges/preview',json={'keep_id':'k','drop_id':'d'}).status_code==403

def test_editor_cannot_delete(client):
    client.app.dependency_overrides[get_current_user]=lambda:{'id':'e','role':'editor'}
    assert client.delete('/api/admin/maintenance/episodes/e1').status_code==403

def test_admin_preview(client):
    client.app.dependency_overrides[get_current_user]=lambda:{'id':'a','role':'admin'}
    with patch('routers.admin_maintenance.service') as s:
        s.return_value.preview_delete.return_value={'revision':'test'}
        assert client.get('/api/admin/maintenance/episodes/e1/delete-preview').json()=={'revision':'test'}

def test_legacy_search_handles_null_dates(client):
    from routers.analytics import router as analytics_router
    client.app.include_router(analytics_router)
    rows=[{'name_hebrew':'a','episode_info':{'video_id':'v1','analysis_date':None}}, {'name_hebrew':'b','episode_info':{'video_id':'v2','analysis_date':'2026-11-06'}}, {'name_hebrew':'c','episode_info':None}]
    with patch('routers.analytics.load_all_restaurants',return_value=rows):
        r=client.get('/api/episodes/search?limit=100');assert r.status_code==200 and r.json()['count']==2

def test_legacy_write_routes_require_auth(client):
    from routers.episodes import router as ep
    from routers.restaurants import router as rs
    client.app.include_router(ep);client.app.include_router(rs)
    assert client.post('/api/episodes/seed',json={}).status_code==401
    assert client.delete('/api/episodes/reset').status_code==401
    assert client.delete('/api/episodes/e1/mentions').status_code==401
    assert client.post('/api/restaurants/merge-duplicates',json={}).status_code==401

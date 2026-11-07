"""Write and paid-provider endpoints require an admin login; the public site stays read-only."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.admin import get_current_user
from routers.analyze import router as analyze_router
from routers.restaurants import router as restaurants_router

RID = '00000000-0000-0000-0000-000000000001'

# (method, path, json body, roles that may call it)
WRITE_ROUTES = [
    ('post', '/api/restaurants', {'name_hebrew': 'x'}, {'editor', 'admin', 'super_admin'}),
    ('put', f'/api/restaurants/{RID}', {'name_hebrew': 'x'}, {'editor', 'admin', 'super_admin'}),
    ('delete', f'/api/restaurants/{RID}', None, {'admin', 'super_admin'}),
    ('post', f'/api/restaurants/{RID}/reprocess', None, {'admin', 'super_admin'}),
    ('post', '/api/analyze', {'url': 'https://www.youtube.com/watch?v=abcdefghijk'}, {'admin', 'super_admin'}),
    ('post', '/api/analyze/channel', {'channel_url': 'https://www.youtube.com/@x'}, {'admin', 'super_admin'}),
    ('delete', '/api/jobs/job-1', None, {'admin', 'super_admin'}),
    ('post', '/api/reenrich', None, {'admin', 'super_admin'}),
]


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(restaurants_router)
    app.include_router(analyze_router)
    return TestClient(app)


def _call(client, method, path, body):
    return getattr(client, method)(path, **({'json': body} if body is not None else {}))


@pytest.mark.parametrize('method,path,body,roles', WRITE_ROUTES)
def test_write_route_without_login_returns_401(client, method, path, body, roles):
    assert _call(client, method, path, body).status_code == 401


@pytest.mark.parametrize('method,path,body,roles', WRITE_ROUTES)
def test_write_route_viewer_role_returns_403(client, method, path, body, roles):
    client.app.dependency_overrides[get_current_user] = lambda: {'id': 'v', 'role': 'viewer'}
    assert _call(client, method, path, body).status_code == 403


def test_editor_cannot_delete_or_spend(client):
    client.app.dependency_overrides[get_current_user] = lambda: {'id': 'e', 'role': 'editor'}
    for method, path, body, roles in WRITE_ROUTES:
        if 'editor' not in roles:
            assert _call(client, method, path, body).status_code == 403, path


def test_public_reads_stay_open(client):
    # Auth must not leak onto the public read endpoints the site depends on.
    for path in ['/api/restaurants', f'/api/restaurants/{RID}']:
        assert _call(client, 'get', path, None).status_code not in (401, 403), path


@pytest.mark.parametrize('secret', [None, '', 'your-secret-key-change-in-production'])
def test_admin_auth_in_production_with_default_secret_fails_closed(monkeypatch, secret):
    import routers.admin as admin
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID', 'prod')
    if secret is None:
        monkeypatch.delenv('JWT_SECRET_KEY', raising=False)
    else:
        monkeypatch.setenv('JWT_SECRET_KEY', secret)
    with pytest.raises(admin.HTTPException) as exc:
        admin.jwt_secret()
    assert exc.value.status_code == 503


def test_admin_auth_with_configured_secret_round_trips(monkeypatch):
    import routers.admin as admin
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID', 'prod')
    monkeypatch.setenv('JWT_SECRET_KEY', 'k' * 40)
    token = admin.create_access_token({'user_id': 'u1'})
    assert admin.jwt.decode(token, 'k' * 40, algorithms=[admin.ALGORITHM])['user_id'] == 'u1'


def test_admin_auth_local_dev_keeps_default_secret(monkeypatch):
    import routers.admin as admin
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    monkeypatch.delenv('JWT_SECRET_KEY', raising=False)
    assert admin.jwt_secret() == 'your-secret-key-change-in-production'

"""Stored copies of Google Places photos: fetched once by an admin run, then served free."""
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from cost_ledger import BudgetExceeded
from database import Database

SECRET = 'x' * 40
AUTH = {'Authorization': 'Bearer ' + SECRET}


def jpeg(color='red', size=(2000, 1500)):
    b = io.BytesIO()
    Image.new('RGB', size, color).save(b, 'JPEG')
    return b.getvalue()


class FakeResponse:
    def __init__(self, status=200, payload=None, content=b''):
        self.status_code = status
        self._payload = payload
        self.content = content

    def json(self):
        return self._payload


class FakeGoogle:
    """Place Details returns photo names; /media returns image bytes."""

    def __init__(self, photos_per_place=3, fail_media=()):
        self.calls = []
        self.photos_per_place = photos_per_place
        self.fail_media = set(fail_media)

    def __call__(self, method, url, **kwargs):
        self.calls.append(url)
        if url.endswith('/media'):
            name = url.split('/v1/')[1].rsplit('/media', 1)[0]
            if name in self.fail_media:
                return FakeResponse(400)
            return FakeResponse(200, content=jpeg(color=(len(self.calls) * 20 % 255, 10, 10)))
        place = url.rsplit('/', 1)[1]
        return FakeResponse(200, {'photos': [
            {'name': f'places/{place}/photos/p{i}', 'authorAttributions': [{'displayName': f'צלם {i}', 'uri': f'https://maps.google.com/u{i}'}]}
            for i in range(self.photos_per_place)
        ]})


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    monkeypatch.setenv('API_SECRET_KEY', SECRET)
    monkeypatch.setenv('GOOGLE_PLACES_API_KEY', 'dummy')
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    db = Database(str(tmp_path / 'where2eat.db'))
    with db.get_connection() as c:
        for rid, name, pid, hidden in [
            ('r1', 'אחת', 'PLACE1', 0),
            ('r2', 'שתיים', 'PLACE2', 0),
            ('nopid', 'בלי מזהה', None, 0),
            ('hidden', 'מוסתרת', 'PLACE3', 1),
        ]:
            c.execute('INSERT INTO restaurants (id, name_hebrew, google_place_id, is_hidden) VALUES (?,?,?,?)',
                      (rid, name, pid, hidden))
    from routers import place_photos
    google = FakeGoogle()
    monkeypatch.setattr(place_photos, 'places_request', google)
    app = FastAPI()
    app.include_router(place_photos.router)
    return TestClient(app), db, google, tmp_path


def store(client, **params):
    return client.post('/api/admin/place-photos/store', headers=AUTH, params={'per_place': 2, **params})


def test_store_requires_the_admin_key(env):
    client, *_ = env
    assert client.post('/api/admin/place-photos/store').status_code == 401
    assert client.post('/api/admin/place-photos/store', headers={'Authorization': 'Bearer nope'}).status_code == 401
    assert client.delete('/api/admin/place-photos').status_code == 401


def test_store_copies_photos_once_per_place_with_credit(env):
    client, db, google, tmp_path = env
    r = store(client)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body['restaurants_done'] == 2 and body['photos_stored'] == 4
    assert sum(1 for u in google.calls if not u.endswith('/media')) == 2
    assert sum(1 for u in google.calls if u.endswith('/media')) == 4
    photos = {r['id']: r.get('stored_photos') for r in db.get_all_restaurants()}
    assert [p['credit'] for p in photos['r1']] == ['צלם 0', 'צלם 1']
    assert len(photos['r2']) == 2
    assert photos['nopid'] == [] and photos['hidden'] == []
    files = list((tmp_path / 'place_photos').glob('*.jpg'))
    assert len(files) == 4
    with Image.open(files[0]) as im:
        assert max(im.size) <= 1200


def test_store_skips_restaurants_already_done(env):
    client, _, google, _ = env
    store(client)
    google.calls.clear()
    assert store(client).json()['restaurants_done'] == 0
    assert google.calls == []


def test_stored_photo_is_served_free_with_long_cache(env):
    client, db, _, _ = env
    store(client)
    path = db.get_restaurant('r1')['stored_photos'][0]['path']
    g = client.get(path)
    assert g.status_code == 200 and g.headers['content-type'] == 'image/jpeg'
    assert g.headers['cache-control'] == 'public, max-age=31536000, immutable'
    assert client.get('/api/place-photos/' + '0' * 64 + '.jpg').status_code == 404
    assert client.get('/api/place-photos/../where2eat.db').status_code == 404


def test_failed_photo_is_skipped(env):
    client, db, google, _ = env
    google.fail_media = {'places/PLACE1/photos/p0'}
    store(client, restaurant_id='r1')
    assert [p['credit'] for p in db.get_restaurant('r1')['stored_photos']] == ['צלם 1']


def test_budget_stop_ends_the_run_and_reports_it(env, monkeypatch):
    client, db, _, _ = env
    from routers import place_photos

    def broke(*a, **k):
        raise BudgetExceeded('Estimated monthly budget would be exceeded')

    monkeypatch.setattr(place_photos, 'places_request', broke)
    body = store(client).json()
    assert body['budget_stopped'] is True and body['restaurants_done'] == 0
    assert db.get_restaurant('r1')['stored_photos'] == []


def test_delete_removes_every_copy(env):
    client, db, _, tmp_path = env
    store(client)
    r = client.delete('/api/admin/place-photos', headers=AUTH)
    assert r.status_code == 200 and r.json()['deleted_rows'] == 4
    assert list((tmp_path / 'place_photos').glob('*.jpg')) == []
    assert db.get_restaurant('r1')['stored_photos'] == []


def test_origin_gate_lets_browsers_load_stored_photos():
    import ast
    tree = ast.parse((Path(__file__).resolve().parents[1] / 'api' / 'main.py').read_text())
    node = next(n for n in ast.walk(tree) if isinstance(n, ast.Assign)
                and any(getattr(t, 'id', '') == 'EXEMPT_PREFIXES' for t in n.targets))
    assert '/api/place-photos/' in ast.literal_eval(node.value)


def test_cursor_passes_each_restaurant_once(env):
    client, _, google, _ = env
    google.photos_per_place = 0  # Google has no photos: every restaurant fails
    first = store(client, limit=1).json()
    assert first['processed'] == 1 and len(first['failed']) == 1
    second = store(client, limit=5, after=first['next_after']).json()
    assert second['processed'] == 1 and second['failed'][0]['restaurant_id'] != first['failed'][0]['restaurant_id']
    assert store(client, after=second['next_after']).json()['processed'] == 0

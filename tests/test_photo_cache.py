"""The photo proxy keeps every photo it fetches: Google is paid once per photo, not per view."""
import io
import json
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from database import Database

REF = 'places/PLACE1/photos/oldref2'


def jpeg(size=(2000, 1500)):
    b = io.BytesIO()
    Image.new('RGB', size, 'red').save(b, 'JPEG')
    return b.getvalue()


def response(status, content=b'', payload=None, url='https://x'):
    if payload is not None:
        return httpx.Response(status, json=payload, request=httpx.Request('GET', url))
    return httpx.Response(status, content=content, headers={'content-type': 'image/jpeg'},
                          request=httpx.Request('GET', url))


class Google:
    """Fake Google: old references are expired (400) unless listed in `alive`."""

    def __init__(self, alive=(REF,), fresh=('places/PLACE1/photos/new0', 'places/PLACE1/photos/new1',
                                             'places/PLACE1/photos/new2')):
        self.alive = set(alive)
        self.fresh = list(fresh)
        self.calls = []

    async def __call__(self, url, **kwargs):
        self.calls.append(url)
        if '/media' in url:
            name = url.split('/v1/')[1].split('/media')[0]
            return response(200, jpeg()) if name in self.alive or name in self.fresh else response(400)
        if url.startswith('https://places.googleapis.com/v1/places/'):
            return response(200, payload={'photos': [{'name': n} for n in self.fresh]})
        return response(404)


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    monkeypatch.setenv('GOOGLE_PLACES_API_KEY', 'dummy')
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    db = Database(str(tmp_path / 'where2eat.db'))
    photos = [{'photo_reference': f'places/PLACE1/photos/oldref{i}'} for i in range(3)]
    with db.get_connection() as c:
        c.execute('INSERT INTO restaurants (id, name_hebrew, google_place_id, photos) VALUES (?,?,?,?)',
                  ('r1', 'אחת', 'PLACE1', json.dumps(photos)))
    from routers import photos as photos_router
    photos_router._fresh_names.clear()
    app = FastAPI()
    app.include_router(photos_router.router)
    return TestClient(app), tmp_path


def get(client, ref=REF, width=800):
    return client.get(f'/api/photos/{ref}?maxwidth={width}')


def test_first_view_fetches_and_saves_later_views_are_free(env):
    client, tmp_path = env
    google = Google()
    with patch('httpx.AsyncClient.get', new=google):
        first = get(client)
        assert first.status_code == 200 and first.headers['content-type'] == 'image/jpeg'
        assert len(google.calls) == 1
        again = get(client, width=400)  # any width is served from the saved copy
    assert again.status_code == 200 and again.content == first.content
    assert len(google.calls) == 1
    assert again.headers['cache-control'] == 'public, max-age=31536000, immutable'
    saved = list((tmp_path / 'photo_cache').glob('*.jpg'))
    assert len(saved) == 1
    with Image.open(saved[0]) as im:
        assert max(im.size) <= 1200


def test_expired_reference_is_replaced_by_the_same_photo_fresh_and_saved_under_the_old_one(env):
    client, _ = env
    google = Google(alive=())
    with patch('httpx.AsyncClient.get', new=google):
        assert get(client).status_code == 200
        # The old reference was third in the restaurant's list, so the third fresh photo is used.
        assert google.calls[-1].startswith('https://places.googleapis.com/v1/places/PLACE1/photos/new2/media')
        n = len(google.calls)
        assert get(client).status_code == 200
    assert len(google.calls) == n


def test_fresh_names_are_fetched_once_per_place(env):
    client, _ = env
    google = Google(alive=())
    with patch('httpx.AsyncClient.get', new=google):
        get(client, 'places/PLACE1/photos/oldref0')
        get(client, 'places/PLACE1/photos/oldref1')
    details = [u for u in google.calls if '/media' not in u]
    assert len(details) == 1


def test_a_photo_google_cannot_give_is_remembered_and_not_paid_for_again(env):
    client, _ = env
    google = Google(alive=(), fresh=())
    with patch('httpx.AsyncClient.get', new=google):
        assert get(client).status_code == 404
        n = len(google.calls)
        assert get(client).status_code == 404
    assert len(google.calls) == n


def test_without_storage_it_still_serves_the_photo(env, monkeypatch):
    client, _ = env
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID', 'production')  # no volume configured
    monkeypatch.delenv('RAILWAY_VOLUME_MOUNT_PATH', raising=False)
    with patch('httpx.AsyncClient.get', new=Google()):
        assert get(client).status_code == 200


def test_saved_copies_are_removed_with_the_other_google_copies(env, monkeypatch):
    client, tmp_path = env
    with patch('httpx.AsyncClient.get', new=Google()):
        get(client)
    monkeypatch.setenv('API_SECRET_KEY', 'x' * 40)
    from routers import place_photos
    app = FastAPI()
    app.include_router(place_photos.router)
    r = TestClient(app).delete('/api/admin/place-photos', headers={'Authorization': 'Bearer ' + 'x' * 40})
    assert r.status_code == 200 and r.json()['deleted_cached'] == 1
    assert list((tmp_path / 'photo_cache').glob('*')) == []


def test_phone_multi_picture_jpeg_is_saved_too(env):
    """Phone photos are often MPO (a JPEG with extra frames). Seen live on 22.11.2026."""
    client, tmp_path = env
    b = io.BytesIO()
    Image.new('RGB', (1200, 1600), 'blue').save(b, 'MPO', save_all=True,
                                                append_images=[Image.new('RGB', (1200, 1600), 'green')])
    mpo = b.getvalue()

    async def google(_client, url, **kwargs):
        return response(200, mpo)

    with patch('httpx.AsyncClient.get', new=google):
        first = get(client)
    assert first.headers['cache-control'] == 'public, max-age=31536000, immutable'
    saved = list((tmp_path / 'photo_cache').glob('*.jpg'))
    assert len(saved) == 1
    with Image.open(saved[0]) as im:
        assert im.format == 'JPEG' and max(im.size) <= 1200

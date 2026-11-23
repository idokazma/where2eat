"""Places with a Google ID but no photo list get their photos on the fly.

The first view of a place's n-th photo asks Google for the place's photo list once,
saves the list on the restaurant (so later loads use it directly), and serves the
photo through the same saved-copy cache as every other Google photo.
"""
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

NAMES = ['places/PLACE1/photos/a', 'places/PLACE1/photos/b', 'places/PLACE1/photos/c']


def jpeg():
    b = io.BytesIO()
    Image.new('RGB', (900, 600), 'red').save(b, 'JPEG')
    return b.getvalue()


class Google:
    def __init__(self, names=NAMES):
        self.names = names
        self.calls = []

    async def __call__(self, url, **kwargs):
        self.calls.append(url)
        req = httpx.Request('GET', url)
        if '/media' in url:
            return httpx.Response(200, content=jpeg(), headers={'content-type': 'image/jpeg'}, request=req)
        if url.startswith('https://places.googleapis.com/v1/places/'):
            return httpx.Response(200, json={'photos': [{'name': n, 'widthPx': 900, 'heightPx': 600}
                                                        for n in self.names]}, request=req)
        return httpx.Response(404, request=req)

    def details(self):
        return [u for u in self.calls if '/media' not in u]

    def media(self):
        return [u for u in self.calls if '/media' in u]


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    monkeypatch.setenv('GOOGLE_PLACES_API_KEY', 'dummy')
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    db = Database(str(tmp_path / 'where2eat.db'))
    with db.get_connection() as c:
        c.execute('INSERT INTO restaurants (id, name_hebrew, google_place_id, photos) VALUES (?,?,?,?)',
                  ('r1', 'אחת', 'PLACE1', '[]'))
    from routers import photos as photos_router
    photos_router._fresh_names.clear()
    app = FastAPI()
    app.include_router(photos_router.router)
    return TestClient(app), db


def stored_refs(db):
    with db.get_connection() as c:
        row = c.execute("SELECT photos FROM restaurants WHERE id='r1'").fetchone()
    return [p['photo_reference'] for p in json.loads(row['photos'] or '[]')]


def test_get_place_photo_first_view_fetches_list_once_and_saves_it(env):
    client, db = env
    google = Google()
    with patch('httpx.AsyncClient.get', new=google):
        r = client.get('/api/photos/place/PLACE1/1?maxwidth=800')
    assert r.status_code == 200 and r.headers['content-type'] == 'image/jpeg'
    assert len(google.details()) == 1
    assert google.media() and '/places/PLACE1/photos/b/media' in google.media()[0]
    assert stored_refs(db) == NAMES


def test_get_place_photo_later_views_use_the_saved_list(env):
    client, _ = env
    google = Google()
    with patch('httpx.AsyncClient.get', new=google):
        client.get('/api/photos/place/PLACE1/0')
        client.get('/api/photos/place/PLACE1/2')
    assert len(google.details()) == 1
    assert len(google.media()) == 2


def test_get_place_photo_shares_the_cache_with_the_named_photo(env):
    client, _ = env
    google = Google()
    with patch('httpx.AsyncClient.get', new=google):
        first = client.get('/api/photos/place/PLACE1/1')
        n = len(google.calls)
        # After the list is saved, the stories ask for the photo by its name: no new payment.
        again = client.get('/api/photos/' + NAMES[1])
        by_index = client.get('/api/photos/place/PLACE1/1')
    assert again.status_code == 200 and again.content == first.content == by_index.content
    assert len(google.calls) == n


def test_get_place_photo_beyond_the_list_is_404_without_a_media_call(env):
    client, _ = env
    google = Google(names=NAMES[:1])
    with patch('httpx.AsyncClient.get', new=google):
        r = client.get('/api/photos/place/PLACE1/3')
    assert r.status_code == 404
    assert google.media() == []


def test_get_place_photo_unknown_place_makes_no_google_call(env):
    client, _ = env
    google = Google()
    with patch('httpx.AsyncClient.get', new=google):
        r = client.get('/api/photos/place/NOT_OURS/0')
    assert r.status_code == 404 and google.calls == []


def test_get_place_photo_budget_stopped_makes_no_paid_call(env, monkeypatch):
    client, _ = env
    monkeypatch.setenv('COST_REQUIRE_VERIFIED_OPENING', 'true')
    monkeypatch.setenv('COST_MONTHLY_BUDGET_USD', '0')
    monkeypatch.delenv('COST_OPENING_MONTH', raising=False)
    google = Google()
    with patch('httpx.AsyncClient.get', new=google):
        r = client.get('/api/photos/place/PLACE1/0')
    assert r.status_code == 404 and google.calls == [] and r.headers['cache-control'] == 'no-store'

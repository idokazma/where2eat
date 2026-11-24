"""Seed-time canonical mention link and truthful photo provenance.

Covers:
- canonical_restaurant_id attaches a new review to the existing canonical
  restaurant instead of creating a duplicate venue card
- unknown canonical ids fail the mention without writing it
- malformed canonical ids are blocked by the offline publication check
- a verified curated photo persists its truthful provenance (credit + source
  kind) on the restaurant record
- the admin patch endpoint validates provenance and clears it with the image
"""
import hashlib
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))

SEGMENTS = [{'start': 10, 'duration': 5, 'text': 'exact quote from the timed segment'}]
CANONICAL_ID = 'dbe58419-7e3a-4343-a609-6e8b6a48b128'


def reviewed_row(**overrides):
    row = {
        'name_hebrew': 'ARC',
        'verdict': 'add_to_page',
        'timestamp': {'seconds': 10},
        'publication_review': {
            'identity': {
                'status': 'verified',
                'source_url': 'https://venue.example/about',
                'source_name': 'ARC',
                'transcript_name': 'ארק',
                'context_clues': {'city': 'יפו', 'address': 'לואי פסטר 2'},
            },
            'discussion': {
                'kind': 'discussion',
                'selected_seconds': 10,
                'video_id': 'shorts1',
                'all_occurrences_reviewed': True,
                'quote': 'exact quote from the timed segment',
            },
            'photo': {'status': 'unavailable', 'reason': 'Canonical venue photo handled separately'},
        },
        'host_quotes': ['exact quote from the timed segment'],
        'speaker': 'קרניבורים אורגינל',
    }
    row.update(overrides)
    return row


@pytest.fixture
def seed_client(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    import database
    database._db_instance = None
    db = database.Database(str(tmp_path / 'where2eat.db'))
    from routers import episodes
    from routers.admin import get_current_user
    app = FastAPI()
    app.include_router(episodes.router)
    app.dependency_overrides[get_current_user] = lambda: {'id': 'admin', 'role': 'admin'}
    yield TestClient(app), db
    database._db_instance = None


def seed_payload(restaurants):
    return {
        'episode': {
            'video_id': 'shorts1',
            'video_url': 'https://www.youtube.com/shorts/shorts1',
            'title': 'Short',
            'channel_name': 'קרניבורים אורגינל',
        },
        'restaurants': restaurants,
        'transcript_segments': SEGMENTS,
    }


def test_canonical_link_attaches_review_without_duplicate(seed_client):
    client, db = seed_client
    canonical_id = db.create_restaurant(
        name_hebrew='ARC', city='יפו', host_comments='original review', is_hidden=1)
    response = client.post('/api/episodes/seed', json=seed_payload([
        reviewed_row(canonical_restaurant_id=canonical_id)]))
    assert response.status_code == 200, response.text
    assert response.json()['mentions_added'] == 1
    with db.get_connection() as conn:
        assert conn.execute('SELECT COUNT(*) FROM restaurants').fetchone()[0] == 1
        mention = dict(conn.execute('SELECT * FROM episode_mentions').fetchone())
    assert mention['restaurant_id'] == canonical_id
    # The canonical row keeps its own content; the new review lives on the mention.
    restaurant = db.get_restaurant(canonical_id)
    assert restaurant['host_comments'] == 'original review'
    assert restaurant['is_hidden'] == 1
    reviews = db.get_restaurant_reviews(canonical_id)
    assert len(reviews) == 1
    assert reviews[0]['video_id'] == 'shorts1'
    assert reviews[0]['host_quotes'] == ['exact quote from the timed segment']
    assert reviews[0]['channel_name'] == 'קרניבורים אורגינל'
    assert reviews[0]['youtube_url'].endswith('?t=10s')


def test_unknown_canonical_id_fails_mention_without_writes(seed_client):
    client, db = seed_client
    response = client.post('/api/episodes/seed', json=seed_payload([
        reviewed_row(canonical_restaurant_id=CANONICAL_ID)]))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body['status'] == 'partial'
    assert body['failed_mentions'][0]['stage'] == 'canonical_lookup'
    with db.get_connection() as conn:
        assert conn.execute('SELECT COUNT(*) FROM restaurants').fetchone()[0] == 0
        assert conn.execute('SELECT COUNT(*) FROM episode_mentions').fetchone()[0] == 0


def test_malformed_canonical_id_blocked_offline(seed_client):
    client, db = seed_client
    response = client.post('/api/episodes/seed', json=seed_payload([
        reviewed_row(canonical_restaurant_id='not-a-uuid')]))
    assert response.status_code == 422
    blockers = response.json()['detail']['blockers']
    assert 'canonical_restaurant_id_invalid' in blockers[0]['issues']
    with db.get_connection() as conn:
        assert conn.execute('SELECT COUNT(*) FROM episodes').fetchone()[0] == 0


def test_verified_curated_photo_persists_truthful_provenance(seed_client, tmp_path):
    client, db = seed_client
    data = b'curated directory image bytes'
    digest = hashlib.sha256(data).hexdigest()
    assets = tmp_path / 'venue_images'
    assets.mkdir()
    (assets / (digest + '.jpg')).write_bytes(data)
    row = reviewed_row(
        image_url='https://where2eat-production.up.railway.app/api/venue-images/' + digest + '.jpg',
    )
    row['publication_review']['photo'] = {
        'status': 'verified',
        'source_kind': 'directory',
        'source_url': 'https://directory.example/arc',
        'credit': 'Directory listing, not the venue',
        'identity_checked': True,
        'pixels_checked': True,
        'content_kind': 'food',
        'sha256': digest,
    }
    response = client.post('/api/episodes/seed', json=seed_payload([row]))
    assert response.status_code == 200, response.text
    with db.get_connection() as conn:
        stored = dict(conn.execute('SELECT * FROM restaurants').fetchone())
    assert stored['image_source'] == 'directory'
    assert stored['image_credit'] == 'Directory listing, not the venue'


@pytest.fixture
def admin_client(tmp_path, monkeypatch):
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    import database
    database._db_instance = None
    db = database.Database(str(tmp_path / 'where2eat.db'))
    from routers import admin
    app = FastAPI()
    app.include_router(admin.router)
    app.dependency_overrides[admin.get_current_user] = lambda: {'id': 'admin', 'role': 'admin'}
    yield TestClient(app), db
    database._db_instance = None


def test_admin_patch_records_truthful_provenance(admin_client):
    client, db = admin_client
    rid = db.create_restaurant(name_hebrew='ARC')
    response = client.patch(f'/api/admin/restaurants/{rid}', json={
        'image_url': 'https://where2eat-production.up.railway.app/api/venue-images/' + 'a' * 64 + '.jpg',
        'image_source': 'editorial',
        'image_credit': 'News article photo',
    })
    assert response.status_code == 200, response.text
    restaurant = db.get_restaurant(rid)
    assert restaurant['image_source'] == 'editorial'
    assert restaurant['image_credit'] == 'News article photo'


def test_admin_patch_rejects_unknown_source_kind(admin_client):
    client, db = admin_client
    rid = db.create_restaurant(name_hebrew='ARC')
    response = client.patch(f'/api/admin/restaurants/{rid}', json={'image_source': 'owner'})
    assert response.status_code == 422


def test_admin_patch_source_requires_credit(admin_client):
    client, db = admin_client
    rid = db.create_restaurant(name_hebrew='ARC')
    response = client.patch(f'/api/admin/restaurants/{rid}', json={'image_source': 'creator_owned'})
    assert response.status_code == 422
    # ... unless the restaurant already carries a credit
    assert db.update_restaurant(rid, image_credit='Creator channel')
    response = client.patch(f'/api/admin/restaurants/{rid}', json={'image_source': 'creator_owned'})
    assert response.status_code == 200, response.text


def test_admin_patch_clearing_image_clears_provenance(admin_client):
    client, db = admin_client
    rid = db.create_restaurant(name_hebrew='ARC')
    assert db.update_restaurant(rid, image_url='https://img.example/x.jpg',
                                image_source='directory', image_credit='Directory')
    response = client.patch(f'/api/admin/restaurants/{rid}', json={'image_url': ''})
    assert response.status_code == 200, response.text
    restaurant = db.get_restaurant(rid)
    assert restaurant['image_url'] == ''
    assert restaurant['image_source'] is None
    assert restaurant['image_credit'] is None


def test_review_links_use_valid_timestamp_separator(seed_client):
    client, db = seed_client
    canonical_id = db.create_restaurant(name_hebrew='ARC', city='יפו')
    payload = seed_payload([reviewed_row(canonical_restaurant_id=canonical_id)])
    assert client.post('/api/episodes/seed', json=payload).status_code == 200
    url = db.get_restaurant_reviews(canonical_id)[0]['youtube_url']
    # A Shorts URL has no query string yet, so the timestamp starts one with "?".
    assert url == 'https://www.youtube.com/shorts/shorts1?t=10s'

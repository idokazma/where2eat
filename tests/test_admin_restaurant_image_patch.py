"""Role-authenticated curated-image assignment on PATCH /api/admin/restaurants/{id}."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))  # api/models must shadow src/models
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from routers.admin import router, get_current_user

RID = '61a9696d-b4fe-4fff-9bee-6ea6574c1cfd'
ASSET = 'https://where2eat-production.up.railway.app/api/venue-images/' + 'a' * 64 + '.jpg'


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def as_role(client, role):
    client.app.dependency_overrides[get_current_user] = lambda: {'id': 'u1', 'role': role}


class RecordingDB:
    def __init__(self, record, found=True):
        self.record = record
        self.found = found

    def update_restaurant(self, restaurant_id, **kwargs):
        self.record['restaurant_id'] = restaurant_id
        self.record['updates'] = kwargs
        return self.found


def patch_with_db(client, body, found=True):
    record = {}
    with patch('database.get_database', return_value=RecordingDB(record, found)):
        response = client.patch(f'/api/admin/restaurants/{RID}', json=body)
    return response, record


def test_image_assignment_requires_auth(client):
    assert client.patch(f'/api/admin/restaurants/{RID}', json={'image_url': ASSET}).status_code == 401


def test_viewer_cannot_assign_image(client):
    as_role(client, 'viewer')
    assert client.patch(f'/api/admin/restaurants/{RID}', json={'image_url': ASSET}).status_code == 403


def test_editor_assigns_venue_image_and_clears_stale_google_photos(client):
    as_role(client, 'editor')
    response, record = patch_with_db(client, {'image_url': ASSET, 'photos': []})
    assert response.status_code == 200, response.text
    assert set(response.json()['updated_fields']) == {'image_url', 'photos'}
    assert record['restaurant_id'] == RID
    assert record['updates'] == {'image_url': ASSET, 'photos': []}


def test_image_url_alone_when_photos_already_empty(client):
    as_role(client, 'admin')
    response, record = patch_with_db(client, {'image_url': ASSET})
    assert response.status_code == 200
    assert record['updates'] == {'image_url': ASSET}


def test_empty_string_clears_image(client):
    as_role(client, 'editor')
    response, record = patch_with_db(client, {'image_url': ''})
    assert response.status_code == 200
    assert record['updates'] == {'image_url': ''}


@pytest.mark.parametrize('bad', [
    'http://insecure.example.com/x.jpg',
    'javascript:alert(1)',
    '/api/venue-images/' + 'a' * 64 + '.jpg',
    'a' * 64 + '.jpg',
    'https://example.com/' + 'x' * 500,
    123,
    None,
    {'url': ASSET},
])
def test_image_url_validation(client, bad):
    as_role(client, 'editor')
    response, record = patch_with_db(client, {'image_url': bad})
    assert response.status_code == 422, (bad, response.text)
    assert record == {}


@pytest.mark.parametrize('bad', [
    'not-a-list',
    [{'photo_url': 'https://x'}, 'junk'],
    42,
    None,
])
def test_photos_validation(client, bad):
    as_role(client, 'editor')
    response, record = patch_with_db(client, {'photos': bad})
    assert response.status_code == 422, (bad, response.text)
    assert record == {}


def test_photos_objects_accepted(client):
    as_role(client, 'editor')
    photos = [{'photo_url': ASSET, 'is_owner_photo': True}]
    response, record = patch_with_db(client, {'photos': photos})
    assert response.status_code == 200
    assert record['updates'] == {'photos': photos}


def test_unknown_restaurant_is_404(client):
    as_role(client, 'editor')
    response, _ = patch_with_db(client, {'image_url': ASSET}, found=False)
    assert response.status_code == 404


def test_no_valid_fields_is_400(client):
    as_role(client, 'editor')
    response, record = patch_with_db(client, {'image_urll': ASSET})
    assert response.status_code == 400
    assert record == {}

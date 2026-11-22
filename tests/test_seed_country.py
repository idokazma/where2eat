"""POST /api/episodes/seed keeps the analyzer's country; the Israel default applies only when none is given."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from database import Database
from routers.admin import get_current_user
from routers.episodes import router


@pytest.fixture
def seed(tmp_path):
    db = Database(str(tmp_path / 'where2eat.db'))
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: {'id': 'a', 'role': 'admin'}
    client = TestClient(app)

    def run(restaurant):
        body = {'episode': {'video_id': 'vid1', 'title': 't', 'channel_name': 'c'},
                'restaurants': [dict(restaurant, name_hebrew='מקום', verdict='add_to_page')]}
        with patch('routers.episodes._get_sqlite_db', return_value=db), \
                patch('publication_quality.publication_issues', return_value=[]), \
                patch('publication_quality.save_review_draft', return_value=None):
            r = client.post('/api/episodes/seed', json=body)
        assert r.status_code == 200, r.text
        with db.get_connection() as c:
            return c.execute('SELECT country FROM restaurants').fetchone()[0]
    return run


def test_top_level_country_is_kept(seed):
    assert seed({'country': 'France'}) == 'France'


def test_nested_location_country_is_kept(seed):
    assert seed({'location': {'country': 'USA'}}) == 'USA'


def test_top_level_wins_over_nested_when_they_conflict(seed):
    assert seed({'country': 'Romania', 'location': {'country': 'USA'}}) == 'Romania'


def test_missing_country_defaults_to_israel(seed):
    assert seed({}) == 'Israel'


def test_empty_country_defaults_to_israel(seed):
    assert seed({'country': '', 'location': {'country': None}}) == 'Israel'

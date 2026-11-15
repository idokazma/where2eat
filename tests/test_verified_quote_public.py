"""Public mention responses show the reviewed quote but never who reviewed it."""
import json

import pytest

from admin_maintenance import Maintenance
from database import Database

REVIEW = {'text': 'clean quote', 'source_url': 'https://cdn.example/ep.mp3', 'start_seconds': 10, 'end_seconds': 18}


@pytest.fixture
def db(tmp_path):
    db = Database(str(tmp_path / 't.db'))
    with db.get_connection() as c:
        c.execute("INSERT INTO episodes(id,video_id,video_url,title) VALUES('e1','vid1','u','t')")
        c.execute("INSERT INTO restaurants(id,name_hebrew,episode_id) VALUES('r1','x','e1')")
        c.execute(
            "INSERT INTO episode_mentions(id,episode_id,video_id,restaurant_id,name_hebrew,verdict,host_quotes) "
            "VALUES('m1','e1','vid1','r1','x','add_to_page',?)", (json.dumps(['raw']),))
    m = Maintenance(db)
    changes = {'verified_quote': dict(REVIEW)}
    m.repair('m1', changes, m.preview_repair('m1', changes)['revision'], 'admin-user-id')
    return db


def test_get_episode_mentions_verified_quote_hides_reviewer_identity(db):
    mention = db.get_episode_mentions('vid1')[0]
    assert mention['host_quotes'] == ['clean quote'] and mention['source_host_quotes'] == ['raw']
    assert 'reviewed_by' not in mention['verified_quote']
    assert 'admin-user-id' not in json.dumps(mention, ensure_ascii=False, default=str)


def test_get_restaurant_mentions_verified_quote_hides_reviewer_identity(db):
    mention = db.get_restaurant_mentions('r1')[0]
    assert mention['host_quotes'] == ['clean quote']
    assert 'admin-user-id' not in json.dumps(mention, ensure_ascii=False, default=str)


def test_reviewer_identity_stays_in_storage_for_audit(db):
    with db.get_connection() as c:
        stored = json.loads(c.execute("SELECT verified_quote FROM episode_mentions WHERE id='m1'").fetchone()[0])
    assert stored['reviewed_by'] == 'admin-user-id' and stored['reviewed_at']

"""Restaurant cards get their creator label from the episode when the row's own copy is empty."""
import pytest

from database import Database


@pytest.fixture
def db(tmp_path):
    db = Database(str(tmp_path / 't.db'))
    with db.get_connection() as c:
        c.execute("INSERT INTO episodes (id, video_id, video_url, channel_name, title, published_at) "
                  "VALUES ('e1','vidA','https://www.youtube.com/watch?v=vidA','מדברים מהבטן - הפודיום','176','2026-10-28')")
        # Denormalized episode fields present, but channel_name was never copied onto the row.
        c.execute("INSERT INTO restaurants (id, episode_id, name_hebrew, city, video_id, video_url, channel_name) "
                  "VALUES ('r1','e1','אבו עומר','טירה','vidA','https://www.youtube.com/watch?v=vidA',NULL)")
        # No episode_id link at all, only the video id.
        c.execute("INSERT INTO restaurants (id, episode_id, name_hebrew, city, video_id, video_url, channel_name) "
                  "VALUES ('r2',NULL,'שני','תל אביב','vidA','https://www.youtube.com/watch?v=vidA',NULL)")
        # Row has its own channel name: keep it.
        c.execute("INSERT INTO restaurants (id, episode_id, name_hebrew, city, video_id, video_url, channel_name) "
                  "VALUES ('r3','e1','שלישי','חיפה','vidA','https://www.youtube.com/watch?v=vidA','גיל הראל')")
        c.execute("INSERT INTO episode_mentions (id, episode_id, video_id, restaurant_id, name_hebrew, verdict, speaker) "
                  "VALUES ('m1','e1','vidA','r1','x','add_to_page','גיל')")
    return db


def _by_id(db):
    return {r['id']: r for r in db.get_all_restaurants(include_episode_info=True)}


def test_get_all_restaurants_missing_channel_uses_episode_channel(db):
    assert _by_id(db)['r1']['episode_info']['channel_name'] == 'מדברים מהבטן - הפודיום'


def test_get_all_restaurants_missing_channel_and_episode_link_uses_video_id(db):
    assert _by_id(db)['r2']['episode_info']['channel_name'] == 'מדברים מהבטן - הפודיום'


def test_get_all_restaurants_existing_channel_is_kept(db):
    assert _by_id(db)['r3']['episode_info']['channel_name'] == 'גיל הראל'


def test_get_all_restaurants_mentions_include_channel_and_speaker(db):
    m = _by_id(db)['r1']['mentions'][0]
    assert m['channel_name'] == 'מדברים מהבטן - הפודיום' and m['speaker'] == 'גיל'

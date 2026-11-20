"""Catalog behind the read-only MCP server: published data only, evidence on every result."""
import json
from datetime import date, timedelta

import pytest

from database import Database
from mcp_catalog import Catalog

TODAY = date(2026, 11, 20)
RECENT = (TODAY - timedelta(days=5)).isoformat()
OLD = (TODAY - timedelta(days=200)).isoformat()


def _restaurant(c, rid, name, city, cuisine, **kw):
    row = {'id': rid, 'name_hebrew': name, 'name_english': kw.pop('name_english', None), 'city': city,
           'cuisine_type': cuisine, 'is_hidden': 0, 'mention_level': 'נטעם', **kw}
    cols = ','.join(row)
    c.execute(f'INSERT INTO restaurants ({cols}) VALUES ({",".join("?" * len(row))})', list(row.values()))


def _episode(c, eid, vid, channel, published):
    c.execute('INSERT INTO episodes (id, video_id, video_url, channel_name, title, published_at) VALUES (?,?,?,?,?,?)',
              (eid, vid, f'https://www.youtube.com/watch?v={vid}', channel, f'Episode {vid}', published))


def _mention(c, mid, eid, vid, rid, **kw):
    row = {'id': mid, 'episode_id': eid, 'video_id': vid, 'restaurant_id': rid, 'name_hebrew': 'x',
           'verdict': 'add_to_page', 'mention_level': 'נטעם', 'timestamp_seconds': 512, **kw}
    cols = ','.join(row)
    c.execute(f'INSERT INTO episode_mentions ({cols}) VALUES ({",".join("?" * len(row))})', list(row.values()))


@pytest.fixture
def catalog(tmp_path):
    db = Database(str(tmp_path / 't.db'))
    with db.get_connection() as c:
        _episode(c, 'e1', 'vidNEW00001', 'מדברים מהבטן', RECENT)
        _episode(c, 'e2', 'vidOLD00002', 'מדברים מהבטן', OLD)
        _episode(c, 'e3', 'vidOTHER003', 'יוצר אחר', RECENT)
        _restaurant(c, 'r1', 'אבו עומר', 'טירה', 'חומוסייה', name_english='Abu Omar', google_rating=4.6,
                    image_url='https://lh3.googleusercontent.com/p/abc', menu_items=json.dumps(['חומוס', 'פול']),
                    latitude=32.2, longitude=34.9, google_place_id='PID1')
        _restaurant(c, 'r2', 'פיצה 194', 'תל אביב', 'פיצה', name_english='Pizza 194', google_rating=4.7,
                    image_url='/api/photos/places/X/photos/Y')
        _restaurant(c, 'r3', 'מוסתר', 'תל אביב', 'פיצה', is_hidden=1)
        _restaurant(c, 'r4', 'ללא עיר', 'לא צוין', 'פיצה')
        _restaurant(c, 'r5', 'ישנה', 'חיפה', 'בשרים', engaging_quote='היה פשוט מעולה. באמת. ועוד משפט שלישי.',
                    video_id='vidOLD00002', mention_timestamp=90, channel_name='מדברים מהבטן', published_at=OLD)
        _mention(c, 'm1', 'e1', 'vidNEW00001', 'r1', host_quotes=json.dumps(['אבו עומר בטירה פשוט טעים']),
                 verified_quote=json.dumps({'text': 'פשוט טעים', 'source_url': 'https://a.example/ep.mp3',
                                            'start_seconds': 500, 'end_seconds': 506, 'reviewed_by': 'ADMIN-ID'}))
        _mention(c, 'm2', 'e2', 'vidOLD00002', 'r1', mention_level='הוזכר', timestamp_seconds=60,
                 host_quotes=json.dumps(['פעם היה פחות טוב']))
        _mention(c, 'm3', 'e3', 'vidOTHER003', 'r2', host_quotes=json.dumps(['פיצה מעולה, משפט ראשון. משפט שני. משפט שלישי.']))
        _mention(c, 'm4', 'e1', 'vidNEW00001', 'r2', verdict='rejected', host_quotes=json.dumps(['לא לפרסום']))
        _mention(c, 'm5', 'e1', 'vidNEW00001', 'r3', host_quotes=json.dumps(['מוסתר']))
    return Catalog(db, today=TODAY)


def _ids(result):
    return [r['id'] for r in result['results']]


# ── visibility
def test_search_excludes_hidden_and_invalid_restaurants(catalog):
    ids = _ids(catalog.search_restaurants(limit=5))
    assert 'r3' not in ids and 'r4' not in ids
    assert set(ids) == {'r1', 'r2', 'r5'}


def test_get_restaurant_hidden_returns_not_found(catalog):
    assert catalog.get_restaurant('r3')['found'] is False


def test_rejected_mentions_never_served(catalog):
    texts = json.dumps(catalog.get_restaurant('r2'), ensure_ascii=False)
    assert 'לא לפרסום' not in texts


# ── filters
def test_search_city_english_alias_matches_hebrew(catalog):
    assert _ids(catalog.search_restaurants(city='Tel Aviv')) == ['r2']


def test_search_cuisine_english_alias_matches_hebrew(catalog):
    assert _ids(catalog.search_restaurants(cuisine='pizza')) == ['r2']


def test_search_dish_matches_menu_items(catalog):
    assert _ids(catalog.search_restaurants(dish='פול')) == ['r1']


def test_search_creator_filters_by_channel(catalog):
    assert _ids(catalog.search_restaurants(creator='יוצר אחר')) == ['r2']


def test_search_published_after_uses_mention_dates(catalog):
    ids = _ids(catalog.search_restaurants(published_after=(TODAY - timedelta(days=30)).isoformat(), limit=5))
    assert set(ids) == {'r1', 'r2'}


def test_search_tasted_only_requires_tasted_mention(catalog):
    res = catalog.search_restaurants(tasted_only=True, published_after=(TODAY - timedelta(days=30)).isoformat(), limit=5)
    assert set(_ids(res)) == {'r1', 'r2'}


def test_search_limit_is_capped_at_five(catalog):
    assert catalog.search_restaurants(limit=50)['limit'] == 5


# ── evidence
def test_verified_quote_is_returned_as_quote_without_reviewer(catalog):
    ev = catalog.search_restaurants(city='טירה')['results'][0]['evidence'][0]
    assert ev['excerpt'] == {'text': 'פשוט טעים', 'kind': 'verified_quote'}
    assert 'ADMIN-ID' not in json.dumps(catalog.get_restaurant('r1'), ensure_ascii=False)


def test_unverified_excerpt_is_labeled_and_capped_to_two_sentences(catalog):
    ev = catalog.search_restaurants(cuisine='פיצה')['results'][0]['evidence'][0]
    assert ev['excerpt']['kind'] == 'unverified_transcript'
    assert ev['excerpt']['text'] == 'פיצה מעולה, משפט ראשון. משפט שני.'


def test_evidence_links_to_exact_moment_and_dates(catalog):
    ev = catalog.search_restaurants(city='טירה')['results'][0]['evidence'][0]
    assert ev['moment_url'] == 'https://www.youtube.com/watch?v=vidNEW00001&t=512s'
    assert ev['published_at'] == RECENT and ev['creator'] == 'מדברים מהבטן'
    assert ev['experience'] == 'tasted'


def test_restaurant_without_mentions_falls_back_to_restaurant_evidence(catalog):
    ev = catalog.get_restaurant('r5')['restaurant']['evidence'][0]
    assert ev['moment_url'] == 'https://www.youtube.com/watch?v=vidOLD00002&t=90s'
    assert ev['excerpt']['kind'] == 'unverified_summary'


def test_get_restaurant_lists_all_mentions_newest_first(catalog):
    evidence = catalog.get_restaurant('r1')['restaurant']['evidence']
    assert [e['published_at'] for e in evidence] == [RECENT, OLD]
    assert evidence[1]['experience'] == 'mentioned'


def test_image_never_uses_paid_photo_proxy(catalog):
    by_id = {r['id']: r for r in catalog.search_restaurants(limit=5)['results']}
    assert by_id['r1']['image_url'] == 'https://lh3.googleusercontent.com/p/abc'
    assert by_id['r2']['image_url'] is None


def test_result_links_back_to_site_with_campaign_tag(catalog):
    r = catalog.search_restaurants(city='טירה')['results'][0]
    assert r['where2eat_url'].startswith('https://www.where2eat.rest/restaurant/r1?utm_source=')
    assert r['map_url'].startswith('https://www.google.com/maps/')


# ── no coverage
def test_search_no_match_returns_explicit_no_coverage_with_reason(catalog):
    res = catalog.search_restaurants(city='אילת')
    assert res['results'] == []
    assert res['no_coverage']['reason'] == 'city_not_covered'


def test_search_no_match_combination_reason(catalog):
    res = catalog.search_restaurants(city='טירה', cuisine='פיצה')
    assert res['results'] == [] and res['no_coverage']['reason'] == 'no_place_matches_all_filters'


# ── whats new / creators
def test_whats_new_returns_recent_mentions_newest_first(catalog):
    res = catalog.whats_new(days=30)
    assert {r['id'] for r in res['results']} == {'r1', 'r2'}
    assert all(r['evidence'][0]['published_at'] >= (TODAY - timedelta(days=30)).isoformat() for r in res['results'])


def test_list_creators_reports_coverage_and_last_update(catalog):
    res = catalog.list_creators()
    by_name = {c['name']: c for c in res['creators']}
    assert by_name['מדברים מהבטן']['places'] == 2 and by_name['מדברים מהבטן']['last_published_at'] == RECENT
    assert by_name['יוצר אחר']['places'] == 1
    assert 'טירה' in res['available_cities'] and 'פיצה' in res['available_cuisines']
    assert 'not affiliated' in res['note']


def test_excerpt_unpunctuated_transcript_capped_at_200_chars():
    from mcp_catalog import excerpt
    out = excerpt('מילה ' * 120)
    assert len(out) <= 200 and out.endswith('…')

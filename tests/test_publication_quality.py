import copy
import hashlib
import sys
from pathlib import Path
from unittest.mock import Mock

import pytest

from publication_quality import publication_issues


@pytest.fixture
def good():
    return {
        'name_hebrew': 'Jai Lek', 'verdict': 'add_to_page',
        'timestamp': {'seconds': 2958},
        'publication_review': {
            'identity': {'status': 'verified', 'source_url': 'https://venue.example/about',
                         'source_name': 'Jai Lek', 'transcript_name': 'צ׳ה לק',
                         'context_clues': {'city': 'Herzliya', 'chef': 'Melili'}},
            'discussion': {'kind': 'discussion', 'selected_seconds': 2958, 'video_id': 'episode175',
                           'all_occurrences_reviewed': True, 'quote': 'The restaurant whose name we cannot say'},
            'photo': {'status': 'unavailable', 'reason': 'Only signed owner-social asset found; durable upload pending'},
        },
    }


@pytest.fixture
def segments():
    return [
        {'start': 140, 'duration': 5, 'text': 'Coming up: Jai Lek'},
        {'start': 2958, 'duration': 8, 'text': 'The restaurant whose name we cannot say'},
        {'start': 2970, 'duration': 8, 'text': 'Jai Lek, Thai House in Herzliya'},
        {'start': 4200, 'duration': 2, 'text': 'Closing recap: Jai Lek'},
    ]


def codes(row, segments, **kwargs):
    issues = publication_issues([row], segments, 'episode175', **kwargs)
    return issues[0]['issues'] if issues else []


def test_verified_discussion_with_explicit_missing_photo_can_publish(good, segments):
    assert codes(good, segments) == []


def test_teaser_not_accepted_with_later_discussion_evidence(good, segments):
    good['timestamp']['seconds'] = 140
    good['publication_review']['discussion']['selected_seconds'] = 140
    assert 'discussion_quote_not_in_timed_source' in codes(good, segments)


def test_closing_recap_not_accepted_with_discussion_evidence(good, segments):
    good['timestamp']['seconds'] = 4200
    good['publication_review']['discussion']['selected_seconds'] = 4200
    assert 'discussion_quote_not_in_timed_source' in codes(good, segments)


def test_same_name_without_context_does_not_pass(good, segments):
    good['publication_review']['identity']['context_clues'] = {}
    assert 'identity_context_unverified' in codes(good, segments)


@pytest.mark.parametrize('value', [None, -1, 9000, True, '49:18', float('nan')])
def test_invalid_timestamp_blocked(good, segments, value):
    good['timestamp']['seconds'] = value
    assert 'timestamp_missing_or_out_of_range' in codes(good, segments)


def test_no_segments_is_not_zero_time(good):
    assert 'timestamp_missing_or_out_of_range' in codes(good, [])


def test_signed_social_photo_not_publication_ready(good, segments):
    good['image_url'] = 'https://scontent.example/img.jpg?expires=tomorrow'
    good['publication_review']['photo'] = {'status': 'verified'}
    assert 'durable_photo_required' in codes(good, segments)


def test_photo_bytes_verified_from_local_storage(good, segments, tmp_path):
    data = b'test JPEG bytes'; digest = hashlib.sha256(data).hexdigest()
    path = tmp_path / (digest + '.jpg'); path.write_bytes(data)
    good['image_url'] = 'https://where2eat-production.up.railway.app/api/venue-images/' + digest + '.jpg'
    good['publication_review']['photo'] = {
        'status': 'verified', 'source_kind': 'venue_owned', 'source_url': 'https://venue.example/photo',
        'credit': 'Venue', 'identity_checked': True, 'pixels_checked': True,
        'content_kind': 'interior', 'sha256': digest,
    }
    assert codes(good, segments, asset_root=tmp_path) == []
    path.write_bytes(b'changed')
    assert 'durable_photo_bytes_missing_or_changed' in codes(good, segments, asset_root=tmp_path)


def test_unavailable_does_not_hide_unreviewed_photo(good, segments):
    good['google_places'] = {'photo_url': 'https://wrong-venue.example/photo.jpg'}
    assert 'missing_photo_requires_empty_image_and_reason' in codes(good, segments)


def test_unreviewed_extraction_is_blocked(good, segments):
    del good['publication_review']
    assert set(codes(good, segments)) == {'identity_context_unverified', 'discussion_not_reviewed', 'photo_review_missing'}


def test_reference_only_not_forced_to_have_feed_photo():
    assert publication_issues([{'verdict': 'reference_only'}, {'verdict': 'rejected'}], [], 'episode175') == []


def test_review_not_mutated(good, segments):
    before = copy.deepcopy(good)
    codes(good, segments)
    assert good == before


def test_seed_gate_runs_before_any_db_write(monkeypatch):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routers import episodes
    from routers.admin import get_current_user
    db = Mock()
    monkeypatch.setattr(episodes, '_get_sqlite_db', lambda: db)
    app = FastAPI(); app.include_router(episodes.router)
    app.dependency_overrides[get_current_user] = lambda: {'id': 'admin', 'role': 'admin'}
    response = TestClient(app).post('/api/episodes/seed', json={
        'episode': {'video_id': 'episode175'}, 'restaurants': [{'name_hebrew': 'Ambiguous name', 'verdict': 'add_to_page'}]})
    assert response.status_code == 422
    assert response.json()['detail']['message'] == 'Publication review required'
    assert db.mock_calls == []


def test_backend_save_blocks_before_episode_write(monkeypatch, tmp_path, good, segments):
    from backend_service import BackendService
    monkeypatch.setenv('DATABASE_DIR', str(tmp_path))
    db = Mock(); db.db_path = str(tmp_path / "where2eat.db"); service = BackendService(db=db)
    monkeypatch.setattr(service, 'fetch_transcript', lambda *a: {'success': True, 'segments': segments})
    restaurant = {'name_hebrew': 'Jai Lek'}
    monkeypatch.setattr(service, 'analyze_transcript', lambda *a: {'success': True, 'restaurants': [restaurant]})
    monkeypatch.setattr(service, 'filter_restaurant_hallucinations', lambda *a: {
        'accepted': [restaurant], 'accepted_count': 1, 'rejected_count': 0, 'review_count': 0,
        'rejected': [], 'all_with_metadata': [restaurant]})
    result = service.process_video('https://www.youtube.com/watch?v=GNiUaUqPY_Q')
    assert result['needs_review'] is True and result['success'] is False
    assert db.mock_calls == []
    import json
    draft = json.loads(Path(result['review_draft']).read_text())
    assert draft['restaurants'] == [restaurant] and draft['transcript_segments'] == segments


def test_review_draft_rejects_path_traversal(tmp_path):
    from publication_quality import save_review_draft
    with pytest.raises(ValueError):save_review_draft('../x', [], [], {}, tmp_path)


def test_review_failure_does_not_retry_paid_analysis():
    from video_queue_manager import VideoQueueManager
    assert 'Publication review required' in VideoQueueManager.PERMANENT_FAILURE_PATTERNS


def test_malformed_import_rejected_without_traceback(segments):
    assert publication_issues(None, segments, 'episode175')[0]['issues'] == ['restaurants_must_be_array']
    assert publication_issues(['not an object'], segments, 'episode175')[0]['issues'] == ['restaurant_must_be_object']
    assert publication_issues([{'timestamp': '49:18', 'google_places': 'bad'}], segments, 'episode175')


def test_review_draft_preserves_prior_versions(tmp_path):
    from publication_quality import save_review_draft
    first = save_review_draft('episode175', [], [], {'passed': False}, tmp_path)
    second = save_review_draft('episode175', [], [], {'passed': True}, tmp_path)
    assert first != second and Path(first).exists() and Path(second).exists()


def test_queue_review_hold_is_not_requeued(tmp_path):
    from database import Database
    from video_queue_manager import VideoQueueManager
    db = Database(str(tmp_path / 'test.db')); queue = VideoQueueManager(db)
    item = queue.enqueue(video_id='review001', video_url='https://www.youtube.com/watch?v=review001')
    queue.mark_failed(item['id'], 'Publication review required; no episode or restaurant data saved')
    with db.get_connection() as connection:
        row = dict(connection.execute('SELECT * FROM video_queue WHERE id=?', (item['id'],)).fetchone())
    assert row['status'] == 'skipped' and 'Publication review required' in row['error_message']


def test_reviewed_backend_can_save(tmp_path, monkeypatch, good, segments):
    from backend_service import BackendService
    from database import Database
    db = Database(str(tmp_path / 'test.db')); service = BackendService(db=db)
    good['publication_review']['discussion']['video_id'] = 'GNiUaUqPY_Q'
    good['mention_timestamp_seconds'] = 2958
    monkeypatch.setattr(service, 'fetch_transcript', lambda *a: {'success': True, 'segments': segments})
    monkeypatch.setattr(service, 'analyze_transcript', lambda *a: {'success': True, 'restaurants': [good]})
    monkeypatch.setattr(service, 'filter_restaurant_hallucinations', lambda *a: {
        'accepted': [good], 'accepted_count': 1, 'rejected_count': 0, 'review_count': 0,
        'rejected': [], 'all_with_metadata': [good]})
    monkeypatch.delenv('DATABASE_URL', raising=False)
    result = service.process_video('https://www.youtube.com/watch?v=GNiUaUqPY_Q')
    assert result['success'] is True
    with db.get_connection() as connection:
        assert connection.execute('SELECT COUNT(*) FROM episodes').fetchone()[0] == 1
        assert connection.execute('SELECT mention_timestamp FROM restaurants').fetchone()[0] == 2958


def test_model_cannot_self_certify_publication_review(good):
    from backend_service import BackendService
    db = Mock(); service = BackendService(db=db); analyzer = Mock()
    analyzer.analyze_transcript.return_value = {'restaurants': [good]}
    service._analyzer = analyzer
    result = service.analyze_transcript({'success': True, 'video_id': 'episode175'})
    assert result['success'] is True
    assert 'publication_review' not in result['restaurants'][0]


def test_reviewed_seed_saves_evidence_and_discussion(monkeypatch, tmp_path, good, segments):
    from database import Database
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routers import episodes
    from routers.admin import get_current_user
    db = Database(str(tmp_path / 'test.db'))
    monkeypatch.setattr(episodes, '_get_sqlite_db', lambda: db)
    monkeypatch.setattr(episodes, '_get_data_directory', lambda: tmp_path)
    app = FastAPI(); app.include_router(episodes.router)
    app.dependency_overrides[get_current_user] = lambda: {'id': 'reviewing-admin', 'role': 'admin'}
    response = TestClient(app).post('/api/episodes/seed', json={
        'episode': {'video_id': 'episode175'}, 'restaurants': [good], 'transcript_segments': segments})
    assert response.status_code == 200, response.text
    with db.get_connection() as connection:
        assert connection.execute('SELECT timestamp_seconds FROM episode_mentions').fetchone()[0] == 2958
    import json
    evidence = json.loads(next((tmp_path / 'publication_reviews').glob('*.json')).read_text())
    assert evidence['quality_report']['review_actor'] == 'reviewing-admin'
    assert evidence['restaurants'][0]['publication_review'] == good['publication_review']

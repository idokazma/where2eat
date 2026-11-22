"""CLI that runs the stored-photo copy in batches against the live API."""
import importlib.util
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    'store_place_photos', Path(__file__).resolve().parents[1] / 'scripts' / 'store_place_photos.py')
script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(script)


class Resp:
    def __init__(self, payload, status=200):
        self.payload, self.status_code = payload, status

    def json(self):
        return self.payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


def test_runs_batches_until_nothing_remains(monkeypatch):
    calls = []
    replies = iter([
        Resp({'processed': 20, 'next_after': 31, 'restaurants_done': 20, 'photos_stored': 95, 'failed': [],
              'budget_stopped': False, 'remaining': 5}),
        Resp({'processed': 5, 'next_after': 40, 'restaurants_done': 5, 'photos_stored': 25, 'failed': [],
              'budget_stopped': False, 'remaining': 0}),
        Resp({'processed': 0, 'next_after': 40, 'restaurants_done': 0, 'photos_stored': 0, 'failed': [],
              'budget_stopped': False, 'remaining': 0}),
    ])

    def post(url, **kw):
        calls.append((url, kw))
        return next(replies)

    monkeypatch.setattr(script.requests, 'post', post)
    totals = script.run('https://api.example', 'k' * 40, batch=20)
    assert totals == {'restaurants_done': 25, 'photos_stored': 120, 'failed': 0, 'budget_stopped': False, 'remaining': 0}
    url, kw = calls[0]
    assert url == 'https://api.example/api/admin/place-photos/store'
    assert [c[1]['params']['after'] for c in calls] == [0, 31, 40]
    assert kw['headers']['Authorization'] == 'Bearer ' + 'k' * 40 and kw['headers']['x-api-key'] == 'k' * 40


def test_stops_when_the_budget_stops(monkeypatch):
    replies = iter([Resp({'processed': 1, 'next_after': 1, 'restaurants_done': 0, 'photos_stored': 0, 'failed': [],
                          'budget_stopped': True, 'remaining': 50})])
    monkeypatch.setattr(script.requests, 'post', lambda url, **kw: next(replies))
    assert script.run('https://api.example', 'k' * 40)['budget_stopped'] is True


def test_passes_failures_once_instead_of_retrying_them(monkeypatch):
    replies = iter([
        Resp({'processed': 3, 'next_after': 9, 'restaurants_done': 0, 'photos_stored': 0,
              'failed': [{'restaurant_id': 'x'}] * 3, 'budget_stopped': False, 'remaining': 3}),
        Resp({'processed': 0, 'next_after': 9, 'restaurants_done': 0, 'photos_stored': 0, 'failed': [],
              'budget_stopped': False, 'remaining': 3}),
    ])
    monkeypatch.setattr(script.requests, 'post', lambda url, **kw: next(replies))
    assert script.run('https://api.example', 'k' * 40) == {
        'restaurants_done': 0, 'photos_stored': 0, 'failed': 3, 'budget_stopped': False, 'remaining': 3}


def test_requires_the_key(monkeypatch):
    monkeypatch.delenv('API_SECRET_KEY', raising=False)
    with pytest.raises(SystemExit):
        script.main([])

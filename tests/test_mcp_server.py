"""The MCP endpoint, exercised over real MCP JSON-RPC on HTTP."""
import contextlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import mcp_server
from database import Database
from mcp_catalog import Catalog

HEADERS = {'Accept': 'application/json, text/event-stream', 'Content-Type': 'application/json',
           'Host': 'where2eat-production.up.railway.app'}


@pytest.fixture
def catalog(tmp_path):
    db = Database(str(tmp_path / 't.db'))
    with db.get_connection() as c:
        c.execute("INSERT INTO episodes (id, video_id, video_url, channel_name, title, published_at) "
                  "VALUES ('e1','vid00000001','u','מדברים מהבטן','Ep','2026-11-15')")
        c.execute("INSERT INTO restaurants (id, name_hebrew, city, cuisine_type, is_hidden) "
                  "VALUES ('r1','אבו עומר','טירה','חומוסייה',0)")
        c.execute("INSERT INTO episode_mentions (id, episode_id, video_id, restaurant_id, name_hebrew, verdict, "
                  "mention_level, timestamp_seconds, host_quotes) VALUES "
                  "('m1','e1','vid00000001','r1','x','add_to_page','נטעם',512,'[\"פשוט טעים\"]')")
    return Catalog(db)


def _app(monkeypatch, catalog, enabled=True, per_ip=1000):
    if enabled:
        monkeypatch.setenv('MCP_ENABLED', 'true')
    else:
        monkeypatch.delenv('MCP_ENABLED', raising=False)
    monkeypatch.setenv('MCP_RATE_LIMIT_PER_IP', str(per_ip))
    holder = {}

    @contextlib.asynccontextmanager
    async def lifespan(app):
        async with mcp_server.lifespan(holder.get('server')):
            yield

    app = FastAPI(lifespan=lifespan)

    @app.get('/api/ping')
    def ping():
        return {'ok': True}

    holder['server'] = mcp_server.mount(app, get_catalog=lambda: catalog)
    return app


def _rpc(client, method, params=None, id_=1):
    body = {'jsonrpc': '2.0', 'id': id_, 'method': method}
    if params is not None:
        body['params'] = params
    return client.post('/mcp', headers=HEADERS, content=json.dumps(body))


def _init(client):
    return _rpc(client, 'initialize', {'protocolVersion': '2025-06-18', 'capabilities': {},
                                       'clientInfo': {'name': 'test', 'version': '1'}})


def test_mount_disabled_by_default_serves_nothing(monkeypatch, catalog):
    app = _app(monkeypatch, catalog, enabled=False)
    with TestClient(app) as client:
        assert _init(client).status_code == 404
        assert client.get('/api/ping').json() == {'ok': True}


def test_initialize_accepts_public_host_header(monkeypatch, catalog):
    with TestClient(_app(monkeypatch, catalog)) as client:
        r = _init(client)
        assert r.status_code == 200, r.text
        assert r.json()['result']['serverInfo']['name'] == 'where2eat'
        assert client.get('/api/ping').json() == {'ok': True}  # regular API routes unaffected


def test_tools_list_exposes_exactly_four_read_only_tools(monkeypatch, catalog):
    with TestClient(_app(monkeypatch, catalog)) as client:
        tools = _rpc(client, 'tools/list', {}).json()['result']['tools']
        assert sorted(t['name'] for t in tools) == ['get_restaurant', 'list_creators', 'search_restaurants', 'whats_new']
        for t in tools:
            assert t['annotations']['readOnlyHint'] is True
            assert t['annotations']['destructiveHint'] is False
            assert len(t['description']) > 40


def test_search_tool_returns_structured_evidence(monkeypatch, catalog):
    with TestClient(_app(monkeypatch, catalog)) as client:
        r = _rpc(client, 'tools/call', {'name': 'search_restaurants', 'arguments': {'city': 'Tira'}}).json()['result']
        assert r['isError'] is False
        result = r['structuredContent']['results'][0]
        assert result['name'] == 'אבו עומר'
        assert result['evidence'][0]['moment_url'].endswith('&t=512s')


def test_invalid_date_returns_tool_error_not_crash(monkeypatch, catalog):
    with TestClient(_app(monkeypatch, catalog)) as client:
        r = _rpc(client, 'tools/call', {'name': 'search_restaurants',
                                         'arguments': {'published_after': 'last week'}}).json()['result']
        assert r['isError'] is True


def test_rate_limit_per_client_returns_429(monkeypatch, catalog):
    with TestClient(_app(monkeypatch, catalog, per_ip=3)) as client:
        codes = [_rpc(client, 'tools/list', {}, id_=i).status_code for i in range(5)]
        assert codes[:3] == [200, 200, 200] and codes[3:] == [429, 429]


def test_origin_gate_exempts_mcp_path():
    import ast
    tree = ast.parse((Path(__file__).resolve().parents[1] / 'api' / 'main.py').read_text())
    exempt = next(n for n in ast.walk(tree) if isinstance(n, ast.Assign)
                  and any(getattr(t, 'id', '') == 'EXEMPT_PREFIXES' for t in n.targets))
    assert '/mcp' in ast.literal_eval(exempt.value)


def test_rate_limit_ignores_spoofed_forwarded_for_prefix(monkeypatch, catalog):
    with TestClient(_app(monkeypatch, catalog, per_ip=2)) as client:
        codes = []
        for i in range(4):
            h = {**HEADERS, 'X-Forwarded-For': f'10.0.0.{i}, 203.0.113.7'}  # first hop is client-controlled
            codes.append(client.post('/mcp', headers=h, content=json.dumps(
                {'jsonrpc': '2.0', 'id': i, 'method': 'tools/list', 'params': {}})).status_code)
        assert codes == [200, 200, 429, 429]

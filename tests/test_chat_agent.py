"""
Tests for the chat agent endpoint and services.

Covers: Ontopo service, Tabit service, chat router tool dispatch and agentic loop.
"""

import json
import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "api"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_httpx_client(post=None, get=None, delete=None):
    """Return a patched httpx.AsyncClient context manager."""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    if post is not None:
        mock_client.post = AsyncMock(return_value=post)
    if get is not None:
        mock_client.get = AsyncMock(return_value=get)
    if delete is not None:
        mock_client.delete = AsyncMock(return_value=delete)
    return mock_client


def _json_resp(data):
    resp = MagicMock()
    resp.json.return_value = data
    resp.raise_for_status = MagicMock()
    return resp


def _import_chat():
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location(
        "chat", pathlib.Path(PROJECT_ROOT) / "api" / "routers" / "chat.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------------------
# Ontopo service
# ---------------------------------------------------------------------------

class TestOntopoService:
    @pytest.fixture(autouse=True)
    def reset_cache(self):
        from services import ontopo
        ontopo._token_cache["token"] = None
        ontopo._token_cache["expires_at"] = 0

    @pytest.mark.asyncio
    async def test_get_token_fetches_and_caches(self):
        from services import ontopo
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=_json_resp({"jwt_token": "tok-123"}))

        token = await ontopo._get_token(mock_client)
        assert token == "tok-123"
        assert ontopo._token_cache["token"] == "tok-123"

        # Second call — must NOT hit API again
        await ontopo._get_token(mock_client)
        mock_client.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_availability_returns_available(self):
        from services import ontopo
        ontopo._token_cache.update({"token": "t", "expires_at": 9_999_999_999})

        api_resp = {
            "areas": [{"name": "חוץ", "options": [
                {"method": "seat", "time": "2000"},
                {"method": "seat", "time": "2030"},
                {"method": "disabled", "time": "1930"},
            ]}],
            "recommended": [{"method": "seat", "time": "2000", "id": "outdoor"}],
            "dates": [],
        }
        with patch("httpx.AsyncClient", return_value=_mock_httpx_client(post=_json_resp(api_resp))):
            result = await ontopo.check_availability("58551219", "20260421", "2000", 2)

        assert result["available"] is True
        assert len(result["slots"]) == 2
        assert result["slots"][0]["time"] == "20:00"

    @pytest.mark.asyncio
    async def test_check_availability_returns_not_available(self):
        from services import ontopo
        ontopo._token_cache.update({"token": "t", "expires_at": 9_999_999_999})

        api_resp = {
            "areas": [{"name": "פנים", "options": [
                {"method": "disabled", "time": "2000"},
                {"method": "standby", "time": "2030"},
            ]}],
            "recommended": [],
            "dates": ["202604221900"],
        }
        with patch("httpx.AsyncClient", return_value=_mock_httpx_client(post=_json_resp(api_resp))):
            result = await ontopo.check_availability("58551219", "20260421", "2000", 2)

        assert result["available"] is False
        assert result["slots"] == []
        assert len(result["alternative_dates"]) == 1

    @pytest.mark.asyncio
    async def test_check_availability_handles_api_error(self):
        from services import ontopo
        ontopo._token_cache.update({"token": "t", "expires_at": 9_999_999_999})

        err_client = _mock_httpx_client()
        err_client.post = AsyncMock(side_effect=Exception("timeout"))
        with patch("httpx.AsyncClient", return_value=err_client):
            result = await ontopo.check_availability("999", "20260421", "2000", 2)

        assert result["available"] is False
        assert "error" in result


# ---------------------------------------------------------------------------
# Tabit service
# ---------------------------------------------------------------------------

class TestTabitService:
    @pytest.mark.asyncio
    async def test_check_availability_returns_true(self):
        from services import tabit
        resp = _json_resp({"id": "tmp-res-abc123", "alternative_results": []})
        with patch("httpx.AsyncClient", return_value=_mock_httpx_client(post=resp, delete=MagicMock())):
            result = await tabit.check_availability("org-123", "2026-04-21", "20:00", 2)

        assert result["available"] is True
        assert result["slots"][0]["time"] == "20:00"

    @pytest.mark.asyncio
    async def test_check_availability_returns_false(self):
        from services import tabit
        resp = _json_resp({"alternative_results": [{"time": "20:30"}, {"time": "21:00"}]})
        with patch("httpx.AsyncClient", return_value=_mock_httpx_client(post=resp)):
            result = await tabit.check_availability("org-123", "2026-04-21", "20:00", 2)

        assert result["available"] is False
        assert len(result["alternative_slots"]) == 2

    @pytest.mark.asyncio
    async def test_check_availability_handles_exception(self):
        from services import tabit
        err_client = _mock_httpx_client()
        err_client.post = AsyncMock(side_effect=Exception("connection refused"))
        with patch("httpx.AsyncClient", return_value=err_client):
            result = await tabit.check_availability("org-456", "2026-04-21", "20:00", 2)

        assert result["available"] is False
        assert "error" in result


# ---------------------------------------------------------------------------
# Chat router tool handlers
# ---------------------------------------------------------------------------

class TestChatToolHandlers:
    @pytest.fixture(autouse=True)
    def chat(self):
        self.chat = _import_chat()

    @pytest.mark.asyncio
    async def test_search_restaurants_returns_json(self):
        data = {"restaurants": [{"id": "1", "name_hebrew": "רומנו", "city": "תל אביב",
                                  "cuisine_type": "איטלקי", "google_rating": 4.5,
                                  "description": "מסעדה", "ontopo_slug": "58551219",
                                  "tabit_org_id": None, "address": "הרצל 1"}]}
        with patch("httpx.AsyncClient", return_value=_mock_httpx_client(get=_json_resp(data))):
            result = await self.chat._tool_search_restaurants(city="תל אביב", cuisine="איטלקי")

        parsed = json.loads(result)
        assert parsed[0]["name_hebrew"] == "רומנו"
        assert parsed[0]["ontopo_slug"] == "58551219"

    @pytest.mark.asyncio
    async def test_search_restaurants_handles_error(self):
        err_client = _mock_httpx_client()
        err_client.get = AsyncMock(side_effect=Exception("API down"))
        with patch("httpx.AsyncClient", return_value=err_client):
            result = await self.chat._tool_search_restaurants(city="תל אביב")

        assert "error" in json.loads(result)

    @pytest.mark.asyncio
    async def test_tool_check_ontopo_formats_date_and_time(self):
        with patch("services.ontopo.check_availability") as mock_check:
            mock_check.return_value = {"available": True, "slots": [{"time": "20:00", "area": "חוץ"}],
                                        "recommended": [], "alternative_dates": [],
                                        "booking_url": "https://ontopo.com/he/il/page/123"}
            result = await self.chat._tool_check_ontopo(
                ontopo_slug="123", date="2026-04-21", time="20:00", party_size=2
            )

        mock_check.assert_called_once_with(
            numeric_slug="123", date="20260421", time_str="2000", party_size=2
        )
        assert json.loads(result)["available"] is True

    @pytest.mark.asyncio
    async def test_tool_check_tabit_passes_correct_params(self):
        with patch("services.tabit.check_availability") as mock_check:
            mock_check.return_value = {"available": False, "slots": [], "alternative_slots": [{"time": "21:00"}]}
            result = await self.chat._tool_check_tabit(
                tabit_org_id="org-abc", date="2026-04-21", time="20:00", party_size=4
            )

        mock_check.assert_called_once_with(
            org_id="org-abc", date="2026-04-21", time_str="20:00", party_size=4
        )
        assert json.loads(result)["available"] is False


# ---------------------------------------------------------------------------
# Chat endpoint integration
# ---------------------------------------------------------------------------

def _make_app():
    from fastapi import FastAPI
    chat_module = _import_chat()
    app = FastAPI()
    app.include_router(chat_module.router)
    return app, chat_module


def _text_response(text):
    block = MagicMock()
    block.type = "text"
    block.text = text
    resp = MagicMock()
    resp.stop_reason = "end_turn"
    resp.content = [block]
    return resp


def _tool_response(name, tool_id, input_data):
    block = MagicMock()
    block.type = "tool_use"
    block.name = name
    block.id = tool_id
    block.input = input_data
    resp = MagicMock()
    resp.stop_reason = "tool_use"
    resp.content = [block]
    return resp


class TestChatEndpoint:
    @pytest.mark.asyncio
    async def test_endpoint_returns_reply_on_end_turn(self):
        from fastapi.testclient import TestClient
        app, _ = _make_app()

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test"}):
            with patch("anthropic.AsyncAnthropic") as mock_cls:
                mock_cls.return_value.messages.create = AsyncMock(
                    return_value=_text_response("הנה שלוש מסעדות מומלצות...")
                )
                with TestClient(app) as client:
                    resp = client.post("/api/chat/message", json={
                        "message": "מחפש מסעדה לדייט בתל אביב",
                        "session_id": "test-session",
                        "history": [],
                    })

        assert resp.status_code == 200
        assert resp.json()["reply"] == "הנה שלוש מסעדות מומלצות..."
        assert resp.json()["session_id"] == "test-session"

    @pytest.mark.asyncio
    async def test_endpoint_executes_tool_and_returns_final_reply(self):
        from fastapi.testclient import TestClient
        app, chat_module = _make_app()

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test"}):
            with patch("anthropic.AsyncAnthropic") as mock_cls:
                mock_cls.return_value.messages.create = AsyncMock(side_effect=[
                    _tool_response("search_restaurants", "tool-1", {"city": "תל אביב", "cuisine": "איטלקי"}),
                    _text_response("מצאתי מסעדות מעולות!"),
                ])
                mock_result = json.dumps([{"name_hebrew": "טסטו", "city": "תל אביב"}])
                with patch.dict(chat_module.TOOL_HANDLERS,
                                {"search_restaurants": AsyncMock(return_value=mock_result)}):
                    with TestClient(app) as client:
                        resp = client.post("/api/chat/message",
                                           json={"message": "מסעדה איטלקית בתל אביב", "history": []})

        assert resp.status_code == 200
        assert resp.json()["reply"] == "מצאתי מסעדות מעולות!"
        assert mock_cls.return_value.messages.create.call_count == 2

    def test_endpoint_returns_500_without_api_key(self):
        from fastapi.testclient import TestClient
        app, _ = _make_app()

        env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with TestClient(app) as client:
                resp = client.post("/api/chat/message", json={"message": "שלום", "history": []})

        assert resp.status_code == 500
        assert "ANTHROPIC_API_KEY" in resp.json()["detail"]

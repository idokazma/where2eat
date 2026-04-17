"""
Tests for the chat agent endpoint and services.

Covers:
- Ontopo service: token caching, availability parsing
- Tabit service: availability check, cleanup
- Chat router: tool dispatch, agentic loop, fallback
"""

import json
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

# Add api/ to path so we can import the modules directly
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "api"))


# ---------------------------------------------------------------------------
# Ontopo service tests
# ---------------------------------------------------------------------------

class TestOntopoService:
    """Unit tests for api/services/ontopo.py"""

    @pytest.mark.asyncio
    async def test_get_token_fetches_and_caches(self):
        """Token is fetched once and cached for subsequent calls."""
        from services import ontopo
        # Reset cache
        ontopo._token_cache["token"] = None
        ontopo._token_cache["expires_at"] = 0

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"jwt_token": "test-jwt-123"}
        mock_resp.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_resp)

        token = await ontopo._get_token(mock_client)
        assert token == "test-jwt-123"
        assert ontopo._token_cache["token"] == "test-jwt-123"
        mock_client.post.assert_called_once()

        # Second call — should NOT call API again (cached)
        token2 = await ontopo._get_token(mock_client)
        assert token2 == "test-jwt-123"
        mock_client.post.assert_called_once()  # still once

    @pytest.mark.asyncio
    async def test_check_availability_returns_available_when_seat_slots(self):
        """Returns available=True when seat slots exist."""
        from services import ontopo
        ontopo._token_cache["token"] = "cached-token"
        ontopo._token_cache["expires_at"] = 9999999999

        api_response = {
            "areas": [
                {
                    "name": "חוץ",
                    "options": [
                        {"method": "seat", "time": "2000"},
                        {"method": "seat", "time": "2030"},
                        {"method": "disabled", "time": "1930"},
                    ],
                }
            ],
            "recommended": [{"method": "seat", "time": "2000", "id": "outdoor"}],
            "dates": [],
        }

        mock_resp = MagicMock()
        mock_resp.json.return_value = api_response

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            result = await ontopo.check_availability("58551219", "20260421", "2000", 2)

        assert result["available"] is True
        assert len(result["slots"]) == 2
        assert result["slots"][0]["time"] == "20:00"
        assert result["booking_url"] == "https://ontopo.com/he/il/page/58551219?date=20260421&time=2000&size=2"

    @pytest.mark.asyncio
    async def test_check_availability_returns_not_available_when_no_seat_slots(self):
        """Returns available=False when all slots are disabled/standby."""
        from services import ontopo
        ontopo._token_cache["token"] = "cached-token"
        ontopo._token_cache["expires_at"] = 9999999999

        api_response = {
            "areas": [
                {
                    "name": "פנים",
                    "options": [
                        {"method": "disabled", "time": "2000"},
                        {"method": "standby", "time": "2030"},
                    ],
                }
            ],
            "recommended": [],
            "dates": ["202604221900"],
        }

        mock_resp = MagicMock()
        mock_resp.json.return_value = api_response

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            result = await ontopo.check_availability("58551219", "20260421", "2000", 2)

        assert result["available"] is False
        assert result["slots"] == []
        assert len(result["alternative_dates"]) == 1

    @pytest.mark.asyncio
    async def test_check_availability_handles_api_error(self):
        """Returns error dict on API failure."""
        from services import ontopo
        ontopo._token_cache["token"] = "cached-token"
        ontopo._token_cache["expires_at"] = 9999999999

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=Exception("timeout"))
            mock_cls.return_value = mock_client

            result = await ontopo.check_availability("999", "20260421", "2000", 2)

        assert result["available"] is False
        assert "error" in result


# ---------------------------------------------------------------------------
# Tabit service tests
# ---------------------------------------------------------------------------

class TestTabitService:
    """Unit tests for api/services/tabit.py"""

    @pytest.mark.asyncio
    async def test_check_availability_returns_true_when_reservation_created(self):
        """Returns available=True when temp reservation ID returned."""
        from services import tabit

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": "tmp-res-abc123", "alternative_results": []}

        mock_del_resp = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.delete = AsyncMock(return_value=mock_del_resp)
            mock_cls.return_value = mock_client

            result = await tabit.check_availability("org-123", "2026-04-21", "20:00", 2)

        assert result["available"] is True
        assert len(result["slots"]) == 1
        assert result["slots"][0]["time"] == "20:00"

    @pytest.mark.asyncio
    async def test_check_availability_returns_false_when_no_reservation_id(self):
        """Returns available=False when no reservation ID (slot taken)."""
        from services import tabit

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "alternative_results": [{"time": "20:30"}, {"time": "21:00"}]
        }

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            result = await tabit.check_availability("org-123", "2026-04-21", "20:00", 2)

        assert result["available"] is False
        assert result["slots"] == []
        assert len(result["alternative_slots"]) == 2

    @pytest.mark.asyncio
    async def test_check_availability_handles_exception(self):
        """Returns error dict on network failure."""
        from services import tabit

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=Exception("connection refused"))
            mock_cls.return_value = mock_client

            result = await tabit.check_availability("org-456", "2026-04-21", "20:00", 2)

        assert result["available"] is False
        assert "error" in result


# ---------------------------------------------------------------------------
# Chat router tool handler tests
# ---------------------------------------------------------------------------

def _import_chat():
    """Import chat module directly, bypassing routers/__init__.py to avoid jose dep."""
    import importlib.util, pathlib
    spec = importlib.util.spec_from_file_location(
        "chat",
        pathlib.Path(PROJECT_ROOT) / "api" / "routers" / "chat.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestChatToolHandlers:
    """Unit tests for tool handler functions in routers/chat.py"""

    @pytest.mark.asyncio
    async def test_search_restaurants_returns_json(self):
        """_tool_search_restaurants returns valid JSON with restaurant list."""
        chat = _import_chat()
        _tool_search_restaurants = chat._tool_search_restaurants

        mock_data = {
            "restaurants": [
                {
                    "id": "1",
                    "name_hebrew": "רומנו",
                    "name_english": "Romano",
                    "city": "תל אביב",
                    "cuisine_type": "איטלקי",
                    "google_rating": 4.5,
                    "description": "מסעדה איטלקית",
                    "ontopo_slug": "58551219",
                    "tabit_org_id": None,
                    "address": "רחוב הרצל 1",
                }
            ]
        }

        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_data

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_cls.return_value = mock_client

            result = await _tool_search_restaurants(city="תל אביב", cuisine="איטלקי")

        data = json.loads(result)
        assert isinstance(data, list)
        assert data[0]["name_hebrew"] == "רומנו"
        assert data[0]["ontopo_slug"] == "58551219"

    @pytest.mark.asyncio
    async def test_search_restaurants_handles_error(self):
        """_tool_search_restaurants returns error JSON on failure."""
        _tool_search_restaurants = _import_chat()._tool_search_restaurants

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=Exception("API down"))
            mock_cls.return_value = mock_client

            result = await _tool_search_restaurants(city="תל אביב")

        data = json.loads(result)
        assert "error" in data

    @pytest.mark.asyncio
    async def test_tool_check_ontopo_formats_date_and_time(self):
        """_tool_check_ontopo strips dashes and colons before calling service."""
        _tool_check_ontopo = _import_chat()._tool_check_ontopo

        with patch("services.ontopo.check_availability") as mock_check:
            mock_check.return_value = {
                "available": True,
                "slots": [{"time": "20:00", "area": "חוץ"}],
                "recommended": [],
                "alternative_dates": [],
                "booking_url": "https://ontopo.com/he/il/page/123",
            }

            result = await _tool_check_ontopo(
                ontopo_slug="123",
                date="2026-04-21",
                time="20:00",
                party_size=2,
            )

        # Check service was called with stripped formats
        mock_check.assert_called_once_with(
            numeric_slug="123",
            date="20260421",
            time_str="2000",
            party_size=2,
        )
        data = json.loads(result)
        assert data["available"] is True

    @pytest.mark.asyncio
    async def test_tool_check_tabit_passes_correct_params(self):
        """_tool_check_tabit passes org_id and datetime correctly."""
        _tool_check_tabit = _import_chat()._tool_check_tabit

        with patch("services.tabit.check_availability") as mock_check:
            mock_check.return_value = {
                "available": False,
                "slots": [],
                "alternative_slots": [{"time": "21:00"}],
            }

            result = await _tool_check_tabit(
                tabit_org_id="org-abc",
                date="2026-04-21",
                time="20:00",
                party_size=4,
            )

        mock_check.assert_called_once_with(
            org_id="org-abc",
            date="2026-04-21",
            time_str="20:00",
            party_size=4,
        )
        data = json.loads(result)
        assert data["available"] is False
        assert len(data["alternative_slots"]) == 1


# ---------------------------------------------------------------------------
# Chat endpoint integration tests
# ---------------------------------------------------------------------------

class TestChatEndpoint:
    """Integration tests for POST /api/chat/message"""

    @pytest.mark.asyncio
    async def test_endpoint_returns_reply_on_end_turn(self):
        """Endpoint returns reply text when Claude stops with end_turn."""
        from fastapi.testclient import TestClient
        from fastapi import FastAPI
        chat_module = _import_chat()

        # Minimal FastAPI app with just the chat router
        test_app = FastAPI()
        test_app.include_router(chat_module.router)

        # Build a mock Claude response with end_turn
        mock_content_block = MagicMock()
        mock_content_block.type = "text"
        mock_content_block.text = "הנה שלוש מסעדות מומלצות..."

        mock_response = MagicMock()
        mock_response.stop_reason = "end_turn"
        mock_response.content = [mock_content_block]

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}):
            with patch("anthropic.AsyncAnthropic") as mock_anthropic_cls:
                mock_client = AsyncMock()
                mock_client.messages.create = AsyncMock(return_value=mock_response)
                mock_anthropic_cls.return_value = mock_client

                with TestClient(test_app) as client:
                    resp = client.post(
                        "/api/chat/message",
                        json={
                            "message": "מחפש מסעדה לדייט בתל אביב",
                            "session_id": "test-session",
                            "history": [],
                        },
                    )

        assert resp.status_code == 200
        data = resp.json()
        assert data["reply"] == "הנה שלוש מסעדות מומלצות..."
        assert data["session_id"] == "test-session"

    @pytest.mark.asyncio
    async def test_endpoint_executes_tool_and_returns_final_reply(self):
        """Endpoint calls tool handler and loops back to get final reply."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        chat_module = _import_chat()

        test_app = FastAPI()
        test_app.include_router(chat_module.router)

        # First response: tool_use
        tool_block = MagicMock()
        tool_block.type = "tool_use"
        tool_block.name = "search_restaurants"
        tool_block.id = "tool-1"
        tool_block.input = {"city": "תל אביב", "cuisine": "איטלקי"}

        response_turn1 = MagicMock()
        response_turn1.stop_reason = "tool_use"
        response_turn1.content = [tool_block]

        # Second response: end_turn
        text_block = MagicMock()
        text_block.type = "text"
        text_block.text = "מצאתי מסעדות מעולות!"

        response_turn2 = MagicMock()
        response_turn2.stop_reason = "end_turn"
        response_turn2.content = [text_block]

        # Mock tool handler
        mock_tool_result = json.dumps([{"name_hebrew": "טסטו", "city": "תל אביב"}])

        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}):
            with patch("anthropic.AsyncAnthropic") as mock_anthropic_cls:
                mock_client = AsyncMock()
                mock_client.messages.create = AsyncMock(
                    side_effect=[response_turn1, response_turn2]
                )
                mock_anthropic_cls.return_value = mock_client

                with patch.dict(
                    chat_module.TOOL_HANDLERS,
                    {"search_restaurants": AsyncMock(return_value=mock_tool_result)},
                ):
                    with TestClient(test_app) as client:
                        resp = client.post(
                            "/api/chat/message",
                            json={"message": "מסעדה איטלקית בתל אביב", "history": []},
                        )

        assert resp.status_code == 200
        assert resp.json()["reply"] == "מצאתי מסעדות מעולות!"
        assert mock_client.messages.create.call_count == 2

    def test_endpoint_returns_500_without_api_key(self):
        """Returns 500 when ANTHROPIC_API_KEY is missing."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        chat_module = _import_chat()

        test_app = FastAPI()
        test_app.include_router(chat_module.router)

        env_without_key = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        with patch.dict(os.environ, env_without_key, clear=True):
            with TestClient(test_app) as client:
                resp = client.post(
                    "/api/chat/message",
                    json={"message": "שלום", "history": []},
                )

        assert resp.status_code == 500
        assert "ANTHROPIC_API_KEY" in resp.json()["detail"]

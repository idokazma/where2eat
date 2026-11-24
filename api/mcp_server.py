"""where2eat MCP server for ChatGPT and Gemini (read-only).

Off unless MCP_ENABLED=true. When enabled it is served at /mcp on the same
FastAPI app, using the MCP streamable HTTP transport in stateless JSON mode.
It only reads published catalog data (see src/mcp_catalog.py): no writes, no
admin data, no language-model or paid lookups per call.
"""
import contextlib
import os
import threading
import time
from collections import deque
from typing import Any, Callable, Dict, Optional

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=False)

INSTRUCTIONS = (
    "where2eat answers 'where should I eat' with what Israeli food creators actually said, with evidence: "
    "the creator, the publication date, a short excerpt and a link to the exact moment in the video. "
    "Cities and cuisines are stored in Hebrew; English names of common ones also work. Call list_creators "
    "to see coverage and valid city and cuisine values. Credit the creator for every claim and include the "
    "moment link. To show a place, offer its story_url (photos, quotes and video moments on where2eat). "
    "Quote only excerpts with kind=verified_quote. If a tool returns no_coverage, tell the user "
    "where2eat has no creator coverage for that request instead of substituting other places."
)


def is_enabled() -> bool:
    return os.getenv('MCP_ENABLED', '').strip().lower() in {'1', 'true', 'yes'}


def build_server(get_catalog: Callable[[], Any]) -> FastMCP:
    server = FastMCP(
        'where2eat',
        instructions=INSTRUCTIONS,
        website_url='https://www.where2eat.rest',
        stateless_http=True,
        json_response=True,
        streamable_http_path='/mcp',
        # Public server reached by assistant platforms under the API's own hostname.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )

    @server.tool(annotations=READ_ONLY)
    def search_restaurants(city: Optional[str] = None, cuisine: Optional[str] = None,
                           dish: Optional[str] = None, query: Optional[str] = None,
                           creator: Optional[str] = None, published_after: Optional[str] = None,
                           tasted_only: bool = False, limit: int = 3) -> dict[str, Any]:
        """Find restaurants that Israeli food creators recommended or mentioned, with evidence.

        All filters are optional and combine. city: e.g. "תל אביב" or "Tel Aviv". cuisine: e.g. "פיצה" or
        "pizza". dish: a dish to look for in menus and mentions, e.g. "חומוס". query: words in the place's
        name. creator: creator or channel name. published_after: YYYY-MM-DD, only mentions published on or
        after this date. tasted_only: only places a creator actually tasted, not just mentioned.
        limit: 1-5 (default 3). Each result has evidence with creator, publication date, a labeled excerpt
        and moment_url. If nothing matches, the result has no_coverage with the reason.
        """
        return get_catalog().search_restaurants(city=city, cuisine=cuisine, dish=dish, query=query,
                                                creator=creator, published_after=published_after,
                                                tasted_only=tasted_only, limit=limit)

    @server.tool(annotations=READ_ONLY)
    def get_restaurant(restaurant_id: str) -> dict[str, Any]:
        """Get one restaurant (by the id from another where2eat result) with every creator mention.

        Use it for "is this place worth it?" questions. Returns all mentions across creators and episodes,
        newest first, each with publication date, tasted or mentioned, a labeled excerpt and moment_url.
        Show positive and negative opinions separately; never average them into a score.
        """
        return get_catalog().get_restaurant(restaurant_id)

    @server.tool(annotations=READ_ONLY)
    def whats_new(days: int = 30, city: Optional[str] = None, creator: Optional[str] = None,
                  limit: int = 10) -> dict[str, Any]:
        """List restaurants creators published about recently, newest first.

        days: 1-180 (default 30), counted by publication date of the video, not the visit date.
        city and creator: optional filters as in search_restaurants. limit: 1-20 (default 10).
        """
        return get_catalog().whats_new(days=days, city=city, creator=creator, limit=limit)

    @server.tool(annotations=READ_ONLY)
    def list_creators() -> dict[str, Any]:
        """List which creators where2eat covers, how many places each, and when each was last updated.

        Also returns the city and cuisine values available for filtering. Use it to explain coverage and
        to pick valid filter values. Creators are not affiliated with where2eat unless stated.
        """
        return get_catalog().list_creators()

    return server


class RateLimit:
    """Sliding one-minute window per client IP and globally. Returns 429 when exceeded."""

    def __init__(self, app, per_ip: int, global_limit: int, window: float = 60.0):
        self.app, self.per_ip, self.global_limit, self.window = app, per_ip, global_limit, window
        self._hits: Dict[str, deque] = {}
        self._all: deque = deque()
        self._lock = threading.Lock()

    @staticmethod
    def _client(scope) -> str:
        for name, value in scope.get('headers') or []:
            if name == b'x-forwarded-for':
                # Rightmost entry is added by our own edge proxy; earlier ones are client-controlled.
                return value.decode('latin-1').split(',')[-1].strip()
        client = scope.get('client')
        return client[0] if client else 'unknown'

    def _allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            for q in (self._all, self._hits.setdefault(key, deque())):
                while q and now - q[0] > self.window:
                    q.popleft()
            if len(self._all) >= self.global_limit or len(self._hits[key]) >= self.per_ip:
                return False
            self._all.append(now)
            self._hits[key].append(now)
            if len(self._hits) > 10000:  # bound memory under many distinct clients
                for k in [k for k, q in self._hits.items() if not q][:5000]:
                    del self._hits[k]
            return True

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope.get('path', '').startswith('/mcp') and not self._allow(self._client(scope)):
            await send({'type': 'http.response.start', 'status': 429,
                        'headers': [(b'content-type', b'application/json'), (b'retry-after', b'60')]})
            await send({'type': 'http.response.body', 'body': b'{"detail":"Too many requests"}'})
            return
        await self.app(scope, receive, send)


def _default_catalog_factory() -> Callable[[], Any]:
    state: Dict[str, Any] = {}
    lock = threading.Lock()

    def get():
        with lock:
            if 'catalog' not in state:
                from database import Database
                from mcp_catalog import Catalog
                from routers.restaurants import _get_data_directory
                path = _get_data_directory() / 'where2eat.db'
                if not path.exists():
                    raise RuntimeError('Catalog database is not available')
                state['catalog'] = Catalog(Database(str(path)))
            return state['catalog']
    return get


def mount(app, get_catalog: Optional[Callable[[], Any]] = None) -> Optional[FastMCP]:
    """Serve the MCP endpoint at /mcp if MCP_ENABLED is set. Returns the server, or None."""
    if not is_enabled():
        return None
    server = build_server(get_catalog or _default_catalog_factory())
    inner = server.streamable_http_app()
    limited = RateLimit(inner, per_ip=int(os.getenv('MCP_RATE_LIMIT_PER_IP', '60')),
                        global_limit=int(os.getenv('MCP_RATE_LIMIT_GLOBAL', '600')))
    from starlette.routing import Route

    # Exact /mcp route (no trailing-slash redirect). A class instance is treated as a raw ASGI app.
    app.router.routes.insert(0, Route('/mcp', endpoint=limited, methods=['GET', 'POST', 'DELETE']))
    return server


@contextlib.asynccontextmanager
async def lifespan(server: Optional[FastMCP]):
    """Run the MCP session manager for the app's lifetime (no-op when disabled)."""
    if server is None:
        yield
        return
    async with server.session_manager.run():
        yield

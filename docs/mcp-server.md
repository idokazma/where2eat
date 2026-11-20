# where2eat MCP server (ChatGPT and Gemini)

A read-only [MCP](https://modelcontextprotocol.io) server that lets ChatGPT and Gemini answer "where should I eat?" from where2eat's published catalog, with evidence: the creator, the publication date, a labeled excerpt and a link to the exact moment in the video. See `docs/PRD-fresh-creator-search.md` (v0.3) for the product plan.

## What it is

- **Endpoint:** `POST /mcp` on the existing FastAPI app (streamable HTTP transport, stateless, JSON responses). Production URL once enabled: `https://where2eat-production.up.railway.app/mcp`.
- **Off by default.** Nothing is served unless `MCP_ENABLED=true`; with it unset, `/mcp` returns 404.
- **Read-only.** It reads published data only (`src/mcp_catalog.py`): visible restaurants with a real name and city, and mentions that were not rejected. No writes, no admin data, no model or paid-API calls per request.
- **Code:** `api/mcp_server.py` (tools, rate limit, mounting), `src/mcp_catalog.py` (data and evidence), tests in `tests/test_mcp_server.py` and `tests/test_mcp_catalog.py`.

## Tools

| Tool | Use |
|------|-----|
| `search_restaurants` | Filter by city, cuisine, dish, name words, creator, `published_after` (YYYY-MM-DD), `tasted_only`; up to 5 results. |
| `get_restaurant` | One place with every creator mention, newest first. |
| `whats_new` | Places creators published about in the last N days (default 30). |
| `list_creators` | Covered creators, places per creator, last update, and valid city/cuisine values. |

Cities and cuisines are stored in Hebrew; common English names (Tel Aviv, pizza, hummus…) are mapped. A request with no match returns `no_coverage` with a reason instead of other places.

Every result carries `evidence[]` with `creator`, `published_at` (publication, not visit, date), `experience` (`tasted` / `mentioned` / `unknown`), `excerpt` (`kind` = `verified_quote` / `unverified_transcript` / `unverified_summary`, at most two sentences or 200 characters) and `moment_url`. Only `verified_quote` excerpts should be shown in quotation marks; the tool descriptions and an `answer_guidance` field tell the assistant this. Images are returned only as direct URLs, never through the paid `/api/photos` proxy.

## Settings

| Variable | Default | Meaning |
|----------|---------|---------|
| `MCP_ENABLED` | unset (off) | `true` to serve `/mcp`. |
| `MCP_RATE_LIMIT_PER_IP` | `60` | Requests per client per minute (client = last `X-Forwarded-For` entry). |
| `MCP_RATE_LIMIT_GLOBAL` | `600` | Requests per minute for the whole endpoint. |

`/mcp` is exempt from the Origin check, because assistant platforms call it server-to-server without a browser Origin header. Nothing else changes for the rest of the API.

## Testing it privately (Stage 1)

1. Set `MCP_ENABLED=true` on Railway (or locally: `cd api && PYTHONPATH=../src MCP_ENABLED=true uvicorn main:app --port 8080`).
2. **ChatGPT:** in developer mode, add a custom connector/app pointing at `https://…/mcp` with no authentication, and ask a few questions from the evaluation set in the PRD.
3. **Gemini:** register the server in the Google Connected Console (Connected Apps preview) and use its testing mode.
4. Watch the Railway logs and the rate-limit responses (429) while testing.

## Before public submission (Stage 2)

- Merge PR #286 (login on write and paid routes) first; listing the API on two assistant platforms draws attention to it.
- Do the legal check and creator notification described in the PRD (section 5).
- Run the 40-question evaluation in both assistants and check the acceptance gates.

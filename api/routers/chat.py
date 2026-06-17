"""
Chat Agent endpoint — POST /api/chat/message

Uses Claude Opus 4.6 with tool_use to answer natural language restaurant queries,
search the where2eat DB, and check real-time availability on Ontopo and Tabit.
"""

import json
import logging
import os
from datetime import datetime, date
from typing import Optional, List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    history: List[ChatMessage] = []
    context: Optional[dict] = None  # {"party_size": 2, "date": "2026-04-24"}


class ChatResponse(BaseModel):
    reply: str
    session_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

RESTAURANT_API = "https://where2eat-production.up.railway.app"
RESTAURANT_ORIGIN = "https://where2eat.rest"


async def _tool_search_restaurants(city: str, cuisine: str = "",
                                    occasion: str = "", limit: int = 8) -> str:
    """Search where2eat DB for restaurants."""
    params = {"limit": str(limit)}
    if city:
        params["city"] = city
    if cuisine:
        params["cuisine_type"] = cuisine

    query_parts = [p for p in [city, cuisine, occasion] if p]
    if query_parts:
        params["query"] = " ".join(query_parts)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{RESTAURANT_API}/api/restaurants/search",
                params=params,
                headers={"Origin": RESTAURANT_ORIGIN},
                timeout=10,
            )
            data = resp.json()
            restaurants = data.get("restaurants", [])

        # Return lean summary for Claude
        result = []
        for r in restaurants[:8]:
            result.append({
                "id": r.get("id"),
                "name_hebrew": r.get("name_hebrew"),
                "name_english": r.get("name_english"),
                "city": r.get("city"),
                "cuisine_type": r.get("cuisine_type"),
                "google_rating": r.get("google_rating"),
                "description": (r.get("description") or "")[:200],
                "ontopo_slug": r.get("ontopo_slug"),
                "tabit_org_id": r.get("tabit_org_id"),
                "address": r.get("address"),
            })
        return json.dumps(result, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Restaurant search failed: {e}")
        return json.dumps({"error": str(e)})


async def _tool_check_ontopo(ontopo_slug: str, date: str,
                              time: str, party_size: int = 2) -> str:
    """Check Ontopo availability."""
    from services.ontopo import check_availability
    try:
        result = await check_availability(
            numeric_slug=ontopo_slug,
            date=date.replace("-", ""),   # YYYY-MM-DD → YYYYMMDD
            time_str=time.replace(":", ""),  # HH:MM → HHMM
            party_size=party_size,
        )
        # Return lean result for Claude
        return json.dumps({
            "available": result["available"],
            "slots": result["slots"][:5],
            "recommended": result["recommended"][:2],
            "alternative_dates": result["alternative_dates"][:3],
            "booking_url": result["booking_url"],
        }, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Ontopo check failed: {e}")
        return json.dumps({"available": False, "error": str(e)})


async def _tool_check_tabit(tabit_org_id: str, date: str,
                             time: str, party_size: int = 2) -> str:
    """Check Tabit availability."""
    from services.tabit import check_availability
    try:
        result = await check_availability(
            org_id=tabit_org_id,
            date=date,           # YYYY-MM-DD
            time_str=time,       # HH:MM
            party_size=party_size,
        )
        return json.dumps({
            "available": result["available"],
            "slots": result["slots"][:3],
            "alternative_slots": result["alternative_slots"][:3],
        }, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Tabit check failed: {e}")
        return json.dumps({"available": False, "error": str(e)})


# ---------------------------------------------------------------------------
# Tool definitions for Claude
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "search_restaurants",
        "description": "חפש מסעדות ב-where2eat לפי עיר, סוג מטבח ואוקיישן. מחזיר רשימה של מסעדות מומלצות כולל ontopo_slug ו-tabit_org_id אם יש.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "עיר בעברית: תל אביב, ירושלים, חיפה וכו'"},
                "cuisine": {"type": "string", "description": "סוג מטבח: איטלקי, יפני, ים תיכוני וכו'"},
                "occasion": {"type": "string", "description": "אוקיישן: דייט, משפחה, עסקי, חברים וכו'"},
                "limit": {"type": "integer", "description": "מספר תוצאות (ברירת מחדל 8)", "default": 8},
            },
            "required": [],
        },
    },
    {
        "name": "check_ontopo",
        "description": "בדוק זמינות מקומות ב-Ontopo למסעדה ספציפית. read-only — לא יוצר הזמנה.",
        "input_schema": {
            "type": "object",
            "properties": {
                "ontopo_slug": {"type": "string", "description": "המזהה המספרי של המסעדה ב-Ontopo (מ-search_restaurants)"},
                "date": {"type": "string", "description": "תאריך בפורמט YYYY-MM-DD"},
                "time": {"type": "string", "description": "שעה בפורמט HH:MM (24h), למשל 20:00"},
                "party_size": {"type": "integer", "description": "מספר סועדים", "default": 2},
            },
            "required": ["ontopo_slug", "date", "time"],
        },
    },
    {
        "name": "check_tabit",
        "description": "בדוק זמינות מקומות ב-Tabit למסעדה ספציפית.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tabit_org_id": {"type": "string", "description": "מזהה הארגון ב-Tabit (מ-search_restaurants)"},
                "date": {"type": "string", "description": "תאריך בפורמט YYYY-MM-DD"},
                "time": {"type": "string", "description": "שעה בפורמט HH:MM (24h), למשל 20:00"},
                "party_size": {"type": "integer", "description": "מספר סועדים", "default": 2},
            },
            "required": ["tabit_org_id", "date", "time"],
        },
    },
]

TOOL_HANDLERS = {
    "search_restaurants": _tool_search_restaurants,
    "check_ontopo": _tool_check_ontopo,
    "check_tabit": _tool_check_tabit,
}

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

def _build_system_prompt() -> str:
    today = date.today().strftime("%A, %B %d, %Y")
    return f"""אתה עוזר מסעדות חכם של where2eat.rest. היום: {today}.

יש לך גישה לכלים:
- search_restaurants: חיפוש מסעדות ב-where2eat (מומלצות מפודקאסטים על אוכל)
- check_ontopo: בדיקת זמינות אמיתית ב-Ontopo (read-only)
- check_tabit: בדיקת זמינות אמיתית ב-Tabit

הנחיות:
1. הבן את הבקשה — עיר, תאריך/יום, מספר סועדים, אוקיישן, תקציב, העדפות
2. חפש מסעדות מתאימות (search_restaurants)
3. לכל מסעדה שיש לה ontopo_slug — בדוק זמינות (check_ontopo)
4. לכל מסעדה שיש לה tabit_org_id — בדוק זמינות (check_tabit)
5. הצג עד 3-4 מסעדות, ממוינות: קודם אלה עם מקום מאושר
6. לכל מסעדה: שם, תיאור קצר, שעות פנויות, לינק הזמנה
7. אם אין מקום — הצע תאריכים חלופיים
8. היה תמציתי, חם וישיר — כמו חבר שמכיר את המסעדות

אם לא ציינו תאריך — שאל מתי, או הנח היום בערב.
אם לא ציינו מספר סועדים — הנח 2.
ענה תמיד בעברית אלא אם שואלים באנגלית."""


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.post("/message", response_model=ChatResponse)
async def chat_message(request: ChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    try:
        import anthropic
    except ImportError:
        raise HTTPException(status_code=500, detail="anthropic package not installed")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    # Build messages history
    messages = []
    for msg in request.history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})

    system = _build_system_prompt()

    # Agentic loop
    MAX_ITERATIONS = 6
    for _ in range(MAX_ITERATIONS):
        response = await client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            system=system,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            # Extract final text
            text = next(
                (b.text for b in response.content if b.type == "text"), ""
            )
            return ChatResponse(reply=text, session_id=request.session_id)

        if response.stop_reason != "tool_use":
            break

        # Append assistant response
        messages.append({"role": "assistant", "content": response.content})

        # Execute tools
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            handler = TOOL_HANDLERS.get(block.name)
            if not handler:
                result = json.dumps({"error": f"Unknown tool: {block.name}"})
            else:
                try:
                    result = await handler(**block.input)
                except Exception as e:
                    logger.error(f"Tool {block.name} failed: {e}")
                    result = json.dumps({"error": str(e)})

            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })

        messages.append({"role": "user", "content": tool_results})

    # Fallback
    last_text = next(
        (b.text for b in response.content if b.type == "text"), ""
    )
    return ChatResponse(reply=last_text or "מצטער, לא הצלחתי לעבד את הבקשה.", session_id=request.session_id)

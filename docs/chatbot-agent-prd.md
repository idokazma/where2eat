# PRD — Where2Eat Chatbot Agent

**Status:** Ready for development
**Author:** Boten (AI PM)
**Last updated:** 2026-04-17

---

## Overview

A conversational AI agent embedded in where2eat.rest that understands natural language requests, searches our restaurant database, checks real-time availability on Ontopo and Tabit, and recommends restaurants with live booking options.

**Example interaction:**
> "מחפש מסעדה לדייט באיזור תל אביב ביום חמישי בערב"
> → Agent searches DB → checks real-time availability → returns 3 recommendations with available slots and direct booking links

---

## Channels

| Channel | Status | Notes |
|---------|--------|-------|
| Website widget | MVP | Floating chat button on where2eat.rest |
| Telegram bot | V2 | Separate bot, same backend API |
| WhatsApp bot | V2 | Via Twilio or WhatsApp Business API |

All channels share a single `/api/chat/message` backend endpoint.

---

## Architecture

### Backend — FastAPI on Railway

```
User message
    ↓
POST /api/chat/message
    ↓
Claude Opus 4.6 (tool_use loop)
    ↓
Tools: search_db | check_ontopo | check_tabit | web_search
    ↓
Final response with availability + booking links
```

### Claude Agent — Python tool_use

```python
from anthropic import beta_tool, Anthropic

client = Anthropic()  # ANTHROPIC_API_KEY from Railway env

@beta_tool
def search_restaurants(city: str, cuisine: str = "", occasion: str = "",
                       price_range: str = "") -> str:
    """חפש מסעדות ב-where2eat DB לפי עיר, סוג מטבח, אוקיישן ותקציב"""

@beta_tool
def check_ontopo(restaurant_name: str, ontopo_slug: str,
                 date: str, time: str, party_size: int) -> str:
    """בדוק זמינות מקומות ב-Ontopo (read-only, ללא יצירת הזמנה)"""

@beta_tool
def check_tabit(restaurant_name: str, tabit_org_id: str,
                date: str, time: str, party_size: int) -> str:
    """בדוק זמינות מקומות ב-Tabit (temp reservation, פוקע אחרי 5 דקות)"""

runner = client.beta.messages.tool_runner(
    model="claude-opus-4-6",
    max_tokens=2048,
    tools=[search_restaurants, check_ontopo, check_tabit],
    system=SYSTEM_PROMPT,
    messages=conversation_history,
)
```

---

## Availability Integrations

### Ontopo ✅ (proven feasible)

**API:** `https://ontopo.com/api/` (`.com`, not `.co.il` — no Cloudflare)
**Auth:** Anonymous JWT — no account, no personal data required
**Availability check:** Read-only, no reservation created

```python
# Step 1: Get token (expires ~15 min, cache it)
token = requests.post("https://ontopo.com/api/loginAnonymously").json()["jwt_token"]

# Step 2: Resolve slug (one-time per restaurant, store in DB)
slug = requests.post("https://ontopo.com/api/slug_content",
    json={"slug": "romano"}).json()["slug"]  # → "58551219"

# Step 3: Check availability (pure read)
result = requests.post("https://ontopo.com/api/availability_search",
    headers={"token": token},
    json={"slug": slug, "locale": "he",
          "criteria": {"size": "2", "date": "20260421", "time": "2000"}})

# Response includes:
# - areas[].options[].method: "seat" = available, "standby" = waitlist, "disabled" = full
# - areas[].options[].time: slot time (HHMM)
# - recommended[]: top suggestions
# - dates[]: alternative dates if requested date is full
```

**Response statuses:**
- `method: "seat"` → available, bookable now
- `method: "standby"` → waitlist only
- `method: "disabled"` → fully booked
- `dates[]` → alternative available dates

**Booking link:** `https://ontopo.com/he/il/page/{slug}?date={YYYYMMDD}&time={HHMM}&size={N}`

---

### Tabit ✅ (proven feasible)

**API:** `https://tgm-api.tabit.cloud/`
**Auth:** None required for read operations
**Availability check:** Via temp reservation (expires automatically after ~5 min)

```python
# Step 1: Get org config + booking windows (read-only, no side effects)
config = requests.get(
    "https://tgm-api.tabit.cloud/rsv/booking/configuration",
    params={"organization": org_id}
)
# Returns booking_windows by day-of-week — use to show scheduled hours

# Step 2: Check real availability (creates temp reservation, expires in 5 min)
result = requests.post(
    "https://tgm-api.tabit.cloud/rsv/booking/temp-reservations",
    json={"organization": org_id, "date": date, "time": time, "seats": party_size}
)
# If slot taken → response includes alternative_results with nearby slots
```

**Restaurant lookup:** `GET https://bridge.tabit.cloud/organizations` (public, no auth)

**Booking link:** Direct to restaurant's Tabit booking page

---

## System Prompt

```
אתה עוזר מסעדות חכם של where2eat.rest.

יש לך גישה ל:
- מסד נתונים של מסעדות מומלצות בישראל עם ביקורות ומידע מפודקאסטים
- בדיקת זמינות אמיתית ב-Ontopo ו-Tabit

הנחיות:
1. הבן את הבקשה — עיר, תאריך/יום, מספר סועדים, אוקיישן, תקציב, סגנון
2. חפש מסעדות מתאימות ב-DB
3. לכל מסעדה רלוונטית — בדוק זמינות ב-Ontopo/Tabit
4. הצג תוצאות ממוינות: קודם מאושרות (יש מקום), אחר כך ממתינות
5. לכל מסעדה — כלול שעות פנויות + לינק הזמנה ישיר
6. היה תמציתי, חם, וישיר — כמו חבר שמכיר את המסעדות

פורמט תשובה:
- מקסימום 3-4 מסעדות
- לכל אחת: שם, תיאור קצר, שעות פנויות, לינק הזמנה
- אם אין מקום — הצע תאריכים חלופיים
```

---

## Data Model Changes

### restaurants table — new fields

| Field | Type | Description |
|-------|------|-------------|
| `ontopo_slug` | string | Numeric slug for Ontopo API (e.g. "58551219") |
| `tabit_org_id` | string | Organization ID for Tabit API |
| `booking_platforms` | json | `["ontopo", "tabit", "resy"]` |

### conversations table (new)

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | |
| `session_id` | string | Browser session or Telegram chat ID |
| `messages` | json | Full conversation history |
| `created_at` | timestamp | |

---

## API Endpoint

```
POST /api/chat/message
Body: {
  "message": "מחפש מסעדה לדייט בתל אביב ביום חמישי",
  "session_id": "uuid",
  "history": [...],  // previous messages in this conversation
  "context": {       // optional
    "party_size": 2,
    "date": "2026-04-24"
  }
}

Response: {
  "reply": "מצאתי 2 מסעדות פנויות...",
  "session_id": "uuid",
  "restaurants": [...]  // structured data for frontend to render cards
}
```

---

## Cost Estimate

| Component | Est. Usage | Cost |
|-----------|-----------|------|
| Claude Opus 4.6 | ~20K tokens/conversation | ~$0.006/conversation |
| Ontopo API | free | $0 |
| Tabit API | free | $0 |
| 100 conversations/day | | ~$0.60/day |
| 1,000 conversations/day | | ~$6/day |

---

## MVP Scope

**In:**
- Website chat widget
- Hebrew + English input
- DB search + Ontopo availability check
- Tabit availability check
- Conversation history (within session)
- Direct booking links

**Out (V2):**
- Telegram/WhatsApp bots
- User accounts & saved preferences
- Push notifications ("מקום התפנה ב-X")
- Proactive recommendations ("בשבוע הבא יש לך ערב פנוי...")

---

## Open Questions

1. Should we store `ontopo_slug` and `tabit_org_id` in the DB now, or resolve dynamically?
2. Rate limits on Ontopo anonymous tokens — need to test at scale
3. Tabit temp reservations — do they affect real availability? (5 min expiry should be fine)
4. Widget placement — floating button or dedicated `/chat` page?

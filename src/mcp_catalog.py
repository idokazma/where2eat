"""Read-only catalog served to ChatGPT and Gemini through the MCP server.

Serves only what the public site serves: visible restaurants with a real name
and city, and episode mentions that were not rejected. Every result carries
its evidence: the creator, the publication date, a short labeled excerpt and
a link to the exact moment in the video.

No language-model calls and no paid lookups happen here. Images are returned
only when they are direct URLs, never through the paid Google photo proxy.
"""
import json
import re
import threading
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote, urlencode

SITE = 'https://www.where2eat.rest'
UTM = 'utm_source=assistant&utm_medium=mcp'
MAX_RESULTS = 5
MAX_EVIDENCE_PER_RESULT = 2
EXCERPT_MAX_CHARS = 200
EXPERIENCE = {'נטעם': 'tasted', 'הוזכר': 'mentioned'}
AFFILIATION_NOTE = ('Creators listed here are not affiliated with where2eat unless stated. '
                    'Content is excerpted with attribution and a link to the original.')
ANSWER_GUIDANCE = ('Credit the named creator for every claim and include moment_url. Put only excerpts '
                   'with kind=verified_quote in quotation marks; paraphrase the others and say they come '
                   'from an automatic transcript or summary. Dates are publication dates, not visit dates.')

# Stored values are Hebrew; assistants often pass English. Keys are lowercase.
CITY_ALIASES = {
    'tel aviv': 'תל אביב', 'tel-aviv': 'תל אביב', 'tlv': 'תל אביב', 'tel aviv-yafo': 'תל אביב',
    'jaffa': 'יפו', 'yafo': 'יפו', 'jerusalem': 'ירושלים', 'haifa': 'חיפה', 'herzliya': 'הרצליה',
    'nazareth': 'נצרת', 'givatayim': 'גבעתיים', 'ramat gan': 'רמת גן', 'beer sheva': 'באר שבע',
    'beersheba': 'באר שבע', "be'er sheva": 'באר שבע', 'ashdod': 'אשדוד', 'ashkelon': 'אשקלון',
    'rishon lezion': 'ראשון לציון', 'rishon letzion': 'ראשון לציון', 'pardes hanna': 'פרדס חנה',
    'pardes hana': 'פרדס חנה', 'tira': 'טירה', 'eilat': 'אילת', 'netanya': 'נתניה',
    'kfar saba': 'כפר סבא', "ra'anana": 'רעננה', 'raanana': 'רעננה', 'holon': 'חולון',
    'bat yam': 'בת ים', 'petah tikva': 'פתח תקווה', 'petah tikvah': 'פתח תקווה', 'rehovot': 'רחובות',
    'ness ziona': 'נס ציונה', 'mitzpe ramon': 'מצפה רמון', 'even yehuda': 'אבן יהודה',
    'acre': 'עכו', 'akko': 'עכו', 'caesarea': 'קיסריה', 'zichron yaakov': 'זכרון יעקב',
    'bnei brak': 'בני ברק', 'modiin': 'מודיעין', 'hod hasharon': 'הוד השרון', 'tiberias': 'טבריה',
}
CUISINE_ALIASES = {
    'pizza': 'פיצה', 'burger': 'המבורגר', 'burgers': 'המבורגר', 'hamburger': 'המבורגר',
    'meat': 'בשר', 'steak': 'בשר', 'grill': 'בשר', 'steakhouse': 'בשר', 'hummus': 'חומוס',
    'cafe': 'קפה', 'coffee': 'קפה', 'bakery': 'מאפייה', 'fish': 'דגים', 'seafood': 'דגים',
    'japanese': 'יפני', 'sushi': 'סושי', 'chef': 'שף', 'italian': 'איטלקי', 'deli': 'מעדנייה',
    'skewers': 'שיפודים', 'asian': 'אסייתי', 'mexican': 'מקסיקני', 'bar': 'בר', 'vegan': 'טבעוני',
    'street food': 'אוכל רחוב', 'ice cream': 'גלידה', 'shawarma': 'שווארמה', 'falafel': 'פלאפל',
    'pita': 'פיתה', 'sabich': 'סביח', 'kebab': 'קבב', 'thai': 'תאילנדי', 'indian': 'הודי',
    'chinese': 'סיני', 'georgian': 'גאורגי', 'french': 'צרפתי', 'greek': 'יווני', 'pasta': 'פסטה',
    'dessert': 'קינוח', 'desserts': 'קינוחים', 'breakfast': 'בוקר', 'wine bar': 'בר יין',
}
CREATOR_ALIASES = {'medabrim mehabeten': 'מדברים מהבטן', 'medabrim': 'מדברים מהבטן'}

_SENTENCE_END = re.compile(r'(?<=[.!?׃])\s+')


def _norm(value: Optional[str]) -> str:
    return (value or '').strip().lower()


def _alias(value: Optional[str], table: Dict[str, str]) -> str:
    v = _norm(value)
    return table.get(v, v)


def _day(value: Any) -> Optional[str]:
    if not value:
        return None
    text = str(value)
    return text[:10] if re.match(r'^\d{4}-\d{2}-\d{2}', text) else None


def _seconds(value: Any) -> Optional[int]:
    if value is None or value == '':
        return None
    if isinstance(value, (int, float)):
        return int(value) if value >= 0 else None
    text = str(value).strip()
    if re.fullmatch(r'\d+(\.\d+)?', text):
        return int(float(text))
    parts = text.split(':')
    if 2 <= len(parts) <= 3 and all(p.isdigit() for p in parts):
        total = 0
        for p in parts:
            total = total * 60 + int(p)
        return total
    return None


def _json_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            return []
    return []


def excerpt(text: Optional[str]) -> Optional[str]:
    """At most two sentences and EXCERPT_MAX_CHARS characters."""
    if not text or not str(text).strip():
        return None
    clean = ' '.join(str(text).split()).strip('"״”“')
    short = ' '.join(_SENTENCE_END.split(clean)[:2])
    if len(short) > EXCERPT_MAX_CHARS:
        short = short[:EXCERPT_MAX_CHARS - 1].rsplit(' ', 1)[0] + '…'
    return short


def _moment_url(video_id: Optional[str], seconds: Optional[int]) -> Optional[str]:
    if not video_id:
        return None
    url = f'https://www.youtube.com/watch?v={quote(video_id)}'
    return f'{url}&t={seconds}s' if seconds else url


class Catalog:
    def __init__(self, db, today: Optional[date] = None, ttl_seconds: float = 60.0):
        self.db = db
        self._today = today
        self._ttl = ttl_seconds
        self._cache: Optional[Dict[str, Any]] = None
        self._cached_at = 0.0
        self._lock = threading.Lock()

    def today(self) -> date:
        return self._today or date.today()

    # ── loading
    def _load(self) -> Dict[str, Any]:
        with self._lock:
            if self._cache is not None and time.monotonic() - self._cached_at < self._ttl:
                return self._cache
            self._cache = self._read()
            self._cached_at = time.monotonic()
            return self._cache

    def _read(self) -> Dict[str, Any]:
        with self.db.get_connection() as c:
            rows = [dict(r) for r in c.execute(
                "SELECT r.*, e.channel_name AS ep_channel, e.published_at AS ep_published, e.title AS ep_title "
                "FROM restaurants r LEFT JOIN episodes e ON r.episode_id = e.id "
                "WHERE COALESCE(r.is_hidden, 0) = 0 AND LENGTH(TRIM(COALESCE(r.name_hebrew, ''))) >= 2 "
                "AND TRIM(COALESCE(r.city, '')) NOT IN ('', 'לא צוין')")]
            mentions = [dict(m) for m in c.execute(
                "SELECT em.*, e.channel_name, e.published_at AS ep_published, e.title AS ep_title "
                "FROM episode_mentions em LEFT JOIN episodes e ON em.episode_id = e.id "
                "WHERE COALESCE(em.verdict, '') != 'rejected'")]
        restaurants = {r['id']: r for r in rows}
        by_place = {r['google_place_id']: r['id'] for r in rows if r.get('google_place_id')}
        evidence: Dict[str, List[Dict[str, Any]]] = {rid: [] for rid in restaurants}
        dishes: Dict[str, List[str]] = {rid: [] for rid in restaurants}
        for m in mentions:
            rid = m.get('restaurant_id')
            if rid not in restaurants:
                rid = by_place.get(m.get('google_place_id')) if not rid else None
            if rid not in restaurants:
                continue
            evidence[rid].append(self._mention_evidence(m))
            dishes[rid].extend(str(d) for d in _json_list(m.get('dishes_mentioned')))
        for rid, r in restaurants.items():
            if not evidence[rid]:
                fallback = self._restaurant_evidence(r)
                if fallback:
                    evidence[rid].append(fallback)
            evidence[rid].sort(key=lambda e: e['published_at'] or '', reverse=True)
        return {'restaurants': restaurants, 'evidence': evidence, 'dishes': dishes}

    @staticmethod
    def _mention_evidence(m: Dict[str, Any]) -> Dict[str, Any]:
        text, kind = None, None
        review = m.get('verified_quote')
        if isinstance(review, str):
            try:
                review = json.loads(review)
            except (ValueError, TypeError):
                review = None
        if isinstance(review, dict) and isinstance(review.get('text'), str) and review['text'].strip():
            text, kind = excerpt(review['text']), 'verified_quote'  # reviewer identity is never copied
        else:
            quotes = [q for q in _json_list(m.get('host_quotes')) if isinstance(q, str) and q.strip()]
            if quotes:
                text, kind = excerpt(quotes[0]), 'unverified_transcript'
            elif m.get('host_comments'):
                text, kind = excerpt(m['host_comments']), 'unverified_summary'
        seconds = _seconds(m.get('timestamp_seconds'))
        return {
            'creator': m.get('channel_name'),
            'speaker': m.get('speaker') or None,
            'episode_title': m.get('ep_title'),
            'published_at': _day(m.get('ep_published')),
            'experience': EXPERIENCE.get(m.get('mention_level') or '', 'unknown'),
            'excerpt': {'text': text, 'kind': kind} if text else None,
            'moment_url': _moment_url(m.get('video_id'), seconds),
        }

    @staticmethod
    def _restaurant_evidence(r: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not r.get('video_id'):
            return None
        text = excerpt(r.get('engaging_quote') or r.get('host_comments'))
        return {
            'creator': r.get('channel_name') or r.get('ep_channel'),
            'speaker': None,
            'episode_title': r.get('ep_title'),
            'published_at': _day(r.get('published_at')) or _day(r.get('ep_published')),
            'experience': EXPERIENCE.get(r.get('mention_level') or '', 'unknown'),
            'excerpt': {'text': text, 'kind': 'unverified_summary'} if text else None,
            'moment_url': _moment_url(r['video_id'], _seconds(r.get('mention_timestamp'))),
        }

    # ── presentation
    @staticmethod
    def _image(r: Dict[str, Any]) -> Optional[str]:
        url = r.get('image_url') or ''
        return url if url.startswith('https://') and '/api/photos' not in url else None

    @staticmethod
    def _map_url(r: Dict[str, Any]) -> str:
        if r.get('google_url', '') and str(r['google_url']).startswith('https://'):
            return r['google_url']
        params = {'api': '1'}
        if r.get('latitude') is not None and r.get('longitude') is not None:
            params['query'] = f"{r['latitude']},{r['longitude']}"
        else:
            params['query'] = f"{r.get('name_hebrew') or ''} {r.get('city') or ''}".strip()
        if r.get('google_place_id'):
            params['query_place_id'] = r['google_place_id']
        return 'https://www.google.com/maps/search/?' + urlencode(params)

    def _card(self, r: Dict[str, Any], evidence: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            'id': r['id'],
            'name': r.get('name_hebrew'),
            'name_english': r.get('name_english') or None,
            'city': r.get('city'),
            'neighborhood': r.get('neighborhood') or None,
            'cuisine': r.get('cuisine_type') or None,
            'price_range': r.get('price_range') or None,
            'google_rating': r.get('google_rating'),
            'closing': bool(r.get('is_closing')),
            'image_url': self._image(r),
            'where2eat_url': f"{SITE}/restaurant/{quote(str(r['id']))}?{UTM}",
            'map_url': self._map_url(r),
            'evidence': evidence,
        }

    # ── filters
    def _text(self, rid: str, r: Dict[str, Any]) -> Dict[str, str]:
        menu = ' '.join(str(x) for x in _json_list(r.get('menu_items')))
        dishes = ' '.join(self._load()['dishes'].get(rid, []))
        return {
            'city': _norm(r.get('city')),
            'cuisine': _norm(r.get('cuisine_type')),
            'dish': ' '.join([_norm(menu), _norm(dishes), _norm(r.get('cuisine_type')), _norm(r.get('name_hebrew'))]),
            'query': ' '.join(_norm(r.get(k)) for k in ('name_hebrew', 'name_english', 'cuisine_type', 'city', 'neighborhood'))
                     + ' ' + _norm(menu),
        }

    @staticmethod
    def _date(value: Optional[str], name: str) -> Optional[str]:
        if not value:
            return None
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value.strip()):
            raise ValueError(f'{name} must be a date in YYYY-MM-DD format')
        return value.strip()

    def _matches(self, rid, r, ev, *, city, cuisine, dish, query, creator, published_after, tasted_only):
        """Return the evidence that satisfies every filter, or None if the place fails one."""
        t = self._text(rid, r)
        if city and city not in t['city']:
            return None
        if cuisine and cuisine not in t['cuisine']:
            return None
        if dish and dish not in t['dish']:
            return None
        if query and not all(word in t['query'] for word in query.split()):
            return None
        kept = [e for e in ev
                if (not creator or creator in _norm(e.get('creator')))
                and (not published_after or (e.get('published_at') or '') >= published_after)
                and (not tasted_only or e.get('experience') == 'tasted')]
        if (creator or published_after or tasted_only) and not kept:
            return None
        return kept or ev

    def _hits(self, filters: Dict[str, Any]):
        data = self._load()
        hits = []
        for rid, r in data['restaurants'].items():
            kept = self._matches(rid, r, data['evidence'][rid], **filters)
            if kept is not None:
                hits.append((r, kept))
        return hits

    def search_restaurants(self, city: Optional[str] = None, cuisine: Optional[str] = None,
                           dish: Optional[str] = None, query: Optional[str] = None,
                           creator: Optional[str] = None, published_after: Optional[str] = None,
                           tasted_only: bool = False, limit: int = 3) -> Dict[str, Any]:
        limit = max(1, min(int(limit or 3), MAX_RESULTS))
        filters = {
            'city': _alias(city, CITY_ALIASES) or None,
            'cuisine': _alias(cuisine, CUISINE_ALIASES) or None,
            'dish': _alias(dish, CUISINE_ALIASES) or None,
            'query': _norm(query) or None,
            'creator': _alias(creator, CREATOR_ALIASES) or None,
            'published_after': self._date(published_after, 'published_after'),
            'tasted_only': bool(tasted_only),
        }
        hits = self._hits(filters)
        hits.sort(key=lambda h: (
            any(e.get('experience') == 'tasted' for e in h[1]),
            max((e.get('published_at') or '' for e in h[1]), default=''),
            h[0].get('google_rating') or 0,
        ), reverse=True)
        results = [self._card(r, ev[:MAX_EVIDENCE_PER_RESULT]) for r, ev in hits[:limit]]
        out = {'results': results, 'total_matches': len(hits), 'limit': limit,
               'filters_applied': {k: v for k, v in filters.items() if v}, 'answer_guidance': ANSWER_GUIDANCE}
        if not results:
            out['no_coverage'] = self._no_coverage(filters)
        return out

    def _no_coverage(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        reasons = {'city': 'city_not_covered', 'cuisine': 'cuisine_not_covered', 'dish': 'dish_not_covered',
                   'query': 'no_name_or_text_match', 'creator': 'creator_not_covered',
                   'published_after': 'nothing_published_in_range', 'tasted_only': 'no_tasted_visits'}
        data = self._load()
        empty = {k: (False if k == 'tasted_only' else None) for k in filters}
        for key, reason in reasons.items():
            if not filters.get(key):
                continue
            single = {**empty, key: filters[key]}
            if not any(self._matches(rid, r, data['evidence'][rid], **single) is not None
                       for rid, r in data['restaurants'].items()):
                return {'reason': reason, 'filter': key,
                        'message': 'where2eat has no creator coverage for this. Say so; do not substitute other places.'}
        return {'reason': 'no_place_matches_all_filters',
                'message': 'Each filter matches something, but no single place matches all of them. '
                           'Offer to relax one filter; do not substitute places that fail them.'}

    def get_restaurant(self, restaurant_id: str) -> Dict[str, Any]:
        data = self._load()
        r = data['restaurants'].get(str(restaurant_id))
        if not r:
            return {'found': False, 'message': 'No published where2eat restaurant has this ID.'}
        return {'found': True, 'restaurant': self._card(r, data['evidence'][r['id']]),
                'answer_guidance': ANSWER_GUIDANCE}

    def whats_new(self, days: int = 30, city: Optional[str] = None, creator: Optional[str] = None,
                  limit: int = 10) -> Dict[str, Any]:
        days = max(1, min(int(days or 30), 180))
        limit = max(1, min(int(limit or 10), 20))
        since = (self.today() - timedelta(days=days)).isoformat()
        filters = {'city': _alias(city, CITY_ALIASES) or None, 'cuisine': None, 'dish': None, 'query': None,
                   'creator': _alias(creator, CREATOR_ALIASES) or None, 'published_after': since, 'tasted_only': False}
        hits = self._hits(filters)
        hits.sort(key=lambda h: max(e.get('published_at') or '' for e in h[1]), reverse=True)
        out = {'since': since, 'days': days, 'results': [self._card(r, ev[:MAX_EVIDENCE_PER_RESULT]) for r, ev in hits[:limit]],
               'total_matches': len(hits), 'answer_guidance': ANSWER_GUIDANCE}
        if not hits:
            out['no_coverage'] = self._no_coverage(filters)
        return out

    def list_creators(self) -> Dict[str, Any]:
        data = self._load()
        creators: Dict[str, Dict[str, Any]] = {}
        cities: Dict[str, int] = {}
        cuisines: Dict[str, int] = {}
        for rid, r in data['restaurants'].items():
            ev = data['evidence'][rid]
            if not ev:
                continue
            cities[r['city']] = cities.get(r['city'], 0) + 1
            if r.get('cuisine_type'):
                cuisines[r['cuisine_type']] = cuisines.get(r['cuisine_type'], 0) + 1
            for name in {e.get('creator') for e in ev if e.get('creator')}:
                c = creators.setdefault(name, {'name': name, 'places': 0, 'last_published_at': None})
                c['places'] += 1
                latest = max((e.get('published_at') or '' for e in ev if e.get('creator') == name), default='')
                if latest and (c['last_published_at'] or '') < latest:
                    c['last_published_at'] = latest
        top = lambda counts: [k for k, _ in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]
        return {'creators': sorted(creators.values(), key=lambda c: -c['places']),
                'available_cities': top(cities)[:40], 'available_cuisines': top(cuisines)[:40],
                'note': AFFILIATION_NOTE, 'as_of': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%MZ')}

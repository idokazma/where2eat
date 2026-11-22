#!/usr/bin/env python3
"""Build the location-ordered stories prototype from the live site's public data.

Design: docs/plans/location-stories-design.md. Output is a single HTML file
written outside version control (default: docs/plans/stories-poc/out/). Nothing
here writes to the site or calls a paid API: it reads the public restaurant and
episode endpoints, and never uses the paid Google photo proxy.

    python docs/plans/stories-poc/build_stories_poc.py                 # photos as links
    python docs/plans/stories-poc/build_stories_poc.py --embed-photos  # photos inside the file

--embed-photos needs Pillow and makes a ~7 MB file that also works in viewers
that block outside images. Keep built files out of the repository: most photos
come from Google Places and the quotes are the creators' content.
"""
import argparse
import base64
import io
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

API = 'https://where2eat-production.up.railway.app'
ORIGIN = 'https://www.where2eat.rest'   # the public API only answers the site's origin
HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / 'stories.template.html'


def excerpt(text, limit=200):
    """At most two sentences and `limit` characters."""
    if not text or not str(text).strip():
        return None
    text = ' '.join(str(text).split()).strip('"״”“')
    text = ' '.join(re.split(r'(?<=[.!?])\s+', text)[:2])
    return text if len(text) <= limit else text[:limit - 1].rsplit(' ', 1)[0] + '…'


def is_listed(r):
    """Same rule as the site's feed: not hidden, closing or closed."""
    return not r.get('is_hidden') and not r.get('is_closing') and r.get('status') not in ('closed', 'סגור')


def pick_image(r, alive):
    """A stored or direct photo URL; never the paid /api/photos proxy or a Places photo reference.

    `alive` is the set of URLs that answered 200, or None to skip the check.
    """
    url = r.get('image_url') or ''
    candidates = [url] + [p.get('photo_url') or '' for p in (r.get('photos') or [])]
    for u in candidates:
        if u.startswith('https://') and '/api/photos' not in u and (alive is None or u in alive):
            return u
    return None


def render_html(template, data, imgs):
    """Fill the template. `imgs` maps keys to base64 JPEGs, one per line, or None."""
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    payload = payload.replace('},{"id"', '},\n{"id"')   # one restaurant per line
    block = ''
    if imgs:
        block = 'const IMGS_EMBEDDED = {\n' + ',\n'.join(f'"{k}":"{v}"' for k, v in imgs.items()) + '\n};'
    return template.replace('/*__IMGS__*/', block).replace('__DATA__', payload)


def _get(path):
    req = urllib.request.Request(API + path, headers={'Origin': ORIGIN, 'User-Agent': 'where2eat-stories-poc'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def _status(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        return url, urllib.request.urlopen(req, timeout=20).status
    except Exception:
        return url, 0


def _photo(url):
    from PIL import Image   # only needed for --embed-photos
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
        im = Image.open(io.BytesIO(raw)).convert('RGB')
        w, h = im.size
        if w / h > 9 / 14:   # crop to a story shape
            nw = int(h * 9 / 14)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        im.thumbnail((360, 560))
        buf = io.BytesIO()
        im.save(buf, 'JPEG', quality=50, optimize=True, progressive=True)
        return url, base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return url, None


def collect(check_images=True):
    restaurants = _get('/api/restaurants')
    restaurants = restaurants.get('restaurants', restaurants)
    episodes = _get('/api/episodes/search')
    episodes = episodes.get('episodes', episodes)

    quotes = {}   # (video_id, restaurant_id) -> quote shown on the episode page
    for e in episodes:
        vid = (e.get('episode_info') or e).get('video_id')
        if not vid:
            continue
        try:
            detail = _get(f'/api/episodes/{vid}')
        except Exception:
            continue
        for group in (detail.get('mentions') or {}).values():
            for m in group:
                rid = m.get('linked_restaurant_id') or m.get('restaurant_id')
                vq = m.get('verified_quote')
                if isinstance(vq, dict) and vq.get('text'):
                    q = {'text': excerpt(vq['text']), 'kind': 'verified'}
                else:
                    hq = m.get('host_quotes') or []
                    q = {'text': excerpt(hq[0]), 'kind': 'transcript'} if hq else None
                if rid and q and q['text']:
                    quotes[(vid, rid)] = q

    alive = None
    if check_images:
        urls = sorted({u for r in restaurants for u in [r.get('image_url') or ''] if u.startswith('https://')})
        with ThreadPoolExecutor(16) as ex:
            alive = {u for u, code in ex.map(_status, urls) if code == 200}

    out, no_coords = [], 0
    for r in restaurants:
        if not is_listed(r):
            continue
        loc = r.get('location') or {}
        lat, lng = loc.get('latitude') or r.get('latitude'), loc.get('longitude') or r.get('longitude')
        if lat is None or lng is None:
            no_coords += 1
            continue
        ei = r.get('episode_info') or {}
        mentions, seen = [], set()
        for m in r.get('mentions') or []:
            key = (m.get('video_id'), m.get('timestamp_seconds'))
            if not m.get('video_id') or key in seen:
                continue
            seen.add(key)
            mentions.append({'v': m['video_id'], 't': m.get('timestamp_seconds'), 'td': m.get('timestamp_display'),
                             'lvl': m.get('mention_level'), 'sp': m.get('speaker') or None, 'ep': m.get('episode_title'),
                             'ch': m.get('channel_name') or ei.get('channel_name'), 'q': quotes.get((m['video_id'], r['id']))})
        if not mentions and ei.get('video_id'):
            mentions.append({'v': ei['video_id'], 't': r.get('mention_timestamp_seconds'), 'td': None,
                             'lvl': r.get('mention_level'), 'sp': None, 'ep': ei.get('title'),
                             'ch': ei.get('channel_name'), 'q': quotes.get((ei['video_id'], r['id']))})
        if not mentions:
            continue
        for m in mentions:   # restaurant-level quote for its main episode
            if not m['q'] and m['v'] == ei.get('video_id') and r.get('engaging_quote'):
                m['q'] = {'text': excerpt(r['engaging_quote']), 'kind': 'summary'}
        out.append({'id': r['id'], 'n': r.get('name_hebrew'), 'ne': r.get('name_english'),
                    'c': loc.get('city') or r.get('city'), 'cu': r.get('cuisine_type'),
                    'lat': float(lat), 'lng': float(lng), 'img': pick_image(r, alive),
                    'rt': (r.get('rating') or {}).get('google_rating'),
                    'pub': ((ei.get('published_at') or r.get('published_at') or '')[:10]) or None,
                    'lvl': r.get('mention_level'),
                    'wm': bool((r.get('google_places') or {}).get('potential_wrong_match')), 'm': mentions})
    meta = {'generated': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
            'listed_total': sum(1 for r in restaurants if is_listed(r)), 'no_coords': no_coords}
    return {'meta': meta, 'restaurants': out}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=str(HERE / 'out' / 'where2eat-stories-poc.html'))
    ap.add_argument('--embed-photos', action='store_true', help='put shrunk photos inside the file (needs Pillow)')
    ap.add_argument('--skip-image-check', action='store_true', help='do not drop photo links that fail to load')
    args = ap.parse_args(argv)

    data = collect(check_images=not args.skip_image_check)
    imgs = None
    if args.embed_photos:
        urls = sorted({r['img'] for r in data['restaurants'] if r['img']})
        with ThreadPoolExecutor(12) as ex:
            got = dict(ex.map(_photo, urls))
        keys = {u: f'i{n}' for n, u in enumerate(urls) if got.get(u)}
        for r in data['restaurants']:
            if r['img']:
                r['img'] = keys.get(r['img'])
        imgs = {keys[u]: got[u] for u in urls if u in keys}

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render_html(TEMPLATE.read_text(encoding='utf-8'), data, imgs), encoding='utf-8')
    with_photo = sum(1 for r in data['restaurants'] if r['img'])
    print(f"{len(data['restaurants'])} restaurants ({with_photo} with a working photo), "
          f"{data['meta']['no_coords']} without coordinates skipped -> {out} ({out.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == '__main__':
    sys.exit(main())

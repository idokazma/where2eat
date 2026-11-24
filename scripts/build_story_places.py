"""Build a conservative local GeoNames search index. Run from repository root.
Government names are used only to audit/join localities, not distributed.
No geocoding calls, keys or runtime services.
"""
import collections
import datetime
import gzip
import io
import json
import re
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

OUT = Path('web/src/data')
DATA_URL = 'https://download.geonames.org/export/dump/IL.zip'
AUDIT_URL = 'https://data.gov.il/api/3/action/datastore_search?resource_id=8f714b6f-c35c-4b40-a0e7-547b675eee0e&limit=2000'


def normalize(value):
    return re.sub(r'[^א-תa-z0-9]', '', unicodedata.normalize('NFKD', value.lower()))


def download(url):
    with urllib.request.urlopen(url) as response:
        return response.read()


def build():
    rows = [line.split('\t') for line in zipfile.ZipFile(io.BytesIO(download(DATA_URL))).read('IL.txt').decode().splitlines()]
    government = json.loads(download(AUDIT_URL))['result']
    assert len(government['records']) == government['total'], 'Incomplete official audit input'
    active_codes = {'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLL', 'STLMT'}
    active = {r[0]: r for r in rows if r[7] in active_codes}
    index = collections.defaultdict(set)
    for r in active.values():
        for alias in [r[1], r[2], *r[3].split(',')]:
            if alias:
                index[normalize(alias)].add(r[0])
    selected = {}
    unmatched, ambiguous, qualified = [], [], 0
    for official in government['records']:
        ids = set()
        for name in [official.get('city_name_he', ''), official.get('city_name_en', '')]:
            ids.update(index.get(normalize(name), set()))
        if len(ids) != 1:
            (ambiguous if ids else unmatched).append(official['city_code'])
            continue
        r = active[next(iter(ids))]
        he = [a for a in r[3].split(',') if re.fullmatch(r'[א-ת\s\-"׳״\x27()]+', a)]
        display = next((a for a in he if normalize(a) == normalize(official['city_name_he'])), None)
        # Do not choose an arbitrary Hebrew alias or assign coordinates to a tribe.
        if not display or 'שבט' in official['city_name_he']:
            continue
        lat, lng = float(r[4]), float(r[5])
        if not (29 <= lat <= 34 and 34 <= lng <= 36.5):
            continue
        qualified += 1
        selected[r[0]] = {
            'id': r[0], 'name': display, 'kind': 'locality',
            'aliases': list(dict.fromkeys([r[1], r[2], *he])),
            'lat': lat, 'lng': lng,
        }
    # Explicitly reviewed broad geographic areas, not administrative boundaries.
    # Coordinates come from the corresponding GeoNames record; Hebrew display names and extra search spellings are reviewed editorial labels.
    curated = {
        '173708': ('רמת הגולן', ['גולן'], 'region'),
        '294886': ('הנגב', ['נגב'], 'region'),
        '294850': ('השפלה', ['שפלה'], 'region'),
        '293269': ('מדבר יהודה', [], 'region'),
        '8623762': ('שוק הכרמל', ['הכרמל תל אביב'], 'market'),
    }
    by_id = {r[0]: r for r in rows}
    for id, (name, extra, kind) in curated.items():
        r = by_id[id]
        selected[id] = {'id': id, 'name': name, 'kind': kind, 'aliases': [r[1], *extra], 'lat': float(r[4]), 'lng': float(r[5])}
    # Unambiguous common search spelling, same already qualified entity.
    for place in selected.values():
        if place['id'] == '293397':
            place['aliases'].extend(['תל אביב', 'תל אביב יפו'])
    places = sorted(selected.values(), key=lambda x: x['name'])
    OUT.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(places, ensure_ascii=False, separators=(',', ':')) + '\n'
    (OUT / 'israel-places.json').write_text(payload)
    report = {
        'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source': DATA_URL, 'license': 'CC BY 4.0',
        'rawFeatures': len(rows), 'officialAuditRows': government['total'],
        'uniqueRawJoins': qualified, 'ambiguousOfficialCodes': ambiguous,
        'unmatchedOfficialCodes': unmatched, 'distributedEntries': len(places),
        'byKind': dict(collections.Counter(p['kind'] for p in places)),
        'jsonBytes': len(payload.encode()), 'gzipBytes': len(gzip.compress(payload.encode())),
        'coverage': 'Qualified locality-name matches plus explicitly reviewed regions and market. Not every locality, street or region.',
    }
    (OUT / 'israel-places-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if not isinstance(v, list)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()

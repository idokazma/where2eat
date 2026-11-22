#!/usr/bin/env python3
"""Copy each restaurant's Google photos to our own server, in batches.

Runs POST /api/admin/place-photos/store on the live API until every visible
restaurant with a Google place has been tried once. Paid, once per place: about
one Place Details call plus one photo call per stored photo (5 by default). The
API's monthly cost budget can stop a run; run again later to continue.

    API_SECRET_KEY=... python scripts/store_place_photos.py
    API_SECRET_KEY=... python scripts/store_place_photos.py --delete   # remove every copy

Owner decision 22.11.2026: Google's terms forbid storing Places photos; the
owner accepted that risk. See api/routers/place_photos.py.
"""
import argparse
import os
import sys

import requests

API = 'https://where2eat-production.up.railway.app'


def headers(key):
    # x-api-key passes the API's Origin gate; Bearer is the admin check.
    return {'Authorization': 'Bearer ' + key, 'x-api-key': key}


def run(api, key, batch=20, per_place=5):
    totals = {'restaurants_done': 0, 'photos_stored': 0, 'failed': 0, 'budget_stopped': False, 'remaining': None}
    after = 0
    while True:
        r = requests.post(f'{api}/api/admin/place-photos/store', headers=headers(key), timeout=600,
                          params={'limit': batch, 'per_place': per_place, 'after': after})
        r.raise_for_status()
        body = r.json()
        totals['restaurants_done'] += body['restaurants_done']
        totals['photos_stored'] += body['photos_stored']
        totals['failed'] += len(body['failed'])
        totals['remaining'] = body['remaining']
        print(f"+{body['restaurants_done']} restaurants, +{body['photos_stored']} photos, "
              f"{len(body['failed'])} failed, {body['remaining']} still without photos", flush=True)
        if body['budget_stopped']:
            totals['budget_stopped'] = True
            print('Stopped: the monthly cost budget was reached (COST_MONTHLY_BUDGET_USD).', flush=True)
            return totals
        if body['processed'] == 0:
            return totals
        after = body['next_after']


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--api', default=os.environ.get('WHERE2EAT_API', API))
    ap.add_argument('--batch', type=int, default=20)
    ap.add_argument('--per-place', type=int, default=5)
    ap.add_argument('--delete', action='store_true', help='remove every stored copy')
    args = ap.parse_args(argv)
    key = os.environ.get('API_SECRET_KEY')
    if not key:
        sys.exit('Set API_SECRET_KEY (the same value as on Railway).')
    if args.delete:
        r = requests.delete(f'{args.api}/api/admin/place-photos', headers=headers(key), timeout=120)
        r.raise_for_status()
        print(r.json())
        return 0
    print(run(args.api, key, args.batch, args.per_place))
    return 0


if __name__ == '__main__':
    sys.exit(main())

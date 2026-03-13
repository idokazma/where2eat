#!/usr/bin/env python3
"""
Backfill script to fix restaurants with Israeli cities but non-Israel coordinates.

Finds restaurants where the city is Israeli but the coordinates fall outside
Israel's bounding box, then re-searches Google Places with Israel location bias.

Usage:
    # Against local SQLite
    python scripts/backfill_israel_locations.py
    python scripts/backfill_israel_locations.py --dry-run

    # Against production API
    python scripts/backfill_israel_locations.py --api https://where2eat-production.up.railway.app
    python scripts/backfill_israel_locations.py --api https://where2eat-production.up.railway.app --dry-run
"""

import argparse
import json
import logging
import os
import sqlite3
import sys
import time
import requests as http_requests

# Add project root and src to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))

from google_places_enricher import GooglePlacesEnricher

# Israel bounding box
ISRAEL_LAT_MIN = 29.0
ISRAEL_LAT_MAX = 33.5
ISRAEL_LNG_MIN = 34.0
ISRAEL_LNG_MAX = 35.9

ISRAEL_CITIES = [
    'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'אשדוד', 'נתניה', 'ראשון לציון',
    'פתח תקווה', 'הרצליה', 'רמת גן', 'גבעתיים', 'כפר סבא', 'רעננה', 'הוד השרון',
    'רמת השרון', 'בני ברק', 'חולון', 'בת ים', 'אילת', 'טבריה', 'עכו', 'נצרת',
    'קיסריה', 'זכרון יעקב', 'יפו', 'רמלה', 'לוד', 'מודיעין', 'אשקלון', 'נהריה',
    'כרמיאל', 'אבן יהודה', 'גללות', 'נוגה', 'קרית ענבים', 'שרון', 'מרכז',
]

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def is_in_israel(lat, lng):
    """Check if coordinates fall within Israel's bounding box."""
    if lat is None or lng is None:
        return False
    return ISRAEL_LAT_MIN <= lat <= ISRAEL_LAT_MAX and ISRAEL_LNG_MIN <= lng <= ISRAEL_LNG_MAX


def is_israeli_city(city):
    """Check if a city name matches a known Israeli city."""
    if not city:
        return False
    return any(c in city for c in ISRAEL_CITIES)


# --- SQLite mode ---

def find_mismatched_restaurants_sqlite(db_path):
    """Find restaurants with Israeli cities but non-Israel coordinates in SQLite."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name_english, name_hebrew, city, latitude, longitude,
               google_place_id, google_name, google_rating
        FROM restaurants
        WHERE city IS NOT NULL AND city != ''
          AND latitude IS NOT NULL AND longitude IS NOT NULL
    """)
    mismatched = []
    for row in cursor.fetchall():
        city = row['city'] or ''
        if is_israeli_city(city) and not is_in_israel(row['latitude'], row['longitude']):
            mismatched.append(dict(row))
    conn.close()
    return mismatched


def update_restaurant_sqlite(conn, restaurant_id, lat, lng, place_id, google_name, google_rating):
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE restaurants
        SET latitude = ?, longitude = ?, google_place_id = ?, google_name = ?, google_rating = ?
        WHERE id = ?
    """, (lat, lng, place_id, google_name, google_rating, restaurant_id))
    conn.commit()


def clear_restaurant_coords_sqlite(conn, restaurant_id):
    cursor = conn.cursor()
    cursor.execute("UPDATE restaurants SET latitude = NULL, longitude = NULL WHERE id = ?", (restaurant_id,))
    conn.commit()


# --- API mode ---

def find_mismatched_restaurants_api(api_url):
    """Find restaurants with Israeli cities but non-Israel coordinates via API."""
    resp = http_requests.get(f"{api_url}/api/restaurants?limit=1000", timeout=30)
    resp.raise_for_status()
    data = resp.json()
    restaurants = data.get('restaurants', [])

    mismatched = []
    for r in restaurants:
        loc = r.get('location', {})
        city = loc.get('city', '')
        coords = loc.get('coordinates', {})
        lat = coords.get('latitude') or loc.get('lat')
        lng = coords.get('longitude') or loc.get('lng')

        if is_israeli_city(city) and lat and lng and not is_in_israel(lat, lng):
            mismatched.append({
                'id': r.get('id', ''),
                'name_english': r.get('name_english', ''),
                'name_hebrew': r.get('name_hebrew', ''),
                'city': city,
                'latitude': lat,
                'longitude': lng,
                'google_place_id': r.get('google_places', {}).get('place_id', ''),
            })
    return mismatched


def update_restaurant_api(api_url, restaurant, new_data):
    """Update restaurant via API."""
    restaurant_id = restaurant.get('id', '')
    if not restaurant_id:
        logger.warning(f"  No restaurant id to update via API")
        return False

    resp = http_requests.put(
        f"{api_url}/api/restaurants/{restaurant_id}",
        json=new_data,
        timeout=15,
    )
    if resp.status_code == 200:
        return True
    logger.warning(f"  API update returned {resp.status_code}: {resp.text[:200]}")
    return False


# --- Common ---

def search_correct_location(enricher, name_english, name_hebrew, city):
    """Search Google Places for the correct Israel location."""
    queries = []
    if name_hebrew and city:
        queries.append(f"{name_hebrew} {city}")
    if name_english and city:
        queries.append(f"{name_english} {city}")
    if name_hebrew:
        queries.append(f"{name_hebrew} מסעדה")
    if name_english:
        queries.append(f"{name_english} restaurant Israel")

    for query in queries:
        result = enricher._search_restaurant(query)
        if result:
            geom = result.get('geometry', {}).get('location', {})
            lat = geom.get('lat')
            lng = geom.get('lng')
            if lat and lng and is_in_israel(lat, lng):
                logger.info(f"  Found valid Israel result with query: {query}")
                return result
            else:
                logger.info(f"  Result for '{query}' still outside Israel ({lat}, {lng}), trying next...")
    return None


def main():
    parser = argparse.ArgumentParser(
        description='Backfill restaurants with Israeli cities but wrong coordinates'
    )
    parser.add_argument('--dry-run', action='store_true', help='Show what would be changed')
    parser.add_argument('--db-path', default=os.path.join(project_root, 'data', 'where2eat.db'),
                        help='Path to SQLite database (default: data/where2eat.db)')
    parser.add_argument('--api', metavar='URL', help='Use production API instead of local SQLite')
    args = parser.parse_args()

    use_api = bool(args.api)
    logger.info(f"Mode: {'API' if use_api else 'SQLite'}")
    logger.info(f"Dry run: {args.dry_run}")

    # Find mismatched restaurants
    if use_api:
        mismatched = find_mismatched_restaurants_api(args.api)
    else:
        if not os.path.exists(args.db_path):
            logger.error(f"Database not found at {args.db_path}")
            sys.exit(1)
        mismatched = find_mismatched_restaurants_sqlite(args.db_path)

    logger.info(f"Found {len(mismatched)} restaurants with Israeli city but non-Israel coordinates")

    if not mismatched:
        logger.info("Nothing to fix!")
        return

    for r in mismatched:
        display_name = r.get('name_hebrew') or r.get('name_english') or 'Unknown'
        logger.info(f"  - {display_name} in {r['city']} -> ({r['latitude']}, {r['longitude']})")

    if args.dry_run:
        logger.info(f"\n[DRY RUN] Would process {len(mismatched)} restaurants")
        return

    # Initialize enricher
    try:
        enricher = GooglePlacesEnricher()
    except ValueError as e:
        logger.error(f"Cannot initialize Google Places enricher: {e}")
        sys.exit(1)

    conn = None
    if not use_api:
        conn = sqlite3.connect(args.db_path)
        conn.row_factory = sqlite3.Row

    stats = {'fixed': 0, 'cleared': 0, 'failed': 0}

    for i, restaurant in enumerate(mismatched):
        display_name = restaurant.get('name_hebrew') or restaurant.get('name_english') or 'Unknown'
        logger.info(f"\nProcessing [{i+1}/{len(mismatched)}]: {display_name} in {restaurant['city']}")
        logger.info(f"  Current coords: ({restaurant['latitude']}, {restaurant['longitude']})")

        try:
            place_details = search_correct_location(
                enricher,
                restaurant.get('name_english', ''),
                restaurant.get('name_hebrew', ''),
                restaurant.get('city', ''),
            )

            if place_details:
                geom = place_details['geometry']['location']
                new_lat = geom['lat']
                new_lng = geom['lng']
                new_place_id = place_details.get('place_id')
                new_google_name = place_details.get('name')
                new_google_rating = place_details.get('rating')

                logger.info(f"  Updating coords to ({new_lat}, {new_lng}) - {new_google_name}")

                if use_api:
                    success = update_restaurant_api(args.api, restaurant, {
                        'location': {'lat': new_lat, 'lng': new_lng},
                        'latitude': new_lat,
                        'longitude': new_lng,
                        'google_place_id': new_place_id,
                        'google_name': new_google_name,
                        'google_rating': new_google_rating,
                    })
                    if success:
                        stats['fixed'] += 1
                    else:
                        stats['failed'] += 1
                else:
                    update_restaurant_sqlite(conn, restaurant['id'], new_lat, new_lng,
                                             new_place_id, new_google_name, new_google_rating)
                    stats['fixed'] += 1
            else:
                logger.warning(f"  No valid Israel result found. Clearing wrong coordinates.")
                if use_api:
                    # Can't easily null coordinates via API, just skip
                    logger.warning(f"  Skipping clear via API - coordinates can't be nulled remotely")
                    stats['cleared'] += 1
                    if success:
                        stats['cleared'] += 1
                    else:
                        stats['failed'] += 1
                else:
                    clear_restaurant_coords_sqlite(conn, restaurant['id'])
                    stats['cleared'] += 1

            # Rate limiting
            if i < len(mismatched) - 1:
                time.sleep(0.3)

        except Exception as e:
            logger.error(f"  Failed to process {display_name}: {e}")
            stats['failed'] += 1

    if conn:
        conn.close()

    logger.info("\n=== Backfill Summary ===")
    logger.info(f"Total processed: {len(mismatched)}")
    logger.info(f"Fixed with new coords: {stats['fixed']}")
    logger.info(f"Cleared wrong coords:  {stats['cleared']}")
    logger.info(f"Failed:                {stats['failed']}")


if __name__ == '__main__':
    main()

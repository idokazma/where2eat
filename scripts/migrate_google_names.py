#!/usr/bin/env python3
"""
Migration script: Populate google_name for existing restaurants.

Queries Google Places API using stored place_ids to fetch the correct
restaurant name and stores it in the google_name column.

Also reports potential wrong matches (where the Google name is very
different from the extracted name).

Usage:
    python scripts/migrate_google_names.py [--dry-run]
"""

import os
import sys
import time
import json
import argparse
import urllib.request
import urllib.parse

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database


def name_similarity_score(name1: str, name2: str) -> float:
    """Calculate simple similarity between two restaurant names."""
    if not name1 or not name2:
        return 0.0
    n1 = name1.lower().strip()
    n2 = name2.lower().strip()
    if n1 in n2 or n2 in n1:
        return 0.8
    set1 = set(n1.replace(' ', ''))
    set2 = set(n2.replace(' ', ''))
    if not set1 or not set2:
        return 0.0
    intersection = set1 & set2
    union = set1 | set2
    return len(intersection) / len(union)


def get_api_key():
    """Get Google Places API key from environment or .env file."""
    api_key = os.environ.get('GOOGLE_PLACES_API_KEY')
    if api_key:
        return api_key

    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('GOOGLE_PLACES_API_KEY='):
                    return line.split('=', 1)[1].strip('"').strip("'")

    return None


def fetch_place_name(api_key: str, place_id: str) -> dict:
    """Fetch place name from Google Places API by place_id."""
    url = (
        f"https://maps.googleapis.com/maps/api/place/details/json"
        f"?place_id={place_id}&fields=name,url&key={api_key}"
    )
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            if data.get('status') == 'OK':
                result = data.get('result', {})
                return {
                    'google_name': result.get('name', ''),
                    'google_url': result.get('url', ''),
                }
    except Exception as e:
        print(f"  ERROR fetching {place_id}: {e}")
    return {}


def main():
    parser = argparse.ArgumentParser(description='Migrate google_name for existing restaurants')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')
    args = parser.parse_args()

    api_key = get_api_key()
    if not api_key:
        print("ERROR: No GOOGLE_PLACES_API_KEY found in environment or .env file")
        sys.exit(1)

    db = Database()

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name_hebrew, name_english, google_place_id, google_name
            FROM restaurants
            WHERE google_place_id IS NOT NULL
              AND google_place_id != ''
              AND (google_name IS NULL OR google_name = '')
        """)
        rows = cursor.fetchall()

    if not rows:
        print("No restaurants need google_name migration.")
        return

    print(f"Found {len(rows)} restaurants to update.\n")

    updated = 0
    wrong_matches = []

    for row in rows:
        rid = row['id']
        name_hebrew = row['name_hebrew']
        name_english = row['name_english'] or ''
        place_id = row['google_place_id']

        print(f"Fetching: {name_hebrew} (place_id: {place_id[:20]}...)")

        place_data = fetch_place_name(api_key, place_id)
        google_name = place_data.get('google_name', '')

        if not google_name:
            print(f"  SKIP: No name returned from Google\n")
            continue

        # Check name similarity
        similarity_en = name_similarity_score(name_english, google_name)
        similarity_he = name_similarity_score(name_hebrew, google_name)
        best = max(similarity_en, similarity_he)

        status = "OK"
        if best < 0.15:
            status = "WRONG MATCH?"
            wrong_matches.append({
                'id': rid,
                'name_hebrew': name_hebrew,
                'name_english': name_english,
                'google_name': google_name,
                'similarity': round(best, 2),
            })

        print(f"  Google name: {google_name}")
        print(f"  Similarity: {best:.2f} [{status}]")

        if not args.dry_run:
            db.update_restaurant(rid, google_name=google_name)
            updated += 1

        print()
        time.sleep(0.2)  # Rate limiting

    print("=" * 60)
    print(f"Migration complete: {updated} restaurants updated")

    if wrong_matches:
        print(f"\nWARNING: {len(wrong_matches)} potential wrong matches detected:")
        for wm in wrong_matches:
            print(f"  - '{wm['name_hebrew']}' matched to '{wm['google_name']}' (similarity: {wm['similarity']})")
        print("\nThese restaurants may need manual review in the admin dashboard.")

    if args.dry_run:
        print("\n(Dry run - no changes were made)")


if __name__ == '__main__':
    main()

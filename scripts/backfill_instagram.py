#!/usr/bin/env python3
"""
Backfill Instagram URLs for existing restaurants.

Reads all restaurants from the database that have Google Places data
but no Instagram URL, then attempts to discover their Instagram profiles.

Usage:
    python scripts/backfill_instagram.py [--dry-run] [--limit N]
"""

import argparse
import os
import sys
import time

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import get_database
from instagram_enricher import discover_instagram


def main():
    parser = argparse.ArgumentParser(description='Backfill Instagram URLs for restaurants')
    parser.add_argument('--dry-run', action='store_true', help='Only print what would be done')
    parser.add_argument('--limit', type=int, default=0, help='Max restaurants to process (0=all)')
    args = parser.parse_args()

    db = get_database()

    # Get restaurants that have Google data but no Instagram URL
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name_hebrew, name_english, city, contact_website, google_name
            FROM restaurants
            WHERE instagram_url IS NULL
              AND google_place_id IS NOT NULL
            ORDER BY created_at DESC
        """)
        rows = [dict(r) for r in cursor.fetchall()]

    total = len(rows)
    if args.limit > 0:
        rows = rows[:args.limit]

    print(f"Found {total} restaurants without Instagram URL")
    print(f"Processing {len(rows)} restaurants{'  (dry run)' if args.dry_run else ''}")
    print()

    found = 0
    not_found = 0
    errors = 0

    for i, row in enumerate(rows):
        name = row['name_hebrew']
        print(f"[{i+1}/{len(rows)}] {name} ... ", end='', flush=True)

        try:
            result = discover_instagram(
                name_hebrew=row['name_hebrew'],
                name_english=row.get('name_english'),
                website_url=row.get('contact_website'),
                city=row.get('city'),
                google_name=row.get('google_name'),
            )

            if result:
                found += 1
                print(f"FOUND: {result}")
                if not args.dry_run:
                    with db.get_connection() as conn:
                        cursor = conn.cursor()
                        cursor.execute(
                            "UPDATE restaurants SET instagram_url = ? WHERE id = ?",
                            (result, row['id']),
                        )
            else:
                not_found += 1
                print("not found")

        except Exception as e:
            errors += 1
            print(f"ERROR: {e}")

        # Rate limit: 1 second between requests
        if i < len(rows) - 1:
            time.sleep(1)

    print()
    print(f"Results: {found} found, {not_found} not found, {errors} errors")


if __name__ == '__main__':
    main()

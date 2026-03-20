#!/usr/bin/env python3
"""
Fix typos in all restaurant host_comments using Gemini.

Usage:
    python scripts/fix_quote_typos.py [--dry-run] [--limit N]
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import get_database
from quote_fixer import fix_quote_typos


def main():
    parser = argparse.ArgumentParser(description='Fix typos in restaurant quotes')
    parser.add_argument('--dry-run', action='store_true', help='Only show changes, do not save')
    parser.add_argument('--limit', type=int, default=0, help='Max restaurants to process (0=all)')
    args = parser.parse_args()

    db = get_database()

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name_hebrew, host_comments
            FROM restaurants
            WHERE host_comments IS NOT NULL AND host_comments != ''
            ORDER BY created_at DESC
        """)
        rows = [dict(r) for r in cursor.fetchall()]

    total = len(rows)
    if args.limit > 0:
        rows = rows[:args.limit]

    print(f"Found {total} restaurants with quotes")
    print(f"Processing {len(rows)}{'  (dry run)' if args.dry_run else ''}\n")

    fixed_count = 0
    unchanged = 0

    for i, row in enumerate(rows):
        name = row['name_hebrew']
        original = row['host_comments']

        print(f"[{i+1}/{len(rows)}] {name}")
        print(f"  Original: {original[:100]}{'...' if len(original) > 100 else ''}")

        fixed = fix_quote_typos(original)

        if fixed != original:
            fixed_count += 1
            print(f"  Fixed:    {fixed[:100]}{'...' if len(fixed) > 100 else ''}")
            if not args.dry_run:
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "UPDATE restaurants SET host_comments = ? WHERE id = ?",
                        (fixed, row['id']),
                    )
        else:
            unchanged += 1
            print(f"  (no changes)")

        # Rate limit
        if i < len(rows) - 1:
            time.sleep(0.5)

    print(f"\nDone: {fixed_count} fixed, {unchanged} unchanged")


if __name__ == '__main__':
    main()

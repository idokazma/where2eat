#!/usr/bin/env python3
"""
Clean exposed Google API keys from restaurant data.

Removes photo_url fields that contain Google API keys from:
- data/restaurants_backup/ (JSON files)
- data/restaurants/ (JSON files)
- data/where2eat.db (SQLite: restaurants.image_url, restaurants.photos)

Safe to run multiple times (idempotent).
"""

import json
import os
import re
import sqlite3
import sys
from pathlib import Path


def clean_file(filepath: Path) -> dict:
    """Clean a single JSON file. Returns stats about what was cleaned."""
    stats = {"photos_cleaned": 0, "top_level_cleaned": 0}

    with open(filepath, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"  SKIP (invalid JSON): {filepath} - {e}")
            return stats

    modified = False

    # Clean photo_url from each object in the photos array
    if isinstance(data.get("photos"), list):
        for photo in data["photos"]:
            if isinstance(photo, dict) and "photo_url" in photo:
                del photo["photo_url"]
                stats["photos_cleaned"] += 1
                modified = True

    # Remove top-level photo_url if it contains an API key
    if "photo_url" in data and isinstance(data["photo_url"], str):
        if "key=" in data["photo_url"] or "AIzaSy" in data["photo_url"]:
            del data["photo_url"]
            stats["top_level_cleaned"] += 1
            modified = True

    if modified:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

    return stats


def main():
    project_root = Path(__file__).resolve().parent.parent
    dirs = [
        project_root / "data" / "restaurants_backup",
        project_root / "data" / "restaurants",
    ]

    total_files = 0
    total_modified = 0
    total_photos_cleaned = 0
    total_top_level_cleaned = 0

    for directory in dirs:
        if not directory.exists():
            print(f"Directory not found, skipping: {directory}")
            continue

        json_files = sorted(directory.glob("*.json"))
        print(f"\nProcessing {len(json_files)} files in {directory.name}/")

        for filepath in json_files:
            total_files += 1
            stats = clean_file(filepath)

            cleaned = stats["photos_cleaned"] + stats["top_level_cleaned"]
            if cleaned > 0:
                total_modified += 1
                total_photos_cleaned += stats["photos_cleaned"]
                total_top_level_cleaned += stats["top_level_cleaned"]
                print(f"  Cleaned {filepath.name}: {stats['photos_cleaned']} photo URLs, {stats['top_level_cleaned']} top-level URLs")

    print(f"\n--- Summary ---")
    print(f"Files scanned:          {total_files}")
    print(f"Files modified:         {total_modified}")
    print(f"Photo URLs removed:     {total_photos_cleaned}")
    print(f"Top-level URLs removed: {total_top_level_cleaned}")

    if total_modified == 0:
        print("\nAll JSON files are already clean.")

    # Clean SQLite database
    clean_database(project_root)


def clean_database(project_root: Path):
    """Clean API keys from the SQLite database."""
    db_path = project_root / "data" / "where2eat.db"
    if not db_path.exists():
        print(f"\nDatabase not found, skipping: {db_path}")
        return

    print(f"\n--- Cleaning database: {db_path.name} ---")
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    # Clean image_url column: null out URLs containing API keys
    affected = cur.execute(
        "UPDATE restaurants SET image_url = NULL WHERE image_url LIKE '%AIzaSy%' OR image_url LIKE '%key=%'"
    ).rowcount
    print(f"  restaurants.image_url: cleared {affected} rows")

    # Clean photos column (JSON text): remove photo_url from each photo object
    rows = cur.execute(
        "SELECT id, photos FROM restaurants WHERE photos IS NOT NULL AND photos LIKE '%photo_url%'"
    ).fetchall()
    photos_cleaned = 0
    for row_id, photos_json in rows:
        try:
            photos = json.loads(photos_json)
            if isinstance(photos, list):
                modified = False
                for photo in photos:
                    if isinstance(photo, dict) and "photo_url" in photo:
                        del photo["photo_url"]
                        modified = True
                if modified:
                    cur.execute(
                        "UPDATE restaurants SET photos = ? WHERE id = ?",
                        (json.dumps(photos, ensure_ascii=False), row_id),
                    )
                    photos_cleaned += 1
        except (json.JSONDecodeError, TypeError):
            pass
    print(f"  restaurants.photos:    cleaned {photos_cleaned} rows")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Migrate data from JSON files or SQLite to PostgreSQL.

This script can be run to migrate existing restaurant data to a new
PostgreSQL database. It supports:
- Migrating from JSON files in data/restaurants/
- Migrating from the old SQLite database

Usage:
    # Migrate from JSON files
    python scripts/migrate_to_postgres.py --source json

    # Migrate from old SQLite database
    python scripts/migrate_to_postgres.py --source sqlite

    # Dry run (no changes)
    python scripts/migrate_to_postgres.py --source json --dry-run

Environment:
    DATABASE_URL: PostgreSQL connection string (required)
    OLD_DATABASE_PATH: Path to old SQLite database (optional)
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Add src to path
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))


def migrate_from_json(dry_run: bool = False) -> dict:
    """Migrate restaurants from JSON files to PostgreSQL."""
    from models import init_db, get_db_session, Restaurant, Episode

    # Initialize database (creates tables if needed)
    if not dry_run:
        init_db()

    data_dir = Path(__file__).parent.parent / "data" / "restaurants"
    backup_dir = Path(__file__).parent.parent / "data" / "restaurants_backup"

    # Try data_dir first, then backup_dir
    source_dir = data_dir if data_dir.exists() and list(data_dir.glob("*.json")) else backup_dir

    if not source_dir.exists():
        print(f"Error: No data directory found at {data_dir} or {backup_dir}")
        return {"error": "No data directory found"}

    json_files = [f for f in source_dir.glob("*.json") if f.name != ".gitkeep"]
    print(f"Found {len(json_files)} JSON files in {source_dir}")

    if dry_run:
        print("[DRY RUN] Would migrate the following restaurants:")
        for f in json_files[:10]:
            with open(f, 'r', encoding='utf-8') as file:
                data = json.load(file)
                print(f"  - {data.get('name_hebrew', 'Unknown')}")
        if len(json_files) > 10:
            print(f"  ... and {len(json_files) - 10} more")
        return {"would_migrate": len(json_files)}

    migrated = 0
    errors = []
    episodes_created = {}

    with get_db_session() as db:
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # Handle episode info
                episode_info = data.get('episode_info', {})
                video_id = episode_info.get('video_id')
                episode_id = None

                if video_id and video_id not in episodes_created:
                    # Create episode if not exists
                    existing_episode = db.query(Episode).filter(Episode.video_id == video_id).first()
                    if existing_episode:
                        episode_id = existing_episode.id
                    else:
                        episode = Episode(
                            video_id=video_id,
                            video_url=episode_info.get('video_url', f'https://www.youtube.com/watch?v={video_id}'),
                            analysis_date=datetime.fromisoformat(episode_info['analysis_date']) if episode_info.get('analysis_date') else None,
                            food_trends=data.get('food_trends'),
                            episode_summary=data.get('episode_summary'),
                        )
                        db.add(episode)
                        db.flush()
                        episode_id = episode.id
                        episodes_created[video_id] = episode_id
                elif video_id:
                    episode_id = episodes_created[video_id]

                # Extract location data
                location = data.get('location', {})
                contact = data.get('contact_info', {})
                rating = data.get('rating', {})
                google_places = data.get('google_places', {})

                # Create restaurant
                restaurant = Restaurant(
                    id=data.get('id'),
                    episode_id=episode_id,
                    name_hebrew=data.get('name_hebrew', ''),
                    name_english=data.get('name_english'),
                    city=location.get('city'),
                    neighborhood=location.get('neighborhood'),
                    address=location.get('address'),
                    region=location.get('region', 'Center'),
                    latitude=location.get('lat'),
                    longitude=location.get('lng'),
                    cuisine_type=data.get('cuisine_type'),
                    status=data.get('status', 'open'),
                    price_range=data.get('price_range'),
                    host_opinion=data.get('host_opinion'),
                    host_comments=data.get('host_comments'),
                    menu_items=data.get('menu_items'),
                    special_features=data.get('special_features'),
                    contact_phone=contact.get('phone'),
                    contact_website=contact.get('website'),
                    contact_social=contact.get('social_media'),
                    business_news=data.get('business_news'),
                    mention_context=data.get('mention_context'),
                    google_place_id=google_places.get('place_id'),
                    google_name=google_places.get('google_name'),
                    google_url=google_places.get('google_url'),
                    google_rating=rating.get('google_rating'),
                    google_user_ratings_total=rating.get('review_count'),
                    photos=data.get('photos'),
                    enriched_at=datetime.fromisoformat(google_places['enriched_at']) if google_places.get('enriched_at') else None,
                )

                # Check if restaurant already exists
                existing = db.query(Restaurant).filter(Restaurant.id == restaurant.id).first()
                if existing:
                    print(f"  Skipping existing restaurant: {data.get('name_hebrew')}")
                    continue

                db.add(restaurant)
                migrated += 1

                if migrated % 10 == 0:
                    print(f"  Migrated {migrated} restaurants...")

            except Exception as e:
                errors.append({"file": str(json_file), "error": str(e)})
                print(f"  Error migrating {json_file.name}: {e}")

        db.commit()

    print(f"\nMigration complete!")
    print(f"  Restaurants migrated: {migrated}")
    print(f"  Episodes created: {len(episodes_created)}")
    print(f"  Errors: {len(errors)}")

    return {
        "migrated": migrated,
        "episodes": len(episodes_created),
        "errors": errors,
    }


def migrate_from_sqlite(old_db_path: str = None, dry_run: bool = False) -> dict:
    """Migrate from old SQLite database to PostgreSQL."""
    import sqlite3
    from models import init_db, get_db_session, Restaurant, Episode

    # Find old database
    if not old_db_path:
        old_db_path = os.getenv('OLD_DATABASE_PATH')
    if not old_db_path:
        # Try default locations
        possible_paths = [
            Path(__file__).parent.parent / "data" / "where2eat.db",
            Path("/app/data/where2eat.db"),
        ]
        for p in possible_paths:
            if p.exists():
                old_db_path = str(p)
                break

    if not old_db_path or not Path(old_db_path).exists():
        print(f"Error: Old SQLite database not found")
        return {"error": "Old database not found"}

    print(f"Migrating from SQLite: {old_db_path}")

    # Connect to old database
    old_conn = sqlite3.connect(old_db_path)
    old_conn.row_factory = sqlite3.Row
    old_cursor = old_conn.cursor()

    # Get counts
    old_cursor.execute("SELECT COUNT(*) FROM restaurants")
    restaurant_count = old_cursor.fetchone()[0]

    old_cursor.execute("SELECT COUNT(*) FROM episodes")
    episode_count = old_cursor.fetchone()[0]

    print(f"Found {restaurant_count} restaurants and {episode_count} episodes")

    if dry_run:
        print("[DRY RUN] Would migrate this data to PostgreSQL")
        old_conn.close()
        return {"would_migrate_restaurants": restaurant_count, "would_migrate_episodes": episode_count}

    # Initialize new database
    init_db()

    migrated_restaurants = 0
    migrated_episodes = 0
    errors = []

    with get_db_session() as db:
        # Migrate episodes first
        old_cursor.execute("SELECT * FROM episodes")
        for row in old_cursor.fetchall():
            try:
                episode = Episode(
                    id=row['id'],
                    video_id=row['video_id'],
                    video_url=row['video_url'],
                    channel_id=row.get('channel_id'),
                    channel_name=row.get('channel_name'),
                    title=row.get('title'),
                    language=row.get('language', 'he'),
                    transcript=row.get('transcript'),
                    food_trends=json.loads(row['food_trends']) if row.get('food_trends') else None,
                    episode_summary=row.get('episode_summary'),
                )
                db.merge(episode)
                migrated_episodes += 1
            except Exception as e:
                errors.append({"type": "episode", "id": row.get('id'), "error": str(e)})

        db.commit()
        print(f"Migrated {migrated_episodes} episodes")

        # Migrate restaurants
        old_cursor.execute("SELECT * FROM restaurants")
        for row in old_cursor.fetchall():
            try:
                restaurant = Restaurant(
                    id=row['id'],
                    episode_id=row.get('episode_id'),
                    name_hebrew=row['name_hebrew'],
                    name_english=row.get('name_english'),
                    city=row.get('city'),
                    neighborhood=row.get('neighborhood'),
                    address=row.get('address'),
                    region=row.get('region', 'Center'),
                    latitude=row.get('latitude'),
                    longitude=row.get('longitude'),
                    cuisine_type=row.get('cuisine_type'),
                    status=row.get('status', 'open'),
                    price_range=row.get('price_range'),
                    host_opinion=row.get('host_opinion'),
                    host_comments=row.get('host_comments'),
                    menu_items=json.loads(row['menu_items']) if row.get('menu_items') else None,
                    special_features=json.loads(row['special_features']) if row.get('special_features') else None,
                    contact_phone=row.get('contact_phone'),
                    contact_website=row.get('contact_website'),
                    contact_social=row.get('contact_social'),
                    business_news=row.get('business_news'),
                    mention_context=row.get('mention_context'),
                    google_place_id=row.get('google_place_id'),
                    google_rating=row.get('google_rating'),
                    google_user_ratings_total=row.get('google_user_ratings_total'),
                    photos=json.loads(row['photos']) if row.get('photos') else None,
                )
                db.merge(restaurant)
                migrated_restaurants += 1
            except Exception as e:
                errors.append({"type": "restaurant", "id": row.get('id'), "error": str(e)})

        db.commit()

    old_conn.close()

    print(f"\nMigration complete!")
    print(f"  Episodes migrated: {migrated_episodes}")
    print(f"  Restaurants migrated: {migrated_restaurants}")
    print(f"  Errors: {len(errors)}")

    return {
        "migrated_episodes": migrated_episodes,
        "migrated_restaurants": migrated_restaurants,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description="Migrate data to PostgreSQL")
    parser.add_argument(
        "--source",
        choices=["json", "sqlite"],
        default="json",
        help="Data source to migrate from",
    )
    parser.add_argument(
        "--old-db",
        help="Path to old SQLite database (for sqlite source)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes",
    )

    args = parser.parse_args()

    # Check DATABASE_URL
    if not os.getenv('DATABASE_URL') and not args.dry_run:
        print("Error: DATABASE_URL environment variable is required")
        print("Set it to your PostgreSQL connection string:")
        print("  export DATABASE_URL='postgresql://user:pass@host:5432/dbname'")
        sys.exit(1)

    print(f"Migration source: {args.source}")
    print(f"Dry run: {args.dry_run}")
    print()

    if args.source == "json":
        result = migrate_from_json(dry_run=args.dry_run)
    else:
        result = migrate_from_sqlite(old_db_path=args.old_db, dry_run=args.dry_run)

    print()
    print("Result:", json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

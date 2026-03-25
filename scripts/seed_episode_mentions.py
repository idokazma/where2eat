"""Seed episode_mentions table from agentic extractor JSON files.

Also imports add_to_page restaurants that are missing from the restaurants table.
"""

import json
import os
import sys
import uuid
from pathlib import Path
from glob import glob

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from database import Database


def map_host_opinion(opinion_en):
    """Map English host opinion to Hebrew for DB."""
    mapping = {
        'very_positive': 'חיובית מאוד',
        'positive': 'חיובית',
        'negative': 'שלילית',
        'mixed': 'מעורבת',
        'neutral': 'ניטרלית',
    }
    return mapping.get(opinion_en, opinion_en)


def map_price_range(price_en):
    """Map English price range to Hebrew."""
    mapping = {
        '$': 'זול',
        '$$': 'בינוני',
        '$$$': 'יקר',
        '$$$$': 'יקר מאוד',
    }
    return mapping.get(price_en, price_en)


def map_status(status_en):
    """Map English status to Hebrew."""
    mapping = {
        'open': 'פתוח',
        'new': 'חדש',
        'closed': 'נסגר',
        'temporarily_closed': 'נסגר זמנית',
        'opening_soon': 'עומד להיפתח',
    }
    return mapping.get(status_en, status_en)


def seed_extraction(db, extraction_path):
    """Process one extraction JSON file."""
    with open(extraction_path) as f:
        ext = json.load(f)

    ep = ext['episode']
    video_id = ep['video_id']
    episode_id = ep.get('episode_id', str(uuid.uuid4()))

    print(f"\n{'='*60}")
    print(f"Episode: {video_id} — {ep.get('title', 'no title')}")

    # Ensure episode exists in DB
    try:
        db.create_episode(
            video_id=video_id,
            video_url=ep.get('video_url', f'https://www.youtube.com/watch?v={video_id}'),
            title=ep.get('title', ''),
            channel_name=ep.get('channel_name', ''),
            published_at=ep.get('published_at'),
            episode_summary=ep.get('summary', ''),
            id=episode_id,
        )
        print(f"  Created episode {episode_id}")
    except Exception:
        # Episode already exists — look up its ID
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM episodes WHERE video_id = ?", (video_id,))
            row = cursor.fetchone()
            if row:
                episode_id = row['id']
                print(f"  Episode exists: {episode_id}")
            else:
                print(f"  WARNING: Could not find or create episode for {video_id}")
                return

    restaurants_added = 0
    mentions_added = 0

    for r in ext['restaurants']:
        verdict = r.get('verdict', 'add_to_page')
        if verdict == 'rejected':
            continue

        mention_level = r.get('sub_tag') or r.get('mention_level')
        timestamp = r.get('timestamp', {}) or {}
        location = r.get('location', {}) or {}
        google_places = r.get('google_places', {}) or {}
        production_db = r.get('production_db', {}) or {}

        restaurant_id = production_db.get('id') if production_db.get('exists') else None

        # For add_to_page restaurants not yet in DB, create the restaurant
        if verdict == 'add_to_page' and not restaurant_id:
            restaurant_id = str(uuid.uuid4())
            try:
                restaurant_data = {
                    'name_hebrew': r.get('name_hebrew', r.get('name_in_transcript', '')),
                    'name_english': r.get('name_english'),
                    'city': location.get('city'),
                    'neighborhood': location.get('neighborhood'),
                    'address': location.get('address'),
                    'region': location.get('region'),
                    'cuisine_type': r.get('cuisine_type'),
                    'status': map_status(r.get('status', 'open')),
                    'price_range': map_price_range(r.get('price_range', '')),
                    'host_opinion': map_host_opinion(r.get('host_opinion', '')),
                    'host_comments': r.get('host_comments'),
                    'menu_items': json.dumps(r.get('dishes_mentioned', []), ensure_ascii=False) if r.get('dishes_mentioned') else None,
                    'special_features': json.dumps(r.get('special_features', []), ensure_ascii=False) if r.get('special_features') else None,
                    'mention_context': r.get('mention_context'),
                    'mention_timestamp': timestamp.get('seconds'),
                    'google_place_id': google_places.get('place_id'),
                    'google_name': r.get('google_name'),
                    'google_rating': google_places.get('rating'),
                    'google_user_ratings_total': google_places.get('review_count'),
                    'google_url': google_places.get('google_url'),
                    'latitude': location.get('latitude'),
                    'longitude': location.get('longitude'),
                    'image_url': google_places.get('photo_url'),
                    'video_url': ep.get('video_url'),
                    'video_id': video_id,
                    'channel_name': ep.get('channel_name'),
                    'country': 'Israel',
                    'engaging_quote': (r.get('host_quotes', []) or [None])[0],
                    'contact_phone': google_places.get('phone'),
                    'contact_website': google_places.get('website'),
                    'instagram_url': google_places.get('instagram_url'),
                    'mention_level': mention_level,
                }
                restaurant_data['id'] = restaurant_id
                db.create_restaurant(
                    name_hebrew=restaurant_data.pop('name_hebrew'),
                    episode_id=episode_id,
                    **restaurant_data,
                )
                restaurants_added += 1
                print(f"  + Restaurant: {r.get('name_hebrew')} ({restaurant_id[:8]}...)")
            except Exception as e:
                print(f"  ! Failed to add restaurant {r.get('name_hebrew')}: {e}")
                restaurant_id = None

        # Save episode mention
        db.save_episode_mention({
            'episode_id': episode_id,
            'restaurant_id': restaurant_id,
            'video_id': video_id,
            'name_hebrew': r.get('name_hebrew', r.get('name_in_transcript', 'unknown')),
            'name_english': r.get('name_english'),
            'verdict': verdict,
            'mention_level': mention_level,
            'timestamp_seconds': timestamp.get('seconds'),
            'timestamp_display': timestamp.get('display'),
            'speaker': r.get('speaker'),
            'host_quotes': r.get('host_quotes'),
            'host_comments': r.get('host_comments'),
            'dishes_mentioned': r.get('dishes_mentioned'),
            'mention_context': r.get('mention_context'),
            'skip_reason': r.get('skip_reason'),
            'city': location.get('city'),
            'cuisine_type': r.get('cuisine_type'),
            'host_opinion': r.get('host_opinion'),
            'google_place_id': google_places.get('place_id'),
            'latitude': location.get('latitude'),
            'longitude': location.get('longitude'),
        })
        mentions_added += 1

    print(f"  → {restaurants_added} restaurants added, {mentions_added} mentions saved")
    return restaurants_added, mentions_added


def main():
    db_path = Path(__file__).parent.parent / "data" / "where2eat.db"
    db = Database(str(db_path))

    extraction_dir = Path(__file__).parent.parent / "agentic_extractor"
    extraction_files = sorted(extraction_dir.glob("episode_*_extraction.json"))

    if not extraction_files:
        print("No extraction files found in agentic_extractor/")
        return

    print(f"Found {len(extraction_files)} extraction files")

    total_restaurants = 0
    total_mentions = 0

    for path in extraction_files:
        result = seed_extraction(db, path)
        if result:
            total_restaurants += result[0]
            total_mentions += result[1]

    print(f"\n{'='*60}")
    print(f"TOTAL: {total_restaurants} restaurants added, {total_mentions} mentions seeded")

    # Verify
    episodes = db.get_episodes_with_mention_counts()
    print(f"\nEpisodes with mentions: {len(episodes)}")
    for e in episodes:
        print(f"  {e['video_id']}: {e.get('tasted_count', 0)} נטעם, {e.get('mentioned_count', 0)} הוזכר, {e.get('reference_only_count', 0)} ref")


if __name__ == '__main__':
    main()

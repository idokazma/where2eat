#!/usr/bin/env python3
"""
Backfill mention_timestamp_seconds for existing restaurants.

Re-analyzes cached transcripts with the updated timestamped-transcript logic
and updates only the mention_timestamp_seconds field in the API database.
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from youtube_transcript_collector import YouTubeTranscriptCollector
from claude_restaurant_analyzer import ClaudeRestaurantAnalyzer
from database import Database

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def fetch_or_load_transcript(video_id: str, video_url: str, transcripts_dir: str) -> dict | None:
    """Load cached transcript or fetch fresh one."""
    # Check for cached transcript with segments
    import glob
    pattern = os.path.join(transcripts_dir, f"{video_id}_*.json")
    cached = sorted(glob.glob(pattern), reverse=True)

    for path in cached:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if data.get('segments') and len(data['segments']) > 0:
                logger.info(f"  Using cached transcript: {os.path.basename(path)} ({len(data['segments'])} segments)")
                return data
        except Exception:
            continue

    # No cached transcript with segments — fetch fresh
    logger.info(f"  No cached transcript with segments, fetching from YouTube...")
    collector = YouTubeTranscriptCollector()
    result = collector.get_transcript(video_url, languages=['iw', 'he'])
    if not result:
        result = collector.get_transcript_auto(video_url)

    if result and result.get('segments'):
        # Cache it
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        cache_path = os.path.join(transcripts_dir, f"{video_id}_{timestamp}.json")
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        logger.info(f"  Fetched and cached: {len(result['segments'])} segments")
    return result


def build_timestamped_text(transcript_data: dict) -> str:
    """Build timestamped transcript using the analyzer's method."""
    return ClaudeRestaurantAnalyzer._build_timestamped_transcript(transcript_data)


def find_restaurant_timestamp(timestamped_text: str, restaurant_name: str) -> int | None:
    """Find the approximate timestamp where a restaurant discussion begins.

    Searches for the restaurant name in the timestamped text, then looks
    backwards for the nearest [MM:SS] marker and subtracts ~30 seconds
    to capture the start of the discussion.
    """
    import re

    # Find all occurrences of the restaurant name
    name_positions = []
    start = 0
    while True:
        pos = timestamped_text.find(restaurant_name, start)
        if pos == -1:
            break
        name_positions.append(pos)
        start = pos + 1

    if not name_positions:
        return None

    # Use the first mention
    first_mention_pos = name_positions[0]

    # Find all [MM:SS] markers and their positions
    marker_pattern = re.compile(r'\[(\d{2}):(\d{2})\]')
    markers = [(m.start(), int(m.group(1)) * 60 + int(m.group(2))) for m in marker_pattern.finditer(timestamped_text)]

    if not markers:
        return None

    # Find the marker just before the name mention
    mention_marker_seconds = 0
    for pos, seconds in markers:
        if pos <= first_mention_pos:
            mention_marker_seconds = seconds
        else:
            break

    # Subtract 30 seconds to capture discussion start (but not below 0)
    discussion_start = max(0, mention_marker_seconds - 30)
    return discussion_start


def backfill_timestamps(video_ids: list[str], api_base_url: str, dry_run: bool = False):
    """Re-compute timestamps for restaurants from the given episodes."""
    import urllib.request
    import urllib.error

    transcripts_dir = os.path.join(os.path.dirname(__file__), '..', 'transcripts')
    os.makedirs(transcripts_dir, exist_ok=True)

    # Initialize database for direct updates
    db_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'where2eat.db')
    db = Database(db_path) if os.path.exists(db_path) and not dry_run else None
    if db:
        # Add a helper method for timestamp updates
        def update_timestamp(restaurant_id: str, ts: int):
            with db.get_connection() as conn:
                conn.execute(
                    'UPDATE restaurants SET mention_timestamp = ?, updated_at = ? WHERE id = ?',
                    (ts, datetime.now().isoformat(), restaurant_id)
                )
        db.update_timestamp = update_timestamp

    # Fetch all restaurants from API
    logger.info("Fetching all restaurants from API...")
    try:
        req = urllib.request.Request(f"{api_base_url}/api/restaurants")
        with urllib.request.urlopen(req, timeout=30) as resp:
            all_data = json.loads(resp.read().decode('utf-8'))
        all_restaurants = all_data.get('restaurants', [])
        logger.info(f"Loaded {len(all_restaurants)} restaurants from API")
    except Exception as e:
        logger.error(f"Failed to fetch restaurants: {e}")
        return

    # Group restaurants by video_id
    by_video: dict[str, list[dict]] = {}
    for r in all_restaurants:
        ei = r.get('episode_info') or {}
        vid = ei.get('video_id', '')
        if vid in video_ids:
            by_video.setdefault(vid, []).append(r)

    total_updated = 0
    total_skipped = 0

    for video_id in video_ids:
        restaurants = by_video.get(video_id, [])
        if not restaurants:
            logger.warning(f"No restaurants found for video {video_id}, skipping")
            continue

        video_url = (restaurants[0].get('episode_info') or {}).get('video_url', '')
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing {video_id} ({len(restaurants)} restaurants)")
        logger.info(f"  URL: {video_url}")

        # Load or fetch transcript
        transcript = fetch_or_load_transcript(video_id, video_url, transcripts_dir)
        if not transcript or not transcript.get('segments'):
            logger.warning(f"  No transcript with segments available, skipping")
            total_skipped += len(restaurants)
            continue

        # Build timestamped text
        timestamped_text = build_timestamped_text(transcript)
        logger.info(f"  Timestamped text: {len(timestamped_text)} chars")

        for r in restaurants:
            name = r.get('name_hebrew', '')
            old_ts = r.get('mention_timestamp_seconds')
            restaurant_id = r.get('id', '')

            new_ts = find_restaurant_timestamp(timestamped_text, name)

            if new_ts is None:
                # Try google_name or english name
                gname = (r.get('google_places') or {}).get('google_name', '')
                if gname:
                    new_ts = find_restaurant_timestamp(timestamped_text, gname)
                if new_ts is None:
                    ename = r.get('name_english', '')
                    if ename:
                        new_ts = find_restaurant_timestamp(timestamped_text, ename)

            if new_ts is None:
                logger.info(f"  {name}: name not found in transcript, keeping ts={old_ts}")
                total_skipped += 1
                continue

            if old_ts == new_ts:
                logger.info(f"  {name}: timestamp unchanged ({old_ts}s)")
                total_skipped += 1
                continue

            logger.info(f"  {name}: {old_ts}s -> {new_ts}s")

            if not dry_run and restaurant_id:
                try:
                    # Update via API PUT endpoint
                    update_data = json.dumps({"mention_timestamp_seconds": new_ts}).encode('utf-8')
                    put_req = urllib.request.Request(
                        f"{api_base_url}/api/restaurants/{restaurant_id}",
                        data=update_data,
                        headers={'Content-Type': 'application/json'},
                        method='PUT'
                    )
                    with urllib.request.urlopen(put_req, timeout=10) as resp:
                        if resp.status == 200:
                            total_updated += 1
                        else:
                            logger.warning(f"    PUT returned {resp.status}")
                except urllib.error.HTTPError as e:
                    if e.code == 404:
                        logger.warning(f"    Restaurant {restaurant_id} not found, skipping")
                    else:
                        logger.error(f"    Failed to update: {e}")
                except Exception as e:
                    logger.error(f"    Failed to update: {e}")
            elif dry_run:
                total_updated += 1

    logger.info(f"\n{'='*60}")
    logger.info(f"Done! Updated: {total_updated}, Skipped: {total_skipped}")
    if dry_run:
        logger.info("(DRY RUN — no actual updates were made)")


def main():
    parser = argparse.ArgumentParser(description='Backfill restaurant mention timestamps')
    parser.add_argument('--api-url', default='https://where2eat-production.up.railway.app',
                        help='API base URL')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would change without updating')
    parser.add_argument('--video-ids', nargs='+',
                        help='Specific video IDs to process (default: latest 10)')
    args = parser.parse_args()

    if args.video_ids:
        video_ids = args.video_ids
    else:
        # Fetch latest 10 episodes from API
        import urllib.request
        logger.info("Discovering latest 10 episodes...")
        req = urllib.request.Request(f"{args.api_url}/api/restaurants")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        episodes = {}
        for r in data.get('restaurants', []):
            ei = r.get('episode_info') or {}
            vid = ei.get('video_id', '')
            pub = r.get('published_at', '')
            if vid and vid not in episodes:
                episodes[vid] = pub
        video_ids = [vid for vid, _ in sorted(episodes.items(), key=lambda x: x[1] or '', reverse=True)[:10]]
        logger.info(f"Latest 10 episodes: {video_ids}")

    backfill_timestamps(video_ids, args.api_url, dry_run=args.dry_run)


if __name__ == '__main__':
    main()

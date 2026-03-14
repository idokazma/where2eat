#!/usr/bin/env python3
"""Process all queued videos through the full pipeline."""

import os
import sys
import time

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'src'))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'scripts'))

from database import get_database
from backend_service import BackendService


def main():
    db = get_database()
    service = BackendService(db=db)

    # Get all queued videos
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, video_id, video_title, published_at FROM video_queue "
        "WHERE status = 'queued' ORDER BY rowid"
    )
    videos = cursor.fetchall()
    conn.close()

    total = len(videos)
    print(f"\n{'='*60}")
    print(f"Processing {total} videos through the pipeline")
    print(f"{'='*60}\n")

    success_count = 0
    fail_count = 0
    total_restaurants = 0

    for i, (queue_id, video_id, title, published_at) in enumerate(videos, 1):
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"\n[{i}/{total}] {title}")
        print(f"  Video: {video_id}")

        # Mark as processing
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE video_queue SET status = 'processing' WHERE id = ?",
            (queue_id,)
        )
        conn.commit()
        conn.close()

        try:
            result = service.process_video(
                video_url=video_url,
                language='he',
                save_to_db=True,
                enrich_with_google=True,
                published_at=published_at
            )

            if result.get('success'):
                restaurants_found = result.get('restaurants_found', 0)
                total_restaurants += restaurants_found
                success_count += 1
                print(f"  ✓ Found {restaurants_found} restaurants")

                # Mark completed
                conn = db.get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE video_queue SET status = 'completed', "
                    "restaurants_found = ?, episode_id = ? WHERE id = ?",
                    (restaurants_found, result.get('episode_id'), queue_id)
                )
                conn.commit()
                conn.close()
            else:
                fail_count += 1
                error = result.get('error', 'Unknown error')
                print(f"  ✗ Failed: {error}")

                # Mark failed
                conn = db.get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "UPDATE video_queue SET status = 'failed', "
                    "error_message = ? WHERE id = ?",
                    (error, queue_id)
                )
                conn.commit()
                conn.close()

        except Exception as e:
            fail_count += 1
            print(f"  ✗ Exception: {e}")

            conn = db.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE video_queue SET status = 'failed', "
                "error_message = ? WHERE id = ?",
                (str(e), queue_id)
            )
            conn.commit()
            conn.close()

        # Rate limit between videos
        if i < total:
            print("  Waiting 5s before next video...")
            time.sleep(5)

    print(f"\n{'='*60}")
    print(f"DONE: {success_count}/{total} succeeded, {fail_count} failed")
    print(f"Total restaurants found: {total_restaurants}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()

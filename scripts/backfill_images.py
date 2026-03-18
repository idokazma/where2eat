#!/usr/bin/env python3
"""
Backfill restaurant images using the multi-source priority system.

For each restaurant in the database:
1. Re-fetch photos from Google Places API (with owner attribution flags)
2. Fetch og:image from restaurant website
3. Update the database with new photo data
"""

import os
import sys
import json
import time
import logging

# Add project paths
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from database import Database
from google_places_enricher import GooglePlacesEnricher
from website_image_scraper import fetch_og_image

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def backfill_images(db_path: str = None, dry_run: bool = False):
    """Backfill images for all restaurants in the database.

    Args:
        db_path: Path to SQLite database. None uses default.
        dry_run: If True, print what would be done without modifying DB.
    """
    db = Database(db_path)
    restaurants = db.get_all_restaurants(include_episode_info=False)

    logger.info(f"Found {len(restaurants)} restaurants to backfill")

    try:
        enricher = GooglePlacesEnricher()
    except ValueError as e:
        logger.error(f"Cannot initialize enricher: {e}")
        logger.error("Set GOOGLE_PLACES_API_KEY environment variable")
        sys.exit(1)

    stats = {'updated': 0, 'skipped': 0, 'failed': 0, 'og_images_found': 0}

    for restaurant in restaurants:
        rid = restaurant['id']
        name = restaurant.get('name_hebrew', 'Unknown')
        place_id = restaurant.get('google_place_id')
        website = restaurant.get('contact_info', {}).get('website', '')

        logger.info(f"\n--- Processing: {name} (id={rid}) ---")

        update_data = {}

        # Step 1: Re-fetch photos from Google Places if we have a place_id
        if place_id:
            try:
                details = enricher._fetch_place_details(place_id)
                if details and details.get('photos'):
                    # Sort owner photos first
                    sorted_photos = sorted(
                        details['photos'],
                        key=lambda p: (not p.get('is_owner_photo', False)),
                    )
                    photos = []
                    for photo in sorted_photos[:5]:
                        photo_ref = photo.get('photo_reference')
                        if photo_ref:
                            entry = {
                                'photo_reference': photo_ref,
                                'width': photo.get('width'),
                                'height': photo.get('height'),
                            }
                            if photo.get('_new_api'):
                                entry['_new_api'] = True
                            if photo.get('is_owner_photo'):
                                entry['is_owner_photo'] = True
                            photos.append(entry)

                    if photos:
                        update_data['photos'] = photos
                        update_data['image_url'] = photos[0]['photo_reference']
                        owner_count = sum(1 for p in photos if p.get('is_owner_photo'))
                        logger.info(f"  Found {len(photos)} photos ({owner_count} owner)")
                    else:
                        logger.info(f"  No valid photos from Google Places")
                else:
                    logger.info(f"  No photos returned from Google Places")
            except Exception as e:
                logger.warning(f"  Failed to fetch photos from Google Places: {e}")
        else:
            logger.info(f"  No place_id, skipping Google Places photos")

        # Step 2: Fetch og:image from website
        if website and website.strip():
            og_image = fetch_og_image(website)
            if og_image:
                update_data['og_image_url'] = og_image
                stats['og_images_found'] += 1
                logger.info(f"  Found og:image: {og_image[:80]}...")
            else:
                logger.info(f"  No og:image found at {website}")
        else:
            logger.info(f"  No website URL, skipping og:image")

        # Step 3: Update database
        if update_data:
            if dry_run:
                logger.info(f"  [DRY RUN] Would update: {list(update_data.keys())}")
            else:
                db.update_restaurant(rid, **update_data)
                logger.info(f"  Updated: {list(update_data.keys())}")
            stats['updated'] += 1
        else:
            logger.info(f"  No updates needed")
            stats['skipped'] += 1

        # Rate limit between restaurants
        time.sleep(0.3)

    logger.info(f"\n{'='*50}")
    logger.info(f"Backfill complete!")
    logger.info(f"  Updated: {stats['updated']}")
    logger.info(f"  Skipped: {stats['skipped']}")
    logger.info(f"  Failed: {stats['failed']}")
    logger.info(f"  og:images found: {stats['og_images_found']}")
    if dry_run:
        logger.info(f"  (DRY RUN - no changes written)")

    return stats


# The enricher doesn't have a direct "fetch by place_id" method for details only.
# Monkey-patch it onto the class for the backfill.
def _fetch_place_details(self, place_id: str):
    """Fetch place details directly by place_id (for backfill).

    Returns dict in the same format as _map_new_api_response.
    """
    import requests

    # Try new API first
    try:
        details_url = f"{self.new_api_base_url}/places/{place_id}"
        headers = {
            'X-Goog-Api-Key': self.api_key,
            'X-Goog-FieldMask': 'id,displayName,photos,photos.authorAttributions,websiteUri'
        }
        response = requests.get(details_url, headers=headers)
        response.raise_for_status()
        data = response.json()
        return self._map_new_api_response(data)
    except Exception as e:
        self.logger.debug(f"New API details fetch failed: {e}")

    # Fallback to legacy
    try:
        details_url = f"{self.base_url}/details/json"
        params = {
            'place_id': place_id,
            'fields': 'photos,website',
            'key': self.api_key,
        }
        response = requests.get(details_url, params=params)
        response.raise_for_status()
        data = response.json()
        if data.get('status') == 'OK':
            return data['result']
    except Exception as e:
        self.logger.debug(f"Legacy API details fetch failed: {e}")

    return None


GooglePlacesEnricher._fetch_place_details = _fetch_place_details


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Backfill restaurant images')
    parser.add_argument('--dry-run', action='store_true', help='Print changes without writing')
    parser.add_argument('--db', type=str, help='Path to SQLite database')
    args = parser.parse_args()

    backfill_images(db_path=args.db, dry_run=args.dry_run)

#!/usr/bin/env python3
"""
Fix mismatched Google Places data for restaurant entries.

Searches Google Places Text Search API for the correct restaurants
and updates the JSON files with accurate place data.
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
if not API_KEY:
    print("ERROR: GOOGLE_PLACES_API_KEY not found in .env file")
    sys.exit(1)

RESTAURANTS_DIR = PROJECT_ROOT / "data" / "restaurants"
TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json"
PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

# Restaurants to fix: (filename, search_query, expected_name_contains)
RESTAURANTS_TO_FIX = [
    {
        "filename": "6jvskRWvQkg_al_kaber.json",
        "search_query": "אלקבר עין זיוון",
        "alt_queries": ["Al-Kaber Ein Zivan food truck", "אלקבר פוד טרק גולן"],
        # NOTE: Google may list this as "אלקע בר - ELKA BAR" which could be the same place
        # or a different one. Only match if name contains "אלקבר" / "al kaber".
        "expected_contains": ["אלקבר", "al kaber", "al-kaber", "alkaber"],
        "description": "Al-Kaber food truck in Ein Zivan, Golan Heights",
    },
    {
        "filename": "6jvskRWvQkg_hallansan.json",
        "search_query": "הלנסן קוריאנית תל אביב",
        "alt_queries": [
            "Hallansan Tel Aviv Israel",
            "hallasan korean tel aviv israel",
            "הלאנסן תל אביב",
        ],
        # Hallansan / Hallasan - Korean volcanic mountain name. Must be in Israel!
        "expected_contains": ["הלנסן", "hallansan", "hallasan", "הלאנסן"],
        "require_country": "israel",
        "description": "Hallansan Korean restaurant in Tel Aviv",
    },
    {
        "filename": "6jvskRWvQkg_hastakia.json",
        "search_query": "סטקייה ירושלים אסף גרנית",
        "alt_queries": [
            "steakiya jerusalem",
            "סטקייה הדקל ירושלים",
            "הסטקייה ירושלים מחנה יהודה",
            "steakiya assaf granit jerusalem",
        ],
        # The restaurant is called "סטקייה" (steakiya) on Google, not "הסתקיה"
        "expected_contains": ["סטקיה", "סטקייה", "steakiya", "הסתקיה"],
        "description": "Hastakia/Steakiya restaurant in Jerusalem by Assaf Granit",
    },
    {
        "filename": "6jvskRWvQkg_prino.json",
        "search_query": "פארינו פיצה אשדוד",
        "alt_queries": ["Farino pizza Ashdod", "פרינו אשדוד", "farino ashdod"],
        # Google lists it as "Farino" (פארינו) not "Prino" (פרינו)
        "expected_contains": ["פארינו", "farino", "פרינו", "prino"],
        "description": "Prino/Farino Neapolitan pizzeria in Ashdod",
    },
    {
        "filename": "6jvskRWvQkg_hshvarmvt.json",
        "search_query": "השוארמות חיפה",
        "alt_queries": ["השווארמות חיפה", "HaShawarma Haifa", "שוארמה חיפה הטובה"],
        "expected_contains": ["שוארמ", "שווארמ", "shawarma", "shwarma"],
        "description": "HaShvarmot (The Shawarma place) in Haifa",
    },
    {
        "filename": "6jvskRWvQkg_mkvmvן.json",
        "search_query": "מקומון מסעדה ירושלים",
        "alt_queries": [
            "מקומון ירושלים",
            "Makomonon restaurant Jerusalem",
            "מקומון בר ירושלים",
            "makomono jerusalem",
        ],
        "expected_contains": ["מקומון", "makomonon", "makomon", "makomono"],
        "description": "Makomonon restaurant (likely Jerusalem based on engaging_quote)",
    },
    {
        "filename": "6jvskRWvQkg_shvk.json",
        "search_query": "מסעדת הגפן תל אביב",
        "alt_queries": ["הגפן חצר יין תל אביב", "HaGefen restaurant Tel Aviv", "מסעדת שוק תל אביב"],
        # Based on engaging_quote: the owner had "שוק" restaurant, closed it, and opened "הגפן"
        "expected_contains": ["הגפן", "gefen", "שוק", "shuk"],
        "require_country": "israel",
        "description": "Shuk restaurant (now called HaGefen based on engaging_quote)",
    },
]


def search_places(query: str) -> list:
    """Search Google Places Text Search API."""
    params = {
        "query": query,
        "key": API_KEY,
        "language": "iw",
        "region": "il",
    }
    resp = requests.get(TEXT_SEARCH_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") == "REQUEST_DENIED":
        print(f"  API ERROR: {data.get('error_message', 'Request denied')}")
        return []

    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        print(f"  API status: {data.get('status')} - {data.get('error_message', '')}")

    return data.get("results", [])


def get_place_details(place_id: str) -> dict:
    """Get detailed place information including photos and hours."""
    params = {
        "place_id": place_id,
        "key": API_KEY,
        "language": "iw",
        "fields": "name,formatted_address,geometry,rating,user_ratings_total,photos,opening_hours,url,price_level,business_status",
    }
    resp = requests.get(PLACE_DETAILS_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    return data.get("result", {})


def name_matches(google_name: str, expected_contains: list) -> bool:
    """Check if the Google name contains any expected substring."""
    google_lower = google_name.lower()
    for expected in expected_contains:
        if expected.lower() in google_lower:
            return True
    return False


# Israeli cities to recognize addresses as being in Israel
ISRAELI_CITIES = [
    "תל אביב", "ירושלים", "חיפה", "באר שבע", "אשדוד", "אשקלון",
    "ראשון לציון", "פתח תקווה", "נתניה", "רמת גן", "הרצליה",
    "רחובות", "כפר סבא", "רעננה", "הוד השרון", "בית שמש",
    "tel aviv", "jerusalem", "haifa", "ashdod", "israel", "ישראל",
    "בית זית", "עין זיוון", "רמת הגולן", "יפו",
]


def is_in_israel(address: str) -> bool:
    """Check if an address is in Israel based on known city names."""
    addr_lower = address.lower()
    for city in ISRAELI_CITIES:
        if city.lower() in addr_lower:
            return True
    return False


def update_restaurant_file(filepath: Path, place_result: dict, place_details: dict) -> None:
    """Update a restaurant JSON file with corrected Google Places data."""
    with open(filepath, "r", encoding="utf-8") as f:
        restaurant = json.load(f)

    # Update google_places section
    restaurant["google_places"] = {
        "place_id": place_result.get("place_id", ""),
        "google_name": place_details.get("name", place_result.get("name", "")),
        "google_url": place_details.get("url", ""),
        "enriched_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "formatted_address": place_details.get("formatted_address", place_result.get("formatted_address", "")),
    }

    # Update location coordinates
    geometry = place_details.get("geometry") or place_result.get("geometry", {})
    location = geometry.get("location", {})
    if location:
        restaurant["location"]["coordinates"] = {
            "latitude": location.get("lat"),
            "longitude": location.get("lng"),
        }

    # Update address
    formatted_address = place_details.get("formatted_address") or place_result.get("formatted_address", "")
    if formatted_address:
        restaurant["location"]["address"] = formatted_address
        restaurant["location"]["full_address"] = formatted_address

    # Update rating
    rating = place_details.get("rating") or place_result.get("rating")
    total_reviews = place_details.get("user_ratings_total") or place_result.get("user_ratings_total")
    price_level = place_details.get("price_level")
    restaurant["rating"] = {
        "google_rating": rating,
        "total_reviews": total_reviews,
        "price_level": price_level,
    }

    # Update photos from details
    photos_data = place_details.get("photos", [])
    if photos_data:
        restaurant["photos"] = [
            {
                "photo_reference": p.get("photo_reference", ""),
                "width": p.get("width", 0),
                "height": p.get("height", 0),
            }
            for p in photos_data[:5]  # Limit to 5 photos
        ]

    # Update business hours from details
    opening_hours = place_details.get("opening_hours", {})
    if opening_hours:
        restaurant["business_hours"] = {
            "open_now": opening_hours.get("open_now", False),
            "weekday_text": opening_hours.get("weekday_text", []),
        }

    # Contact info - update website with Google URL
    if place_details.get("url"):
        restaurant["contact_info"]["website"] = place_details["url"]

    restaurant["google_places_enriched"] = True
    restaurant["google_places_attempted"] = True

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(restaurant, f, ensure_ascii=False, indent=2)


def main():
    print("=" * 70)
    print("Google Places Fix Script")
    print(f"Restaurants directory: {RESTAURANTS_DIR}")
    print(f"API Key: {API_KEY[:8]}...{API_KEY[-4:]}")
    print("=" * 70)

    updated = []
    skipped = []
    failed = []

    for entry in RESTAURANTS_TO_FIX:
        filepath = RESTAURANTS_DIR / entry["filename"]
        print(f"\n{'─' * 60}")
        print(f"Restaurant: {entry['description']}")
        print(f"File: {entry['filename']}")

        if not filepath.exists():
            print(f"  WARNING: File not found: {filepath}")
            failed.append(entry["filename"])
            continue

        # Try primary query first, then alternates
        all_queries = [entry["search_query"]] + entry.get("alt_queries", [])
        best_match = None
        best_details = None

        require_country = entry.get("require_country")

        for query in all_queries:
            print(f"\n  Searching: \"{query}\"")
            time.sleep(0.3)  # Rate limiting

            results = search_places(query)
            if not results:
                print(f"  No results found.")
                continue

            # Show top 3 results
            for i, r in enumerate(results[:5]):
                name = r.get("name", "N/A")
                addr = r.get("formatted_address", "N/A")
                rating = r.get("rating", "N/A")
                is_name_match = name_matches(name, entry["expected_contains"])
                country_ok = True
                if require_country and is_name_match:
                    country_ok = is_in_israel(addr)
                match_flag = " <-- MATCH" if (is_name_match and country_ok) else ""
                if is_name_match and not country_ok:
                    match_flag = " <-- NAME MATCH but WRONG COUNTRY"
                print(f"    [{i+1}] {name} | {addr} | Rating: {rating}{match_flag}")

            # Find first matching result (with country filter)
            for r in results[:5]:
                if name_matches(r.get("name", ""), entry["expected_contains"]):
                    addr = r.get("formatted_address", "")
                    if require_country:
                        if not is_in_israel(addr):
                            continue
                    best_match = r
                    break

            if best_match:
                break  # Found a match, stop trying queries

        if best_match:
            place_id = best_match["place_id"]
            print(f"\n  MATCH FOUND: {best_match['name']}")
            print(f"  Place ID: {place_id}")

            # Get detailed info
            print(f"  Fetching place details...")
            time.sleep(0.3)
            best_details = get_place_details(place_id)

            if best_details:
                detail_name = best_details.get("name", best_match["name"])
                detail_addr = best_details.get("formatted_address", "")
                detail_rating = best_details.get("rating", "N/A")
                detail_reviews = best_details.get("user_ratings_total", "N/A")
                detail_url = best_details.get("url", "")
                num_photos = len(best_details.get("photos", []))
                print(f"  Details: {detail_name}")
                print(f"  Address: {detail_addr}")
                print(f"  Rating: {detail_rating} ({detail_reviews} reviews)")
                print(f"  Google URL: {detail_url}")
                print(f"  Photos: {num_photos}")

            # Update the file
            update_restaurant_file(filepath, best_match, best_details or {})
            print(f"  UPDATED: {entry['filename']}")
            updated.append(entry["filename"])
        else:
            print(f"\n  WARNING: No matching result found for {entry['description']}")
            print(f"  Expected name containing: {entry['expected_contains']}")
            print(f"  SKIPPED - file not modified.")
            skipped.append(entry["filename"])

    # Summary
    print(f"\n{'=' * 70}")
    print("SUMMARY")
    print(f"{'=' * 70}")
    print(f"Updated: {len(updated)}")
    for f in updated:
        print(f"  + {f}")
    print(f"Skipped (no match): {len(skipped)}")
    for f in skipped:
        print(f"  ~ {f}")
    print(f"Failed: {len(failed)}")
    for f in failed:
        print(f"  ! {f}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()

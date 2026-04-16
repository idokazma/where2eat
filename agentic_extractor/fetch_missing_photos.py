#!/usr/bin/env python3
"""
Fetch Google Places photos for restaurants missing images in extraction JSONs.
Uses the new Google Places API v1.
"""

import json
import glob
import time
import requests
import os

API_KEY = "AIzaSyCo7o6jQghstjLaPIdPIJUB7pL8j_e8lcQ"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

HEADERS = {
    "X-Goog-Api-Key": API_KEY,
    "Content-Type": "application/json",
}


def text_search(query: str) -> dict | None:
    """Search for a place using text query. Returns place dict or None."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        **HEADERS,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos,places.googleMapsUri",
    }
    body = {"textQuery": query, "languageCode": "he"}
    resp = requests.post(url, headers=headers, json=body, timeout=15)
    if resp.status_code != 200:
        print(f"  [ERROR] Text search failed ({resp.status_code}): {resp.text[:200]}")
        return None
    data = resp.json()
    places = data.get("places", [])
    if not places:
        print(f"  [WARN] No results for query: {query}")
        return None
    return places[0]


def place_details(place_id: str) -> dict | None:
    """Get place details by place_id. Returns place dict or None."""
    url = f"https://places.googleapis.com/v1/places/{place_id}"
    headers = {
        **HEADERS,
        "X-Goog-FieldMask": "id,displayName,photos,googleMapsUri",
    }
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code != 200:
        print(f"  [ERROR] Details failed ({resp.status_code}): {resp.text[:200]}")
        return None
    return resp.json()


def get_photo_url(place: dict) -> str | None:
    """Extract photo URL from a Places API response."""
    photos = place.get("photos", [])
    if not photos:
        return None
    photo_name = photos[0].get("name")
    if not photo_name:
        return None
    return f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800&key={API_KEY}"


def main():
    # 1. Load all extraction files
    pattern = os.path.join(BASE_DIR, "episode_*_extraction.json")
    files = sorted(glob.glob(pattern))
    print(f"Found {len(files)} extraction files\n")

    # 2. Collect all restaurants missing photos, grouped by name_hebrew
    # Structure: {name_hebrew: {info, occurrences: [(file, restaurant_index)]}}
    missing = {}
    for filepath in files:
        with open(filepath) as f:
            data = json.load(f)
        for idx, r in enumerate(data.get("restaurants", [])):
            if r.get("verdict") != "add_to_page":
                continue
            gp = r.get("google_places", {})
            if gp.get("photo_url"):
                continue
            name_heb = r["name_hebrew"]
            if name_heb not in missing:
                missing[name_heb] = {
                    "name_english": r.get("name_english") or "",
                    "city": r.get("location", {}).get("city") or "",
                    "place_id": gp.get("place_id"),
                    "occurrences": [],
                }
            # If this occurrence has a place_id and previous didn't, update
            if gp.get("place_id") and not missing[name_heb]["place_id"]:
                missing[name_heb]["place_id"] = gp["place_id"]
            missing[name_heb]["occurrences"].append((filepath, idx))

    print(f"Found {len(missing)} unique restaurants missing photos")
    with_pid = sum(1 for v in missing.values() if v["place_id"])
    without_pid = len(missing) - with_pid
    print(f"  - {with_pid} with place_id (details lookup)")
    print(f"  - {without_pid} without place_id (text search needed)")
    print()

    # 3. Fetch photos
    resolved = 0
    failed = 0
    results = {}  # name_hebrew -> {photo_url, place_id, google_url}

    for name_heb, info in missing.items():
        name_eng = info["name_english"]
        city = info["city"]
        place_id = info["place_id"]

        print(f"[{resolved + failed + 1}/{len(missing)}] {name_heb} ({name_eng}) - {city or 'unknown'}")

        photo_url = None
        new_place_id = None
        google_url = None

        if place_id:
            # Has place_id -> use details API
            print(f"  Using place details for {place_id}")
            place = place_details(place_id)
            if place:
                photo_url = get_photo_url(place)
                google_url = place.get("googleMapsUri")
        else:
            # No place_id -> text search
            query = f"{name_eng} {city} Israel" if city else f"{name_eng} restaurant Israel"
            print(f"  Text search: '{query}'")
            place = text_search(query)
            if place:
                new_place_id = place.get("id")
                google_url = place.get("googleMapsUri")
                photo_url = get_photo_url(place)
                display = place.get("displayName", {}).get("text", "")
                print(f"  Found: {display} (place_id: {new_place_id})")

        if photo_url:
            print(f"  Photo URL obtained")
            resolved += 1
            results[name_heb] = {
                "photo_url": photo_url,
                "place_id": new_place_id,  # Only set if newly found
                "google_url": google_url,
            }
        else:
            print(f"  No photo found")
            failed += 1

        time.sleep(0.5)

    print(f"\n--- Results ---")
    print(f"Resolved: {resolved}/{len(missing)}")
    print(f"Failed: {failed}/{len(missing)}")

    # 4. Write results back to JSON files
    if not results:
        print("No results to write.")
        return

    files_updated = set()
    occurrences_updated = 0

    for name_heb, result in results.items():
        info = missing[name_heb]
        for filepath, idx in info["occurrences"]:
            with open(filepath) as f:
                data = json.load(f)

            restaurant = data["restaurants"][idx]
            gp = restaurant.get("google_places", {})

            # Update photo_url
            gp["photo_url"] = result["photo_url"]

            # Update place_id if newly found
            if result["place_id"] and not gp.get("place_id"):
                gp["place_id"] = result["place_id"]

            # Update google_url if we got one and it was missing
            if result["google_url"] and not gp.get("google_url"):
                gp["google_url"] = result["google_url"]

            restaurant["google_places"] = gp

            with open(filepath, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            files_updated.add(filepath)
            occurrences_updated += 1

    print(f"\nUpdated {occurrences_updated} occurrences across {len(files_updated)} files")
    for fp in sorted(files_updated):
        print(f"  - {os.path.basename(fp)}")


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    main()

#!/usr/bin/env python3
"""
Fetch Google Places photos for restaurants missing images in extraction JSONs.
V2: Clears wrong matches from v1, uses Hebrew name queries, validates results.
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

# Restaurants where v1 matched the WRONG place - clear their photo_url and bad place_id
WRONG_MATCHES_V1 = {
    "זוזו חנה",       # matched "Zuzu" in TLV instead of Zuzu Hana at Tzomet Migdal
    "הסתקייה",        # matched "steakiya" instead of Hastakia Jerusalem
    "הלנסן",          # matched "הסלון" instead of Hallansan Korean
    "ריבנו",          # matched "אורבנו" instead of Buono/Rivano
    "חממה",           # matched "יוסי חממה" instead of Hamama
    "בנגר",           # matched "בלייז בר" instead of Banger
    "גיוזה תופס",     # matched "San Mai Gyoza Bar" instead of Gyoza Tofes
    "סוד",            # matched "שיח סוד" instead of Sod wine bar
    "הפילמניה",       # matched "בית חבד" instead of HaPelmania
    "זות",            # matched "זותא פיצה" instead of Zot
    "דוכן של אילנה דן בשוק לווינסקי",  # matched market, not the stall
    "אלקבר",          # matched "אלקע בר" instead of Al Kaber
}

# Place IDs that were wrongly written by v1 - must be cleared
WRONG_PLACE_IDS_V1 = {
    "ChIJgZw-2zpNHRURIpkB8ULJQRU",  # Zuzu
    "ChIJf6EM_LvXAhURgDIqJLgFhBI",  # steakiya
    "ChIJT1hbDaNLHRURWxHp_sCfxoE",  # הסלון
    "ChIJ4Y55LrlMHRURc2z8zcT6c24",  # אורבנו
    "ChIJibywBw9LHRURxP2xuhWmpdA",  # יוסי חממה
    "ChIJYbCGpvbaAhUR0VQv_LGzmHI",  # בלייז בר
    "ChIJsXJdMwBNHRUROw1JFfyHg5Q",  # San Mai Gyoza
    "ChIJgUzg1jrWAhURDvr4zvHetEI",  # שיח סוד
    "ChIJq2aA9smkHRURLxTJAT7T08c",  # בית חבד
    "ChIJWdsiL4hLHRURZY3Ea35S5ZE",  # זותא פיצה
    "ChIJcdNA6J1MHRUR0mtN6aZ6w4k",  # שוק לוינסקי
    "ChIJc9l9-wKvHhURAAFIs4BGpC8",  # אלקע בר
}

# Custom search queries for better matching
CUSTOM_QUERIES = {
    "בואו": "בואו מסעדה תל אביב יפו",
    "זוזו חנה": "זוזו חנה מסעדה מגדל כנרת",
    "זהרה": "זהרה מסעדה ירושלים",
    "צ'וטה": "צ'וטה מסעדה ירושלים מחנה יהודה",
    "מיז'נה": "מיז'נה שף חיפה",
    "אלקבר": "אלקבר מסעדה דרוזית עין זיוון גולן",
    "הסתקייה": "הסתקייה מסעדה ירושלים עיר העתיקה",
    "הלנסן": "הלנסן מסעדה קוריאנית תל אביב",
    "מושיק": "מושיק מסעדת שף תל אביב",
    "ריבנו": "פרינו מסעדה תל אביב",  # Rivano/Prino same place
    "גריל 65": "גריל 65 מסעדה הודית פרדס חנה",
    "מייקיז": "מייקיז פיצה אפולה",
    "חממה": "חממה בר מסעדה תל אביב לילינבלום",
    "המחלבה הקטנה": "המחלבה הקטנה גבינות",
    "בצ'וטה": "צ'וטה מסעדה ירושלים מחנה יהודה",
    "בנגר": "בנגר המבורגר ירושלים",
    "גיוזה תופס": "גיוזה תופס שוק הכרמל",
    "ממתקי אל דמסקי": "ממתקי אל דמשקי כנאפה ירושלים שוק מחנה יהודה",
    "מלא": "מלא בר קפה תל אביב",
    "שוארמה אסולין": "שוארמה אסולין נווה אביבים תל אביב",
    "סוד": "סוד בר סושי ויין ירושלים",
    "הפילמניה": "הפלמניה מסעדה רוסית פלמנים טירת כרמל",
    "זות": "זות בר מסעדה תל אביב",
    "סולט": "סולט מסעדה חיפה",
    "ג'אנגו": "ג'אנגו בורגר תל אביב",
    "דנבר": "דנבר מסעדה כפר סבא",
    "ימה": "ימה מסעדה תל אביב",
    "דוכן של אילנה דן בשוק לווינסקי": "אילנה דן שוק לוינסקי תל אביב",
}


def text_search(query: str) -> dict | None:
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        **HEADERS,
        "X-Goog-FieldMask": "places.id,places.displayName,places.photos,places.googleMapsUri,places.formattedAddress",
    }
    body = {"textQuery": query, "languageCode": "he"}
    resp = requests.post(url, headers=headers, json=body, timeout=15)
    if resp.status_code != 200:
        print(f"  [ERROR] Text search failed ({resp.status_code}): {resp.text[:200]}")
        return None
    data = resp.json()
    places = data.get("places", [])
    if not places:
        print(f"  [WARN] No results for: {query}")
        return None
    return places[0]


def place_details(place_id: str) -> dict | None:
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
    photos = place.get("photos", [])
    if not photos:
        return None
    photo_name = photos[0].get("name")
    if not photo_name:
        return None
    return f"https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=800&key={API_KEY}"


def main():
    pattern = os.path.join(BASE_DIR, "episode_*_extraction.json")
    files = sorted(glob.glob(pattern))
    print(f"Found {len(files)} extraction files\n")

    # Step 1: Clear wrong matches from v1
    print("=== STEP 1: Clearing wrong matches from v1 ===\n")
    cleared = 0
    for filepath in files:
        with open(filepath) as f:
            data = json.load(f)
        modified = False
        for r in data.get("restaurants", []):
            if r.get("verdict") != "add_to_page":
                continue
            name_heb = r["name_hebrew"]
            gp = r.get("google_places", {})
            if name_heb in WRONG_MATCHES_V1 and gp.get("photo_url"):
                print(f"  Clearing wrong photo for: {name_heb}")
                gp["photo_url"] = None
                # Also clear wrong place_id if it was written by v1
                if gp.get("place_id") in WRONG_PLACE_IDS_V1:
                    print(f"    Also clearing wrong place_id: {gp['place_id']}")
                    gp["place_id"] = None
                if gp.get("google_url") and not gp.get("place_id"):
                    gp["google_url"] = None
                r["google_places"] = gp
                modified = True
                cleared += 1
        if modified:
            with open(filepath, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nCleared {cleared} wrong matches\n")

    # Step 2: Collect all restaurants still missing photos
    print("=== STEP 2: Collecting restaurants still missing photos ===\n")
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
            if gp.get("place_id") and not missing[name_heb]["place_id"]:
                missing[name_heb]["place_id"] = gp["place_id"]
            missing[name_heb]["occurrences"].append((filepath, idx))

    print(f"Found {len(missing)} unique restaurants still missing photos")
    with_pid = sum(1 for v in missing.values() if v["place_id"])
    print(f"  - {with_pid} with place_id")
    print(f"  - {len(missing) - with_pid} without place_id")
    print()

    # Step 3: Fetch photos
    print("=== STEP 3: Fetching photos ===\n")
    resolved = 0
    failed = 0
    results = {}

    for name_heb, info in missing.items():
        name_eng = info["name_english"]
        city = info["city"]
        place_id = info["place_id"]

        print(f"[{resolved + failed + 1}/{len(missing)}] {name_heb} ({name_eng})")

        photo_url = None
        new_place_id = None
        google_url = None

        # Strategy 1: Try place details if we have a place_id
        if place_id:
            print(f"  Trying details for {place_id}...")
            place = place_details(place_id)
            if place:
                photo_url = get_photo_url(place)
                google_url = place.get("googleMapsUri")
                if photo_url:
                    print(f"  Got photo from details API")

        # Strategy 2: Text search with Hebrew name
        if not photo_url:
            query = CUSTOM_QUERIES.get(name_heb)
            if not query:
                if city:
                    query = f"{name_heb} מסעדה {city}"
                else:
                    query = f"{name_heb} מסעדה ישראל"

            print(f"  Text search: '{query}'")
            place = text_search(query)
            if place:
                display = place.get("displayName", {}).get("text", "")
                addr = place.get("formattedAddress", "")
                found_id = place.get("id")
                print(f"  Found: {display} | {addr}")
                photo_url = get_photo_url(place)
                google_url = place.get("googleMapsUri")
                if not place_id:
                    new_place_id = found_id

        if photo_url:
            print(f"  Photo URL obtained")
            resolved += 1
            results[name_heb] = {
                "photo_url": photo_url,
                "place_id": new_place_id,
                "google_url": google_url,
            }
        else:
            print(f"  FAILED - no photo found")
            failed += 1

        time.sleep(0.5)

    # Step 4: Write results
    print(f"\n{'='*50}")
    print(f"RESULTS: {resolved}/{len(missing)} resolved, {failed}/{len(missing)} failed")
    print(f"{'='*50}")

    if failed > 0:
        print(f"\nFailed restaurants:")
        for name_heb in missing:
            if name_heb not in results:
                print(f"  - {name_heb}")

    if not results:
        print("\nNo results to write.")
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

            gp["photo_url"] = result["photo_url"]
            if result["place_id"] and not gp.get("place_id"):
                gp["place_id"] = result["place_id"]
            if result["google_url"] and not gp.get("google_url"):
                gp["google_url"] = result["google_url"]

            restaurant["google_places"] = gp

            with open(filepath, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            files_updated.add(filepath)
            occurrences_updated += 1

    print(f"\nUpdated {occurrences_updated} restaurant entries across {len(files_updated)} files:")
    for fp in sorted(files_updated):
        print(f"  - {os.path.basename(fp)}")


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    main()

"""Fix extraction data quality issues.

Resolves wrong Google Places matches, missing photos, and missing data
by making fresh API calls and updating the DB.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from database import Database

# Load API key
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")
API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

if not API_KEY:
    print("ERROR: GOOGLE_PLACES_API_KEY not found in .env")
    sys.exit(1)

db = Database(str(Path(__file__).parent.parent / "data" / "where2eat.db"))


def google_find_place(query):
    """Search Google Places for a restaurant."""
    encoded = urllib.parse.quote(query)
    url = f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={encoded}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key={API_KEY}"
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())
        if data.get("candidates"):
            return data["candidates"][0]
    except Exception as e:
        print(f"    Find place error: {e}")
    return None


def google_place_details(place_id):
    """Get full details for a Google Place ID."""
    url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,photos,geometry,url,price_level&key={API_KEY}"
    try:
        with urllib.request.urlopen(url) as resp:
            data = json.loads(resp.read())
        return data.get("result", {})
    except Exception as e:
        print(f"    Details error: {e}")
    return {}


def resolve_photo(photo_ref):
    """Resolve a Google Places photo reference to a permanent URL."""
    url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={photo_ref}&key={API_KEY}"
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req) as resp:
            return resp.url
    except urllib.error.HTTPError as e:
        if e.status in (301, 302, 303, 307, 308):
            return e.headers.get('Location', '')
    except Exception as e:
        print(f"    Photo resolve error: {e}")
    return None


def update_restaurant_in_db(restaurant_id, updates):
    """Update restaurant fields in the DB."""
    if not restaurant_id:
        return False
    set_clauses = []
    values = []
    for key, val in updates.items():
        set_clauses.append(f"{key} = ?")
        values.append(val)
    if not set_clauses:
        return False
    values.append(restaurant_id)
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE restaurants SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values
        )
        return cursor.rowcount > 0


def find_restaurant_id_by_name(name_hebrew, video_id=None):
    """Find a restaurant ID by Hebrew name and optionally video_id."""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        if video_id:
            cursor.execute(
                "SELECT id FROM restaurants WHERE name_hebrew = ? AND video_id = ?",
                (name_hebrew, video_id)
            )
        else:
            cursor.execute(
                "SELECT id FROM restaurants WHERE name_hebrew = ?",
                (name_hebrew,)
            )
        row = cursor.fetchone()
        return row['id'] if row else None


def find_restaurant_id_by_place_id(google_place_id):
    """Find a restaurant ID by Google Place ID."""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM restaurants WHERE google_place_id = ?",
            (google_place_id,)
        )
        row = cursor.fetchone()
        return row['id'] if row else None


def enrich_restaurant(name, city, search_variants=None):
    """Full enrichment: find place, get details, resolve photo."""
    variants = [f"{name} {city}"] if city else [name]
    if search_variants:
        variants = search_variants + variants

    candidate = None
    for query in variants:
        print(f"    Searching: {query}")
        candidate = google_find_place(query)
        if candidate:
            print(f"    Found: {candidate.get('name')} @ {candidate.get('formatted_address', '?')}")
            break
        time.sleep(0.3)

    if not candidate:
        print(f"    NOT FOUND on Google Places")
        return None

    place_id = candidate['place_id']
    time.sleep(0.3)

    details = google_place_details(place_id)
    if not details:
        return None

    photo_url = None
    photos = details.get('photos', [])
    if photos:
        ref = photos[0].get('photo_reference')
        if ref:
            photo_url = resolve_photo(ref)
            time.sleep(0.3)

    geo = details.get('geometry', {}).get('location', {})

    return {
        'google_place_id': place_id,
        'google_name': details.get('name'),
        'google_rating': details.get('rating'),
        'google_user_ratings_total': details.get('user_ratings_total'),
        'latitude': geo.get('lat'),
        'longitude': geo.get('lng'),
        'image_url': photo_url,
        'address': details.get('formatted_address'),
        'contact_phone': details.get('formatted_phone_number'),
        'contact_website': details.get('website'),
        'google_url': details.get('url'),
    }


def fix_photo_only(place_id):
    """Just resolve the photo for an existing place_id."""
    details = google_place_details(place_id)
    photos = details.get('photos', [])
    if photos:
        ref = photos[0].get('photo_reference')
        if ref:
            url = resolve_photo(ref)
            time.sleep(0.3)
            return url
    return None


# ============================================================================
# FIXES
# ============================================================================

print("=" * 70)
print("FIXING EXTRACTION DATA QUALITY ISSUES")
print("=" * 70)

fixes_applied = 0
fixes_failed = 0

# --- CRITICAL FIX 1: רב יולו → רביולון (w-n3zFXTuGM) ---
print("\n--- CRITICAL: רב יולו → רביולון (w-n3zFXTuGM) ---")
rid = find_restaurant_id_by_name("רב יולו", "w-n3zFXTuGM")
if rid:
    result = enrich_restaurant("רביולון", "אשקלון", ["רביולון אשקלון", "Raviolon Ashkelon"])
    if result:
        result['name_hebrew'] = 'רביולון'
        result['name_english'] = 'Raviolon'
        if update_restaurant_in_db(rid, result):
            print(f"    ✅ Fixed: רב יולו → רביולון ({rid[:8]})")
            fixes_applied += 1
        else:
            print(f"    ❌ DB update failed")
            fixes_failed += 1
    else:
        print(f"    ❌ Could not find רביולון on Google")
        fixes_failed += 1
else:
    print(f"    ⏭️ רב יולו not in DB (may already be fixed)")

# --- CRITICAL FIX 2: ימה wrong coordinates (w-n3zFXTuGM) ---
print("\n--- CRITICAL: ימה wrong coordinates (w-n3zFXTuGM) ---")
rid = find_restaurant_id_by_name("ימה", "w-n3zFXTuGM")
if not rid:
    rid = find_restaurant_id_by_name("ימה גלילות", "w-n3zFXTuGM")
if rid:
    result = enrich_restaurant("ימה גלילות", "", ["ימה ביג גלילות", "Yama Glilot", "ימה מסעדה גלילות"])
    if result:
        if update_restaurant_in_db(rid, result):
            print(f"    ✅ Fixed coordinates ({rid[:8]})")
            fixes_applied += 1
        else:
            print(f"    ❌ DB update failed")
            fixes_failed += 1
    else:
        print(f"    ❌ Could not find ימה גלילות on Google")
        fixes_failed += 1
else:
    print(f"    ⏭️ ימה not in DB")

# --- MISSING PHOTOS (have place_id, no photo) ---
print("\n--- RESOLVING MISSING PHOTOS ---")
photo_fixes = [
    ("צ'וטה", None),
    ("גריל 65", None),
    ("שוארמה אסולין", None),
    ("ג'אנגו", "w-n3zFXTuGM"),
    ("דנבר", "w-n3zFXTuGM"),
    ("סולט", None),
]

for name, vid in photo_fixes:
    rid = find_restaurant_id_by_name(name, vid) if vid else find_restaurant_id_by_name(name)
    if not rid:
        print(f"  {name}: ⏭️ not in DB")
        continue

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT google_place_id, image_url FROM restaurants WHERE id = ?", (rid,))
        row = cursor.fetchone()

    if row and row['image_url']:
        print(f"  {name}: ⏭️ already has image")
        continue

    if row and row['google_place_id']:
        print(f"  {name}: resolving photo for {row['google_place_id']}...")
        photo = fix_photo_only(row['google_place_id'])
        if photo:
            if update_restaurant_in_db(rid, {'image_url': photo}):
                print(f"  {name}: ✅ photo resolved")
                fixes_applied += 1
            else:
                fixes_failed += 1
        else:
            print(f"  {name}: ❌ no photos available")
            fixes_failed += 1
    else:
        print(f"  {name}: ❌ no place_id to resolve from")
        fixes_failed += 1

# --- COMPLETELY MISSING GOOGLE DATA ---
print("\n--- ENRICHING RESTAURANTS WITH NO GOOGLE DATA ---")

missing_restaurants = [
    # (name_hebrew, city, video_id, search_variants)
    ("מייקיז", "עפולה", "KPSWuKln4ec", ["מייקיז פיצה עפולה", "Mikey's Pizza Afula"]),
    ("חממה", "תל אביב", "KPSWuKln4ec", ["חממה יין פלורנטין", "Hamama wine bar Florentin Tel Aviv"]),
    ("המחלבה הקטנה", "", "KPSWuKln4ec", ["המחלבה הקטנה מסעדה", "HaMachlava HaKtana"]),
    ("בואו", "תל אביב", "3N2oC0N6ciQ", ["בואו מסעדה נווה צדק", "Bou restaurant Tel Aviv", "בואו תומר טל"]),
    ("זוזו חנה", "", "3N2oC0N6ciQ", ["זוזו חנה מסעדה", "Zuzu Hana restaurant"]),
    ("זהרה", "ירושלים", "3N2oC0N6ciQ", ["זהרה מלון נוצ'ה ירושלים", "Zahara Noche hotel Jerusalem"]),
    ("גיוזה תופס", "תל אביב", "ZK4yPvErXIc", ["גיוזה תופס תל אביב", "Gyoza Tofes Tel Aviv"]),
    ("ממתקי אל דמסקי", "חיפה", "ZK4yPvErXIc", ["ממתקי אל דמסקי חיפה", "Mamtakey Al Damaski Haifa"]),
    ("מלא", "תל אביב", "ZK4yPvErXIc", ["מלא קפה תל אביב", "Mala cafe Tel Aviv"]),
    ("סוד", "תל אביב", "ZK4yPvErXIc", ["סוד סושי תל אביב", "Sod sushi Tel Aviv", "סוד מסעדה"]),
    ("בנגר", "תל אביב", "LrvQP_2EjxQ", ["בנגר המבורגר תל אביב", "Banger burger Tel Aviv"]),
    ("הפילמניה", "טירת כרמל", "_abbCYlWlg8", ["הפילמניה טירת כרמל", "HaPelmania Tirat Carmel"]),
    ("זות", "תל אביב", "_abbCYlWlg8", ["זות פיצה לינק תל אביב", "Zot pizza Link hotel Tel Aviv"]),
    ("מיז'נה", "חיפה", "6jvskRWvQkg", ["מיז'נה חיפה", "Mijana Haifa", "מיזנה חיפה"]),
    ("אלקבר", "", "6jvskRWvQkg", ["אלקבר עין זיוון", "Al Kaber Ein Zivan"]),
    ("הסתקייה", "ירושלים", "6jvskRWvQkg", ["הסתקייה מחנה יהודה", "Hastakia Jerusalem"]),
    ("הלנסן", "תל אביב", "6jvskRWvQkg", ["הלנסן קוריאני תל אביב", "Hallansan Korean Tel Aviv"]),
    ("מושיק", "תל אביב", "6jvskRWvQkg", ["מושיק מסעדת שף תל אביב", "Moshik restaurant Tel Aviv"]),
    ("ריבנו", "", "6jvskRWvQkg", ["ריבנו גלידה", "Buono gelato Israel"]),
]

for name, city, video_id, variants in missing_restaurants:
    print(f"\n  {name} ({city or '?'}):")
    rid = find_restaurant_id_by_name(name, video_id)
    if not rid:
        print(f"    ⏭️ not in DB, skipping")
        continue

    # Check if already has data
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT google_place_id, image_url, latitude FROM restaurants WHERE id = ?", (rid,))
        row = cursor.fetchone()

    if row and row['google_place_id'] and row['image_url'] and row['latitude']:
        print(f"    ⏭️ already has full data")
        continue

    result = enrich_restaurant(name, city, variants)
    if result:
        # Only update fields that are currently empty
        updates = {}
        for key, val in result.items():
            if val is not None:
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute(f"SELECT {key} FROM restaurants WHERE id = ?", (rid,))
                    current = cursor.fetchone()
                    if current and not current[key]:
                        updates[key] = val

        if updates:
            if update_restaurant_in_db(rid, updates):
                print(f"    ✅ Updated {len(updates)} fields")
                fixes_applied += 1
            else:
                print(f"    ❌ DB update failed")
                fixes_failed += 1
        else:
            print(f"    ⏭️ no new data to update")
    else:
        fixes_failed += 1

    time.sleep(0.5)  # Rate limit

# --- ALSO UPDATE episode_mentions with any new coordinates ---
print("\n--- SYNCING episode_mentions with updated restaurant data ---")
with db.get_connection() as conn:
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE episode_mentions SET
            latitude = (SELECT r.latitude FROM restaurants r WHERE r.id = episode_mentions.restaurant_id),
            longitude = (SELECT r.longitude FROM restaurants r WHERE r.id = episode_mentions.restaurant_id),
            google_place_id = (SELECT r.google_place_id FROM restaurants r WHERE r.id = episode_mentions.restaurant_id)
        WHERE restaurant_id IS NOT NULL
        AND (latitude IS NULL OR google_place_id IS NULL)
        AND restaurant_id IN (SELECT id FROM restaurants WHERE latitude IS NOT NULL)
    ''')
    print(f"  Synced {cursor.rowcount} mention rows")
    conn.commit()

print(f"\n{'=' * 70}")
print(f"DONE: {fixes_applied} fixes applied, {fixes_failed} failed")
print(f"{'=' * 70}")

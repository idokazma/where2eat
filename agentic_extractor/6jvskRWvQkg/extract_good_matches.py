import json
with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/analyses/6jvskRWvQkg/enrichment.json') as f:
    data = json.load(f)

# Good matches - print their full data
good = ['מרי פוסה', 'משיה', 'צפרירים', 'סטודיו גורושה', 'גורמה סבזי', 'סניור', 'מטרלו']
for name in good:
    r = data['restaurants'].get(name)
    if r:
        print(f"\n=== {name} ===")
        print(f"place_id: {r.get('place_id')}")
        print(f"google_name: {r.get('google_name')}")
        print(f"addr: {r.get('formatted_address')}")
        print(f"rating: {r.get('rating')} ({r.get('review_count')} reviews)")
        print(f"phone: {r.get('phone')}")
        print(f"website: {r.get('website')}")
        print(f"lat: {r.get('latitude')}, lng: {r.get('longitude')}")
        print(f"photo_url: {r.get('photo_url', '')[:80]}")
        print(f"instagram: {r.get('instagram_url')}")

# Wrong matches
print("\n\n=== WRONG MATCHES (need manual correction) ===")
wrong = ['מיז׳נה', 'אלקבר', 'הלנסן', 'מושיק', 'השתאקייה', 'שוק', 'הגפן', 'ריבנו', 'בוץ', 'אמיה', 'הריס', 'פת']
for name in wrong:
    r = data['restaurants'].get(name)
    if r:
        print(f"{name}: google={r.get('google_name')} => WRONG")

# Correct ones to use from DB
print("\n\n=== From DB (use existing data) ===")
for name, db in data.get('production_db', {}).items():
    if db.get('exists'):
        print(f"{name}: id={db.get('id')}")

# Additional: print צ'קולי and ג'ורג' וג'ון data
for name in ['צ׳קולי', 'ג׳ורג׳ וג׳ון', 'פרינו']:
    r = data['restaurants'].get(name)
    if r:
        print(f"\n=== {name} ===")
        print(f"place_id: {r.get('place_id')}")
        print(f"google_name: {r.get('google_name')}")
        print(f"addr: {r.get('formatted_address')}")
        print(f"rating: {r.get('rating')} ({r.get('review_count')} reviews)")
        print(f"phone: {r.get('phone')}")
        print(f"website: {r.get('website')}")
        print(f"lat: {r.get('latitude')}, lng: {r.get('longitude')}")
        print(f"photo_url: {r.get('photo_url', '')[:80]}")
        print(f"instagram: {r.get('instagram_url')}")

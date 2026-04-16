import json
with open('/Users/ido.kazma/Desktop/Projects/private/where2eat/analyses/6jvskRWvQkg/enrichment.json') as f:
    data = json.load(f)
for name, rest in data['restaurants'].items():
    gname = rest.get('google_name', 'N/A')
    addr = rest.get('formatted_address', 'N/A')
    rating = rest.get('rating', 'N/A')
    reviews = rest.get('review_count', 'N/A')
    phone = rest.get('phone', 'N/A')
    insta = rest.get('instagram_url', 'N/A')
    pid = rest.get('place_id', 'N/A')
    lat = rest.get('latitude', 'N/A')
    lng = rest.get('longitude', 'N/A')
    web = rest.get('website', 'N/A')
    print(f'{name}: google={gname} | addr={addr} | rating={rating}({reviews}) | phone={phone} | pid={pid[:30]} | web={web}')
print()
print('--- Timestamps ---')
for name, ts in data.get('timestamps', {}).items():
    rec = ts.get('recommended_seconds')
    rec_disp = f'{int(rec//60)}:{int(rec%60):02d}' if rec else 'NOT FOUND'
    print(f'{name}: {rec_disp}')
print()
print('--- Production DB ---')
for name, db in data.get('production_db', {}).items():
    exists = db.get('exists', False)
    rid = db.get('id', 'N/A')
    print(f'{name}: exists={exists} | id={rid}')

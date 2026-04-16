# Missing Photos Report — Agentic Extractor

**Date:** 2026-03-29
**Scope:** All 12 extraction files in `agentic_extractor/`

## Summary

| Metric | Count |
|--------|-------|
| Total restaurants (non-rejected) | 209 |
| ADD_TO_PAGE | 81 |
| REFERENCE_ONLY | 128 |
| ADD_TO_PAGE missing photos | **0** |
| REFERENCE_ONLY missing photos | **125** |

**All ADD_TO_PAGE restaurants have photos.** The 125 missing are all REFERENCE_ONLY.

---

## Breakdown by Recoverability

### Category A: GP-verified with Place ID (58 restaurants)

These have a Google Places `place_id` — **photos can be fetched via Google Places API** (highest success rate).

| Restaurant | City | Episode |
|------------|------|---------|
| ברדברי (Breadberry) | אור יהודה | 3N2oC0N6ciQ |
| GDB | תל אביב | 5c5YG9JaFwM |
| סנטי (Santi) | תל אביב | 5c5YG9JaFwM |
| גייג'ין (Gaijin) | תל אביב | 5c5YG9JaFwM |
| היבא (Hiba) | תל אביב | 5c5YG9JaFwM |
| רוטשילד 48 (R48) | תל אביב | 5c5YG9JaFwM |
| בלה מיה (Bella Mia) | תל אביב | 5c5YG9JaFwM |
| עדל קבבים (Adel Kebabs) | תל אביב | 5c5YG9JaFwM |
| גוש ודניאל (Gouje and Daniel) | בני ציון | 5c5YG9JaFwM |
| החומוס של השמן (HaHummus Shel HaShemen) | תל אביב | 5c5YG9JaFwM |
| סולת (Solet) | באר שבע | 5c5YG9JaFwM |
| סניור (Senior) | תל אביב | 6jvskRWvQkg |
| מטרלו (Mattarello) | בנימינה | 6jvskRWvQkg |
| ג'ורג' וג'ון (George & John) | תל אביב | 6jvskRWvQkg |
| אקליפטוס (The Eucalyptus) | ירושלים | J6Akd1bXiWM |
| גסטרו מכניקו (Gastro Mechanico) | תל אביב | J6Akd1bXiWM |
| אנונה (Anona Bistro) | אשקלון | J6Akd1bXiWM |
| פלאפל דניאל (Falafel Daniel) | בת ים | J6Akd1bXiWM |
| קונטר (Counter) | ירושלים | J6Akd1bXiWM |
| הג'ג'ה (Jaja) | ראשון לציון | J6Akd1bXiWM |
| בלמיה (Bel Ami) | תל אביב | KPSWuKln4ec |
| אסה (Assa) | תל אביב | KPSWuKln4ec |
| צ'קולי (Chacoli) | תל אביב | KPSWuKln4ec |
| הלנה (Helena) | תל אביב | KPSWuKln4ec |
| פסטל (Pastel) | תל אביב | KPSWuKln4ec |
| נומה (Noma) | קופנהגן | KPSWuKln4ec |
| קרמלה (Carmela) | תל אביב | KPSWuKln4ec |
| לונל (Lunel) | תל אביב | KPSWuKln4ec |
| עוגיה TLV (Night Cookie) | תל אביב | LXC39QRwVlc |
| פלאפל גבי (Falafel Gabay) | תל אביב | LXC39QRwVlc |
| בלמי (Bellamy) | תל אביב | LrvQP_2EjxQ |
| אונמי (Onami) | תל אביב | ZK4yPvErXIc |
| סורין (Surin) | סביון | _abbCYlWlg8 |
| חצר של אסף (Hatzer shel Asaf) | בני ברק | _abbCYlWlg8 |
| נומא (Noma) | קופנהגן | _abbCYlWlg8 |
| ג'וני (Joni) | קריית אונו | _abbCYlWlg8 |
| גריל רום (The Grill Room) | תל אביב | _abbCYlWlg8 |
| נורדיניו (Nordinio) | תל אביב | _abbCYlWlg8 |
| ברבוניה (Barbunia) | קריית אונו | _abbCYlWlg8 |
| סביך פרישמן (Sabich Frishman) | תל אביב | _abbCYlWlg8 |
| קפה אחד (Cafe Ahad Ha'am) | תל אביב | _abbCYlWlg8 |
| בבלה (Babele) | תל אביב | rGS7OCpZ8J4 |
| התקריה (HaTakriya) | תל אביב | rGS7OCpZ8J4 |
| מנטריי (Manta Ray) | תל אביב | rGS7OCpZ8J4 |
| קפה סמדר (Cafe Smadar) | ירושלים | rGS7OCpZ8J4 |
| משק אופעים (Meshek Ofaim) | ירושלים | rGS7OCpZ8J4 |
| לוקס (Luks) | חיפה | rGS7OCpZ8J4 |
| קרוד (Crudo) | חיפה | rGS7OCpZ8J4 |
| צ'ופק (Shtsupak) | תל אביב | rGS7OCpZ8J4 |
| ביסטרו אופנהיימר (Bistro Oppenheimer) | תל אביב | rGS7OCpZ8J4 |
| יפו תל אביב (Yaffo Tel Aviv) | תל אביב | w-n3zFXTuGM |
| הבנדיט (Bandit) | תל אביב | wlCpj1zPzEA |
| היבה (Hiba) | תל אביב | wlCpj1zPzEA |
| הפיטמסטר (The Pitmaster) | פתח תקווה | wlCpj1zPzEA |
| בית תאילנדי (Thai House) | תל אביב | wlCpj1zPzEA |
| מרציפן (Marzipan) | ירושלים | wlCpj1zPzEA |
| קולינה (Colina) | קיסריה | wlCpj1zPzEA |
| אקה (AKA) | ירושלים | wlCpj1zPzEA |

**Recovery strategy:** Google Places Photo API with existing `place_id` → resolve `photo_reference` to permanent `lh3.googleusercontent.com` URL.

---

### Category B: GP-verified, no Place ID (8 restaurants)

These were verified on Google Places but the `place_id` wasn't stored. Need **web search + Wolt fallback**.

| Restaurant | City | Episode |
|------------|------|---------|
| גרציאני (Graziani) | תל אביב | w-n3zFXTuGM |
| הפלור (Flor) | תל אביב | w-n3zFXTuGM |
| מירים (Mirim) | תל אביב | w-n3zFXTuGM |
| ג'רדינו (Giardino) | תל אביב | w-n3zFXTuGM |
| מטרלו (Matrelo) | unknown | w-n3zFXTuGM |
| מרלוזה (Merluza) | תל אביב | w-n3zFXTuGM |
| מאשיה (Mashya) | תל אביב | w-n3zFXTuGM |
| אלטר פיצה (Alter Pizza) | תל אביב | w-n3zFXTuGM |

**Recovery strategy:** Google Places text search by name + city → get `place_id` → fetch photo. Fallback to Wolt og:image.

---

### Category C: No Google data at all (59 restaurants)

No verification was done. Many are well-known restaurants that should be findable.

**Recoverable (well-known Israeli restaurants):**
- ג'ורג' וג'ון, רפאל, סנטי, אורי בורי, פורטר אנד סאנס — famous TLV restaurants
- מנטריי (Manta Ray) — iconic TLV beachfront restaurant
- קפה קפה, חומוס אליהו, ג'פניקה — national chains
- נומה (Noma) — world-famous Copenhagen restaurant
- Ten Belles, Brigade du Tigre — known Paris restaurants

**Likely unrecoverable:**
- מסעדה באשדוד (שם לא ברור) — name unknown
- ארקיע (שחף שבתאי) — not a restaurant, a person/airline reference
- רפי כהן בסנטי — pop-up event, not a permanent restaurant
- ווינטרפסט / בת הוויגדור — event venue, not restaurant
- קרנבל של בשר — generic description, not a restaurant name
- לולו קיבוץ טריה — may be too obscure

**Recovery strategy:** Wolt/Ontopo search → Google Places text search → review site image search. For Paris restaurants: Google Places or TripAdvisor. For chains: use flagship location image.

---

## Recommended Action Plan

Per the episode-processor agent's **Image Sourcing Priority**:

1. **Google Places API** (Category A: 58 restaurants) — use existing `place_id` to call Place Details with `photos` field, resolve first `photo_reference` to permanent URL
2. **Google Places text search** (Category B: 8 restaurants) — search by Hebrew name + city to get `place_id`, then fetch photo
3. **Wolt search** (Categories B+C) — search `"{name} wolt"`, fetch page, extract `og:image` meta tag
4. **Ontopo/Tabit** — for restaurants not on Wolt
5. **Food review sites** — `WebSearch: "{name_hebrew} {city} ביקורת מסעדה"`
6. **Restaurant website/Instagram** — `og:image` from their own site

### Effort vs Impact

| Action | Restaurants | Effort | Success Rate |
|--------|------------|--------|-------------|
| Google Places API (Cat A) | 58 | Low (scripted) | ~95% |
| Google Places search (Cat B) | 8 | Low (scripted) | ~90% |
| Wolt fallback (Cat C, Israeli) | ~40 | Medium | ~80% |
| International restaurants | ~10 | Medium | ~70% |
| Unrecoverable | ~5-7 | N/A | 0% |

**Estimated total recoverable: ~110 out of 125 (88%)**

Since these are all REFERENCE_ONLY, photos are nice-to-have but not blocking production. The ADD_TO_PAGE restaurants are all covered.

# Operations note, 2026-11-27: image 402s, photo cost exposure and photo repair

Self-contained record of the day. Changes to the 37 restaurant records are listed in `2026-11-27-photo-repair-changes.csv` (restaurant id, source page, before and after `image_url`). Undo for a record is a `PUT /api/restaurants/<id>` with `{"image_url": "<before>"}`; empty "before" means the record had no `image_url`.

## 1. How an image is chosen

`web/src/lib/images.ts` `getRestaurantImage`, in order:
1. Stored photo copies (`getStoredPhotoUrls`).
2. Our own venue image: `image_url` whose path starts with `/api/venue-images/`.
3. Owner-attributed Google Places photo, then the first Google photo, through the photo proxy `/api/photos`.
4. The `image_url` fallback (often an `lh3.googleusercontent.com` link; many of these now return 403).
Google photos whose place id differs from the restaurant's `google_place_id` are skipped. File names that look like logos, icons, favicons or placeholders are not preferred over real photos.

## 2. Storage behavior

- Venue images: `<DATABASE_DIR>/venue_images/<sha256>.jpg` on the Railway volume. In Railway the store returns 503 unless `DATABASE_DIR` lies inside the mounted volume. `GET /api/venue-images/<sha>.jpg` is public. Upload is `POST /api/admin/venue-images?restaurant_id=&source_url=&credit=` with raw bytes and `Authorization: Bearer <API_SECRET_KEY>` (at least 32 characters). Limits: 5 MB, 16 million pixels. Upload stores the file and returns `asset_path` and `sha256`; it does not change the restaurant record. Attach with `PUT /api/restaurants/<id>` (editor or admin JWT).
- Origin gate: browser-style requests need an allowed `Origin`/`Referer` (the site origin). Scripts must send one.
- Google photo proxy (`api/routers/photos.py`): the code saves each fetched photo to `photo_cache/` on the volume and serves the saved copy afterwards, with a 7-day memory of misses. A photo not yet saved needs a Google Places request.
- Serving an owned or cached image does not call Google. It still uses hosting bandwidth and the API process, which can have its own cost.

## 3. Cost ledger

`src/cost_ledger.py` keeps a local gross estimate in `cost_estimates.db`. It is not Google's balance. Per-request estimates include `places_photo` at 0.007 USD. Monthly budget defaults to 10 USD (`COST_MONTHLY_BUDGET_USD`). Public photo requests are refused once the month's estimate reaches the budget. Read it with `GET /api/admin/maintenance/costs` (admin).
Reading on 2026-11-27 at about 20:16 Israel time: about 9.21 of 10.0 estimated, with `opening_spend_verified: false` (no opening spend configured for November; none of the `COST_*` variables is set on the production service, so defaults apply). The estimate has not been checked against the provider console and may be wrong in either direction. It rose by about 0.035 (five `places_photo` attempts) between 17:43 and 20:16 without a known cause. The ledger covers only instrumented calls, not other keys or clients.

## 4. The Vercel 402 incident and PR #358

- Symptom: images failed with HTTP 402. Cause: the Vercel Hobby plan's monthly image optimization quota was used up, so `/_next/image` returned 402 for images without a cached copy.
- Merged fix: PR #358, squash commit 9f117de, adds `images.unoptimized: true` to `web/next.config.ts` and a test. After the production deploy (main at 3132300, deployed 2026-11-27 about 17:17 UTC), a headless browser run on the home page and the restaurant pages tested that day showed zero `/_next/image` requests and owned images returning 200. This covers the pages tested, not every page.
- Not merged: an earlier branch (`fix/images-bypass-vercel-optimizer`, commits 0982b80 and 8b21b65) also contained a guard that stopped gallery and thumbnail images from calling the paid `/api/photos` proxy. The PR's head was changed before merge and the guard is absent from the merged code. Gallery thumbnails (about five per restaurant page in the canary tests) still request `/api/photos`. The tests aborted those requests. Whether and how to guard them is unresolved. The branch diff is `https://github.com/idokazma/where2eat/compare/092f10e...8b21b65`.

## 5. Photo repair

Census of 411 visible restaurant records before repair (by how the hero image resolves):
- 257 own venue image (loads, 200)
- 26 direct image link (loads, 200)
- 102 Google photo reference through the paid proxy (not verified, to avoid cost); their `image_url` fallback was dead (403) for 86 and alive (200) for 16
- 26 with no image

Method for each record: take the record, find an image on the venue's own site, Ontopo/Wolt/getmood page or similar venue page, look at the pixels (right venue, real photo, not a logo or banner, food-forward where possible), upload an owned copy, `PUT` the new `image_url`, read the record back, fetch the asset, then render the live restaurant page on a phone-sized viewport with `/api/photos` aborted. 37 records changed this way (33 dead-fallback, 4 no-image).

After: 294 owned, 26 direct, 69 Google-ref (53 with dead fallback, 16 alive), 22 no image. Total 411. Of 112 targets (86 dead fallback plus 26 none), 75 remain.

Rejected on purpose: logos, banners, site screenshots, portraits, promo photos of staff, empty interiors when no food image existed, and any case where the venue's identity could not be confirmed (generic names, wrong city, directory-only results). Mona keeps its venue-profile image (chef team) because no better venue-owned food photo was found.

Remaining with identity unconfirmed or no source found: Love Story, Raphael, Franko, Lev, O, Vin, Madame Bella, Oscars, Citra, Shimshi, Burekas Penso, Koko Chavita, Shmena, HaTunisi shel Eli, the two "by Haim Cohen" records, Trouville-sur-Mer, Amandine, Miriam Jerusalem, and about 15 small places with no online presence found. Press results found during the search reported that Keren, Gita and Prism (Berlin) had closed. That was not checked against a current primary source, so their current status is not verified and the existing record status was not changed. Records skipped as weak candidates: The Jango, Vardoulakis, HaSalon, Talbiye, Waffle House (two), Lenôtre, Mazon, Kimiko, Riviera.

Duplicate records noticed and left unmerged (same venue, two rows): Wine House (Yigal Alon 98, Tel Aviv), Petrozilia, Mantiz and Dilek. Both rows of each of these four pairs got the same image. Waffle House also has two rows but both were skipped (no suitable image).

## 6. Lessons

1. Look at a page's network calls before testing it. Pages with Google photos can spend money; block `/api/photos` in test browsers and read the ledger before and after.
2. The local ledger is an estimate. Compare it with the provider console.
3. Photo fixes are data operations through the admin API. Keep the before value and read back every write.
4. A 200 on an image URL does not show the right picture. Check the pixels.
5. Do not match venues on name alone. Confirm the city and the page title.
6. Social and CDN image links expire. Keep an owned copy.
7. Vercel previews on other origins cannot load API data because of the origin gate, so they cannot prove image behavior. Use production or a local run with real data.
8. Admin logins update the admin user's `last_login`.
9. A merged PR can differ from the branch that was reviewed. Read what landed.

## 7. Open items

- Gallery and thumbnail proxy exposure (section 4).
- Verify the cost ledger against the provider console and enter the opening spend; find the cause of the five extra photo attempts.
- The 22 no-image and 53 dead-fallback records, and the 69 Google-ref heroes that cannot be checked without a paid request.
- Backups: the owned images exist only on the Railway volume, not in Git; confirm the volume and Postgres are backed up (see `docs/PROJECT_OVERVIEW.md` section 4a).
- Duplicate records (Wine House, Petrozilia, Mantiz, Dilek, Waffle House).

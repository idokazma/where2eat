# Curated venue-image storage

This patch is independent of Google photo resolution and billing. It does not change any restaurant record or upload any image at deploy time.

## Deployment fit

Current Railway environment was inspected read-only on 7 November 2026:

- DATABASE_DIR=/app/persistent
- RAILWAY_VOLUME_MOUNT_PATH=/app/persistent
- RAILWAY_VOLUME_NAME=where2eat-volume
- Existing API_SECRET_KEY meets the 32-character minimum; its value was not displayed or retained.

The Dockerfile copies api/ and installs api/requirements.txt. Pillow is the only new dependency. Assets are written at runtime under DATABASE_DIR/venue_images, not into the container image. No new volume/account/service is proposed. On Railway, reads and uploads fail closed unless DATABASE_DIR is inside the declared volume mount. Actual persistence across a Railway redeploy remains a deployment-canary check, not a claim from local tests.

## API

POST /api/admin/venue-images takes raw image bytes, with restaurant_id (UUID), source_url (HTTPS) and credit as query parameters. Authorization: Bearer with the existing server-side API_SECRET_KEY is required before reading the body. Never expose this key to browser JavaScript. Cookie/admin JWT authentication is intentionally not accepted; the legacy admin JWT configuration can otherwise use its development-default secret.

The route streams at most 5 MiB into memory, decodes JPEG/PNG/WebP, rejects animation and images over 16 million pixels, applies EXIF orientation, strips metadata, and re-encodes to JPEG up to 1600px. The response returns asset_path, hash, byte size and the supplied restaurant_id. ID is a provenance label, not evidence of venue identity or a claim that the record exists. Source URLs are recorded, never fetched. Operators must verify venue/source identity before uploading. Google Places photos are out of scope and must not be rehosted here.

GET /api/venue-images/{sha256}.jpg is public and returns only a strictly named JPEG. No directory listing, arbitrary filename, ledger access or URL-fetch proxy exists. Assets are content addressed, atomic writes are used, and EXIF/source metadata is not exposed through this route. A separate private provenance JSON ledger records source, credit, restaurant ID, timestamp and hash on the volume.

The origin middleware allows only these GET asset paths and exact POST upload path through to their own handlers. The upload handler still requires its own Bearer authentication. This lets Next.js fetch JPEGs without an Origin header. No other write routes are changed.

## Canary after explicit deploy approval

1. Snapshot affected restaurant rows and current volume backup. Preserve original episode associations/timestamps.
2. Deploy this isolated patch. Do not enable the parked Google/runtime patch.
3. Confirm unauthorized upload is 401, no default-secret fallback, and public invalid filenames are 404.
4. Upload the verified Afrit source image using server-side credentials. Confirm the returned asset from a fresh unauthenticated client and inspect bytes/pixels.
5. Snapshot and update only Afrit image_url to the full API-origin asset path. Verify its exact ID and actual homepage card, not a similar-name card. Repeat for Cezanne only after the canary passes.
6. Restart/redeploy once and recheck both assets and homepage cards to verify real volume persistence.

No upload/assignment has been done in production by this preparation task. Production changes still need the user's deploy approval. Existing unauthenticated restaurant-update routes are not fixed by this patch; do not interpret the authenticated upload as broader API hardening.

## Rollback and limits

Restore restaurant image_url values from snapshots first. Keep asset bytes until references have been checked. Public asset responses use max-age=0, must-revalidate, so browser/shared caches must revalidate before reuse. The existing Next image optimizer still maintains a separate transformed-image cache, governed by its minimumCacheTTL (14400 seconds / 4 hours in the installed Next version) and deployment CDN behavior. Deleting a file does not recall already optimized/cached copies. Wrongly published content may require CDN/optimizer cache purges as well as file deletion. There is no remote delete or automatic garbage collector in this minimal patch. Volume usage grows with unique photos, so an operator must inspect usage before batches; storage/egress charges on existing infrastructure are not claimed to be zero. No paid infrastructure change is included.

Local proof uses real Afrit and Cezanne venue-published images uploaded into a disposable local volume, real FastAPI routes and the current remote-main Next.js homepage (Street Pop redesign, c8cdaa6). Only the local proof temporarily permits localhost optimizer fetches; no such setting is included in the patch. These screenshots demonstrate preparation, not production repair.

## Audited discussion-timestamp correction

The same review branch includes a separate small maintenance commit for a discovered teaser-link error. `POST /api/admin/maintenance/mentions/{id}/preview` and the existing PATCH route now accept `{ "changes": { "timestamp_seconds": 2958 } }`. This must be the only change in the request and must be an integer from 0 through 604800 (7 days). The bound is a corruption guard, not evidence that the timestamp fits the episode: operators must verify against original timed captions/audio and the actual episode duration before applying it. Quotes, names, episode IDs and video IDs cannot be changed in this timestamp-only request.

Existing editor/admin authentication, revision-bound comparison, one-transaction before/after snapshot and stale-safe undo remain mandatory. The original timestamp is retained in `maintenance_operations.before_json`; no source mention is deleted or reseeded. This intentionally changes the earlier timestamp-immutable policy for explicit audited corrections only. The normal name/identity repair path remains unchanged. No database migration, automated correction or production mention edit is performed by deploying this code.

The observed Jai Lek correction is 140 to 2958 seconds in episode GNiUaUqPY_Q. Its primary restaurant link is already corrected, but the archived mention must still be previewed and patched after deployment, then checked on the live homepage. Do not replay the entire episode extraction to make this correction.

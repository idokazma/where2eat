# Episode publication quality

Episode processing remains manual. This change does not enable a scheduler, cron, background discovery, or any additional paid lookup. Analysis is a draft, not permission to publish.

## What changes

The same offline validator runs in both `POST /api/episodes/seed` and `BackendService.process_video(save_to_db=True)`. It runs before creating an episode or restaurant and, for seed, before deleting/replacing any existing mentions. It requires source-backed review of every feed candidate (`add_to_page`, or a normal pipeline restaurant with no verdict).

Legacy extraction JSON without review evidence now returns 422 at seed. Automatic processing without evidence returns `needs_review: true` without saving an episode or restaurant. Its extraction, timed segments and blockers are saved under `DATABASE_DIR/publication_reviews/{video_id}-{content_hash}.json` so the paid analysis need not be rerun. The queue treats this as a permanent review hold (`skipped` with the review-required reason), not a transient error to retry. A reviewer corrects the saved draft and submits it through seed. This is an intentional compatibility change, not an unattended ingestion rollout.

## Review procedure

1. Read the full original timed transcript. Preserve the spelling heard there. Verify the venue using its city/branch/address/chef context and a venue or other authoritative identity source. A similar name, transliteration or search-result title alone is insufficient. Resolve conflicts before enrichment, including every place ID, website, phone and coordinates. Keep unresolved identities out of the feed rather than substituting a familiar name.
2. Find all occurrences and examine their surrounding discussion. A trailer can repeat a name and a short quote. A late occurrence can be a recap or comparison. Neither "first" nor "last" is a selection rule. Select the start of the actual discussion, often before the name is spoken, using a timed segment. Read the nearby quote and, when ambiguous, listen to the clip. Do not invent 00:00 when no timed evidence exists.
3. Search the venue's own site and verified social account and its booking/delivery listings using Hebrew and English spellings, chef, branch and address clues. Prefer food; a real interior is acceptable and should be labelled. Reject logos, posters, curtains, generic placeholders, different branches and editorial/third-party photographer images unless separately authorized. Observe actual reuse restrictions; record source and credit without claiming legal certainty.
4. Inspect actual image pixels. For supported venue imagery, upload a durable copy through the authenticated venue-image route, then use its returned public JPEG URL and hash. Do not store a signed Instagram/CDN link as the final image URL. Do not copy Google Places content into venue-image storage. Google photo fetching and billing remain a separate flow. If no suitable photo can be obtained, record an explicit unavailable reason and leave image fields empty, rather than silently pretending the photo task passed.
5. Run the offline check, then review the extraction/preview. Do not pre-create restaurants through a different endpoint to bypass the seed check. After the separately authorized upload, verify the exact live card and video playback, not just HTTP 200. Preserve existing snapshots for corrections. Timestamp corrections use the audited maintenance path, never a full episode reseed to edit one moment.

## Evidence schema

Each feed restaurant has `publication_review`. The episode extraction also carries `transcript_segments` with the original `start`, `duration`, and `text` values. Both manual `timestamp.seconds` and automatic `mention_timestamp_seconds` shapes are accepted.

```json
{
  "episode": {"video_id": "GNiUaUqPY_Q"},
  "transcript_segments": [
    {"start": 2958, "duration": 8, "text": "Exact original transcript quote here"}
  ],
  "restaurants": [{
    "name_hebrew": "Verified venue name",
    "verdict": "add_to_page",
    "timestamp": {"seconds": 2958},
    "publication_review": {
      "identity": {
        "status": "verified",
        "transcript_name": "Spelling heard in transcript",
        "source_name": "Name on verified source",
        "source_url": "https://venue.example/about",
        "context_clues": {"city": "Herzliya", "chef": "Name from discussion"}
      },
      "discussion": {
        "kind": "discussion",
        "video_id": "GNiUaUqPY_Q",
        "selected_seconds": 2958,
        "all_occurrences_reviewed": true,
        "quote": "Exact original transcript quote here"
      },
      "photo": {
        "status": "unavailable",
        "reason": "Verified owner image found, but durable upload still pending"
      }
    }
  }]
}
```

For an installed photo, replace the photo object with `status: verified`, `source_kind: venue_owned | venue_booking_listing | venue_delivery_listing`, HTTPS `source_url`, `credit`, `identity_checked: true`, `pixels_checked: true`, `content_kind: food | interior`, and `sha256`. The restaurant's `image_url` is the full returned `/api/venue-images/{sha256}.jpg` URL on the production API host. The validator checks the filename/hash, verifies local stored bytes and rejects query-signed image URLs. Durable uploads require the separate venue-image storage feature to be deployed first. No upload or network call is performed by this validator.

## Local check

```bash
PYTHONPATH=src python scripts/check_episode_publication.py extraction.json --data-dir /path/to/data
```

Exit 0 means the declared evidence is complete and local/timed checks passed, not that semantic identity, rights, or a venue's claims were independently authenticated by software. A source-backed reviewer still owns those judgments. Exit 1 lists all blockers. Reference-only/rejected rows do not need feed-photo evidence and are not turned into recommendations.

This is a pipeline quality check, not an API-wide security boundary. Legacy arbitrary restaurant mutation endpoints and existing seed replacement transaction behavior are unchanged. No automated web search, paid model call, transcription, photo fetch or deployment is added.

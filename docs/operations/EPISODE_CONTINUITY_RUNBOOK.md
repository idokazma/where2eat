# Episode publication runbook (continuity)

[עברית: EPISODE_CONTINUITY_RUNBOOK.he.md](EPISODE_CONTINUITY_RUNBOOK.he.md). Same content in Hebrew; file names, fields, endpoints and commands are identical.

Purpose: let any competent operator (human or assistant) add a podcast episode to where2eat from this repository alone, without the chat history of whoever did the previous episodes.

How to read this file. Every statement is one of:
- **Recommended**: the procedure to follow. It is written here, it is not a record of what was always done.
- **Historical evidence**: what the runs for episodes 179 and 180 actually did, with the source. Where history differs from the recommendation, the difference is stated.
- **Unproven**: not run, not verified, or depends on access this repository cannot show.

Status of this document: written 2026-11-27, based on the code at `main` 3132300, the 179 and 180 run records, and a partial rehearsal on episode 142 (local tooling only; not a full handoff success) (see `docs/operations/episode-records/2026-11-27-handoff-rehearsal-wlCpj1zPzEA.md`). A full live episode run from this file alone has NOT been done.

Companion documents:
- `docs/operations/TRANSCRIPTS_AND_TIMESTAMPS_GUIDE.md`: all transcript sources, formats, timestamp provenance, verification limits, real cases.
- `docs/operations/episode-records/TEMPLATE.md`: the per-episode record to fill in and commit.
- `docs/episode-publication-quality.md`: the publication gate and the evidence schema.
- `docs/PROJECT_OVERVIEW.md`: the three layers (server pipeline, `.claude` agents, manual preparation) and what is proven.

## 0. Hard rules (from the owner's standing instructions)

1. Ingestion is manual. Do not enable a scheduler, cron, polling or a proxy. (Declined by the owner on 2026-11-01; production had `PIPELINE_SCHEDULER_ENABLED=false` on 2026-11-27.)
2. The transcript for a published episode comes from the audio, not from YouTube auto-captions. Quotes are checked against the recording. Automatic speech-to-text is not listening: it makes errors, so uncertain words stay uncertain.
3. Do not spend money without approval. Monthly budget is about $10 including spend the ledger cannot see. `GET /api/admin/maintenance/costs` is a local estimate, not the provider balance. Never request `/api/photos` (Google photo proxy, paid) in a test or verification browser.
4. No merge and no deploy without the owner's explicit approval. Never commit secrets.
5. A gate pass is not proof. The gate checks that evidence fields exist and that a quote appears inside the timed text you supplied. It does not prove who spoke, where in the audio a quote is, or that a venue is the right one.
6. Never invent segment start times to make the gate pass. See section 6.
7. Photos are advertising for the venue. Do not start rights discussions. Do pick food-forward photos of the correct venue; never a logo, banner, portrait or duplicate; keep an owned copy (Instagram links expire).

## 1. Access and credentials (locations only, never values)

| Need | Where it lives | Notes |
|---|---|---|
| Public site and API | `https://www.where2eat.rest` (web), `https://where2eat-production.up.railway.app` (API) | Requests need an `Origin` header the API allows. The run scripts used `https://www.where2eat.rest`; the agent files say `https://where2eat-delta.vercel.app`. Both appear in the record. |
| Admin API login | `POST /api/admin/auth/login` with an admin account | Historical: the 179/180 scripts read `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the Railway service variables. The agent files use `WHERE2EAT_ADMIN_EMAIL` / `WHERE2EAT_ADMIN_PASSWORD` instead. Which one is current was not verified; check Railway variables. |
| Image upload bearer | Railway variable `API_SECRET_KEY` (at least 32 chars) | Used on `POST /api/admin/venue-images`. The 180 script also sent it as header `x-api-key`; whether that header is needed was not verified. |
| Reading Railway variables | An account-level Railway token held in the owner's secret store | Historical: used with the GraphQL API at `https://backboard.railway.com/graphql/v2`. Access from the owner's side; not in this repo. |
| Railway edge block | Cloudflare error 1010 on the default Python user agent | Historical (2026-11-13, 2026-11-19): send an identifying `User-Agent` such as `where2eat-admin/1.0`. |
| GitHub | PAT in the owner's secret store, pushes only; a PAT could not open PRs on 2026-11-27 | A PR was opened through a separate GitHub integration. |
| Google Places | `GOOGLE_PLACES_API_KEY` on Railway (name verified). Local `.env` copy: unknown | Paid. See rule 3. |
| Model keys | `GEMINI_API_KEY` set on Railway (name verified). `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in production: unknown | Only the server pipeline uses these. The assisted route for 179/180 used none of them. |

Unproven: whether a new operator can obtain each of these. The owner must hand over or grant access; this repo cannot.

## 2. Roles and the three layers (short)

- A. Server pipeline (`src/`, `api/`): captions only, then analysis, then the same publication gate. Stops at `needs_review` for automatic output. Manual entrypoint: `POST /api/analyze` (editor role). It was not used for 179/180. First blocker for a new episode, by memory records only: YouTube blocks Railway (not retested).
- B. `.claude/agents`: instructions for Claude Code on a developer machine. Aligned with this runbook in the same PR. No evidence they were loaded for 179/180.
- C. Assisted manual preparation: what 179/180 used: audio, speech-to-text, manual review, admin API.

This runbook is the shared procedure for B and C. Layer A is not part of the approved workflow today.

## 3. Procedure

Each step lists: input, action, output, check, and failure handling. Keep the per-episode record (`docs/operations/episode-records/<video_id>.md`) updated as you go.

### Step 1. Pick the episode and prevent duplicates

- Input: the owner's request (or nothing: the newest RSS item).
- Action: read the public RSS feed `https://feeds.megaphone.fm/POLTD3242143576` (181 items, 0 to 180 on 2026-11-27). Each item has `title`, `pubDate` and an `enclosure` MP3 URL. Then find the YouTube video id (title match; for 180 it is `HFfKdElnvuM`). Then check the site: `GET /api/episodes?limit=200` (the default page returns only 50, which caused a wrong count in one run) and look for the `video_id`.
- Command (read-only, free; run on 2026-11-27 and printed 181 items):
```bash
python3 - <<'PY'
import urllib.request, xml.etree.ElementTree as ET
req = urllib.request.Request("https://feeds.megaphone.fm/POLTD3242143576", headers={"User-Agent": "where2eat-admin/1.0"})
items = ET.fromstring(urllib.request.urlopen(req, timeout=30).read()).findall("./channel/item")
print("items:", len(items))
for it in items[:5]:
    enc = it.find("enclosure")
    print(it.findtext("pubDate"), "|", it.findtext("title"), "|", enc.get("url") if enc is not None else "no-audio")
PY
```
- Check: the episode is not already on the site. A duplicate is created by seeding the same `video_id` with a different review set (seed replaces mentions, see step 9).
- Unproven: matching RSS item to YouTube id is manual; there is no script for it.

### Step 2. Get the audio

- Action: download the item's MP3 (`enclosure` URL, a redirect via `traffic.megaphone.fm`). Historical: ep 179 is 65:35; ep 180 is about 82 MB and 4095.756 s.
```bash
curl -L -o ep.mp3 "ENCLOSURE_URL"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 ep.mp3
```
- Check: duration is plausible and close to the YouTube video length (ep 180: video 4095.6 s vs MP3 4095.8 s). If they differ by more than a few seconds, the audio may contain different ads or a cut: record it, and expect all YouTube player offsets to be shifted.
- Output: the file (do not commit audio to Git). Record the URL and duration in the episode record.
- Unproven: the MP3 download was not repeated in the offline rehearsal (HEAD request only).

### Step 3. Chunk, then transcribe

- Action: split the audio into chunks the speech-to-text step can handle (historical: 5 chunks for ep 180, about 14 minutes each if equal, exact lengths not recovered; chunk 3 produced about 18k characters). Any Hebrew-capable speech-to-text may be used. Record which one, and its version/date, in the episode record. Keep each chunk's output as its own file.
```bash
ffmpeg -i ep.mp3 -f segment -segment_time 900 -c copy chunk%02d.mp3
```
(`-segment_time 900` is the recommended value; tested only on a synthetic 40 s file, where it produced correct 15 s pieces. The actual chunk length used in 180 was not recovered.)
- Output: plain text per chunk. It has no timestamps and no speaker names (historical, both episodes).
- Known failures (historical, ep 180): a chunk came back as a loop of repeated zeros; a chunk ended mid-word and the next began with the continuation (`אבוקדו ירוק חמאה כ`). Response: re-transcribe the affected range in short windows (90 s, later 20 s). Anything after the corrupted region cannot be trusted until re-done.
- Check: read every chunk end to end, not just the parts about restaurants. Look for loops, cut words, or text that jumps topic at chunk boundaries.

### Step 4. List venue candidates

- Action: from the full transcript, list every restaurant, cafe, bar or stall mentioned. For each: tasted by a presenter vs mentioned by someone else or reported from news; which presenter (no labels in the text: use content, gendered Hebrew forms and the hosts list as clues, and mark uncertainty); all occurrences (trailers repeat names; recaps and comparisons come later).
- Output: the candidate table in the episode record, with `speaker confidence` as its own column (known, likely, unknown).
- Historical: in 180 the worker could not tell from the text alone who spoke the Prague lines of Love Story and left some attributions open. Do not fill a speaker because it is convenient.

### Step 5. Identify each venue

- Action: find the venue's own website or social page, using Hebrew and English spellings, city, branch, address and chef clues from the transcript. Open the page and read it. A matching name is not identity. Same-name venues exist (historical: "Love Story" is a Tel Aviv burger place already in the catalog and also a venue in Prague discussed in ep 180).
- Check: a second signal agrees (city, street, chef, menu item mentioned). If two candidates remain, the venue stays out of the feed.
- Output: `identity` evidence in the payload (`source_url`, `source_name`, `transcript_name`, `context_clues`). Historical: the 180 payload used the Google Maps place record URL as the identity `source_url`. That is a lookup result, not proof the transcript means that place; for a venue-owned source prefer the venue's own page.
- Paid calls: Google Places search is paid (about $0.04 per search, $0.025 per details in the ledger's price table). Use free sources when the monthly estimate is high; the ledger showed about 9.17 of 10 on 2026-11-26.

### Step 6. Find the discussion start and the quotes (timestamps)

Read `docs/operations/TRANSCRIPTS_AND_TIMESTAMPS_GUIDE.md` first. In short:
- The stored `timestamp.seconds` is where the discussion of that venue starts, a few seconds before the first mention, not the instant of the name.
- For audio-derived text there is no source timing. Establish timing by cutting short clips from the MP3 around the estimate (`ffmpeg -ss START -t LENGTH -i ep.mp3 -c copy clip.mp3`), transcribing each clip, and reading it. Start positions are then known to the clip, and accurate to about ±5 to 10 s after clip refinement (historical figure for ep 180), not exact.
- A clip boundary is not a quote boundary. The quote is the words you verified inside the clip; record the quote's own approximate span separately from the clip's start and duration.
- Quotes: keep them as contiguous spans of what the speech-to-text returned for one pass. Where two passes disagree on a word, either stop the quote before that word or say so in the record (historical: Skô quote stops before "פטרוזיליה", which a second pass heard differently from "פטל"; Love Story quote begins mid-sentence because the first word was heard two ways). Do not clean up wording or stitch two places.
- Spot-check against the YouTube player: seek to the second and read the player's own caption line. This is a supplement for timing only, not the source of the quote, and not proof of exactness (historical: 6 probes on ep 180 agreed within a few seconds).

### Step 7. Photos

- Search the venue's own site and social pages (Hebrew and English). Prefer food; real interior is acceptable and labeled. Look at pixels. Reject logos, posters, banners, portraits, curtains, other branches, duplicates.
- Upload an owned copy: `POST /api/admin/venue-images?restaurant_id=<uuid>&source_url=<https page>&credit=<text>` with the image bytes and `Authorization: Bearer <API_SECRET_KEY>`. Max 5 MiB, JPEG, PNG or WEBP. It returns `asset_path` and `sha256`; it does not change any restaurant. The restaurant's `image_url` is then `https://where2eat-production.up.railway.app/api/venue-images/<sha256>.jpg`.
- If no suitable photo exists, record `photo.status: unavailable` with a reason and leave the image fields empty (historical: 2 of 5 venues in 180).
- Do not use Google Places photos as the hero. They need paid proxy calls and are not stored.
- Check after publish that the photo renders on the live page. Vercel image optimization returned 402 on 2026-11-27, so thumbnails may show alt text there even when the stored image is correct (see `docs/operations/2026-11-27-image-402-and-photo-repair.md`).

### Step 8. Build the payload and check it offline

- Build one JSON: `episode`, `restaurants[]` (each with `publication_review`), `transcript_segments`. Schema: `docs/episode-publication-quality.md`.
- `transcript_segments` rules: see section 6 of this runbook.
- Local check, no network, no writes:
```bash
PYTHONPATH=src python3 scripts/check_episode_publication.py PAYLOAD.json --data-dir DATA_DIR
```
Exit 0 means the evidence is complete, exit 1 prints every blocker. On a legacy extraction (no review evidence) it fails with `identity_context_unverified`, `discussion_not_reviewed` and `photo_review_missing` per venue (run on episode 142, 5 venues, 15 blockers).
- Save the payload and the transcript text into `agentic_extractor/<video_id>/` in a branch. (Existing convention: `agentic_extractor/episode_<id>_extraction.json` and `agentic_extractor/<id>/transcript.json`.)

### Step 9. Snapshot, then seed

- Snapshot first (read-only): `GET /api/episodes?limit=200` and `GET /api/restaurants?limit=1000` into files with the date. `scripts/export_production_snapshot.py` writes the same into `data/snapshots/` (its last committed run was 2026-04-24; it has not been run in this rehearsal).
- Seed: `POST /api/episodes/seed` with an admin bearer token and the payload. Seed validates again, saves a review copy under `DATABASE_DIR/publication_reviews/`, creates the episode, then DELETES all existing mentions for that `video_id` and re-inserts. Never reseed an episode just to fix one timestamp or quote.
- Corrections to existing data go through the audited maintenance API (`api/routers/admin_maintenance.py`, `docs/ADMIN_MAINTENANCE.md`): snapshot first, apply, read back.
- A 422 from seed lists the blockers and writes nothing. Fix and resend.

### Step 10. Verify on the live site

- Episode page `https://www.where2eat.rest/episode/<video_id>`: the new venues appear, the quotes and times are the intended ones, links jump to the right second, photos render.
- API read-back: the stored values equal the payload.
- Open the YouTube player at the stored second for each venue and compare. Abort any `/api/photos` request in the test browser (paid).
- Write what you checked and what you did not into the episode record.

### Step 11. Close out

Commit the episode record, payload and transcript text to a branch and open a PR. Do not merge. State: what was published, what is unverified, cost estimate before/after.

## 4. Failure table

| Symptom | Likely cause | Action |
|---|---|---|
| 403 from Railway on scripts (Cloudflare 1010) | Default client signature blocked | Send an identifying `User-Agent` (historical fix, 2026-11-13). |
| Admin login fails | Wrong credential variable names (two sets exist) | Check Railway variables; do not guess passwords. |
| Seed 422 `identity_context_unverified` etc. | Missing review evidence | Add real evidence. Do not paste placeholder values. |
| Seed 422 `discussion_quote_not_in_timed_source` | Quote not in the supplied segment text near the selected second | Fix the quote or the segment span. Do not edit segments to contain the quote unless the text really came from that audio. |
| Seed 422 `durable_photo_bytes_missing_or_changed` | Upload not on the server volume | Re-upload with the bearer; check `DATABASE_DIR` is the volume. |
| Transcript chunk is repeated characters | Speech-to-text loop | Re-transcribe in shorter windows; distrust the region until re-done. |
| Transcript cut mid-word at a boundary | Chunk edge | Overlap the next transcription, or re-read the edge as a short clip. |
| Thumbnails show alt text on the live site | Vercel 402 (image optimization) | Not a data error. Verify the stored URL directly. |
| Budget message or ledger near 10 | Cost guard | Use free sources only; ask the owner before any paid call. |
| YouTube blocks transcript fetch from Railway | Memory record, not retested | Not needed for the audio route. |

## 5. Historical evidence from episodes 179 and 180 (not a template to copy blindly)

- Audio route and chunked speech-to-text were used for both. No project model key (Gemini, Claude) was used.
- Ep 180 started from 5 audio chunks, a looped chunk was re-done in windows, and the first payload gave each venue one synthetic segment (start = an estimated second, duration = 90 s times the number of windows, text = the concatenated window texts). The quote was asserted to be inside that text. Later QA re-derived starts from 20 s clips and moved them (for example Gettó Gulyás 270 to 290, Love Story 540 to 485).
- Whether the saved server-side review copy was updated after the QA timing change was not recovered.
- 179 used the same pattern (one segment per venue from a clip text file).
- Neither run had a human listen. The stored quotes mean "two speech-to-text passes agree and the player spot-check is consistent".

## 6. Rules for `transcript_segments` and timing

The gate needs timed segments. Without original timed source segments the temptation is to fabricate them. Do not.

1. If an original timed source exists for those seconds (for example captions), supply it as is. Note that captions are precisely formatted but not necessarily accurate: their words can be wrong.
2. If you built segments from clips you transcribed, each segment is a record of a real clip: `start` is the clip's actual start second in the audio, `duration` its real length, `text` the full text returned for that clip, unchanged. Do not set a start just to land near the quote, do not merge several clips into one segment with a start that fits only one of them, do not trim or extend text so the quote fits.
3. The selected discussion second must be an actual clip or window start you cut. A quote span inside the clip is recorded separately in the episode record (`quote span estimate`), as an estimate, not as a segment start.
4. Record in the episode record that the gate passed on self-made clip segments. That is the honest label for 179 and 180: internal consistency, not independent timing proof.
5. Never describe any timestamp as exact. The best recovered accuracy is about ±5 to 10 s.

The independent axes recorded per timestamp are in the template: raw source, clip start and duration, alignment method, verification method, uncertainty, speaker confidence, gate evidence. They are separate facts, not a ranking.

## 7. Offline rehearsal, 2026-11-27

See `docs/operations/episode-records/2026-11-27-handoff-rehearsal-wlCpj1zPzEA.md`. What it demonstrates: the repository-only steps that are free and read-only (feed listing, local gate on a real episode, ffmpeg chunk and clip commands on synthetic audio, existing test suite). What it does not demonstrate: audio download and speech-to-text of a real episode, venue identification, photo choice and upload, seed, live verification, restore from backup.

## 8. Backup and recovery (not solved here)

Git alone does not rebuild the live site. Postgres data and venue images on the Railway volume are outside Git. A scheduled Postgres dump, a volume copy including `venue_images/` and a tested restore are not verified to exist (`docs/PROJECT_OVERVIEW.md` section 4a). Before any seed, take the snapshot in step 9 and keep it.

## 9. Residual gaps

- No live end-to-end run from this document. First live use should be on the next real episode with the owner reviewing the result.
- Local tests need the repository requirements installed: `pip install -r requirements.txt -r api/requirements.txt` in a fresh virtual environment (with only pytest, fastapi and httpx, 2 of 32 gate tests fail on a missing `jose`). With them, 32 of 32 passed on Python 3.10 (CI uses 3.11, not tested here).
- In the legacy episode 142 extraction, stored venue seconds and stored quotes can be far apart (up to about 131 s for one venue); the cause was not verified against audio. Record the clip start and each quote time separately.
- Credential variable names differ between the agent files and the 179/180 scripts.
- No documented speech-to-text tool is pinned; error rate was never measured against a human reference.
- Speaker identification is manual and uncertain.
- Seed replaces mentions per episode; there is no dry-run endpoint, only the offline check.
- Where the older agent sections disagree with this runbook (captions step, `POST /api/restaurants` uploads, output folders), this runbook wins; the agent files were updated to say so but still contain legacy text.

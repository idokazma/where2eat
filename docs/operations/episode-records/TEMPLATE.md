# Episode record: <video_id> (episode <N>, <title>)

[עברית: TEMPLATE.he.md](TEMPLATE.he.md). Same content in Hebrew; file names, fields, endpoints and commands are identical.

Copy this file to `docs/operations/episode-records/<video_id>.md` and fill it in as work proceeds. Leave unknowns as `unknown`. Do not guess. Never put secrets here.

## 1. Identity
- Podcast / channel:
- Episode number and title:
- YouTube video id and URL:
- RSS item (pubDate, enclosure URL):
- Published (date):
- Operator (person or assistant) and date of work:
- Owner's request (message reference, date):

## 2. Audio and transcript source
- Audio file: duration (s), size, source URL, download date:
- YouTube video length (s), difference from audio:
- Speech-to-text used (name, version or date):
- Chunk count and lengths (s):
- Transcript files committed (paths):
- Problems seen (loops, cut words, repeated text) and how handled:
- Region(s) of the audio not read or not trusted:

## 3. Venue table
One row per venue. Axes are independent facts, not a ranking.

| Venue (Hebrew / English) | Tasted or mentioned | Speaker | Speaker confidence | Identity source URL and clues | Same-name conflicts checked | Verdict | Photo status |
|---|---|---|---|---|---|---|---|

## 4. Timing table
| Venue | Raw source of the words | Clip start (s) | Clip duration (s) | Alignment method | Verification method | Uncertainty (s) | Selected second | Quote span estimate (s) | Gate evidence |
|---|---|---|---|---|---|---|---|---|---|

Rules: clip start and duration are real values of a clip you cut. The quote span is a separate estimate. If `transcript_segments` were built from your own clips, write `gate passed on self-made clip segments`, not "verified".

## 5. Quotes
For each quote: exact text as stored, which pass(es) produced it, words where passes disagreed, whether the quote starts or ends mid-sentence.

## 6. Photos
Per venue: source page, credit, content kind (food or interior), sha256, rendered on the live page (yes, no, not checked). Unavailable photos with the reason.

## 7. Cost
- Ledger estimate before and after (`GET /api/admin/maintenance/costs`):
- Paid calls made (kind, count) and who approved them:
- `/api/photos` requests: none (record any):

## 8. Publication
- Local gate output (paste the JSON result):
- Snapshot files taken before seed (paths):
- Seed time and response:
- Live checks done (episode page, card image, YouTube at the second) and not done:
- PR:

## 9. Open items and unverified claims
-

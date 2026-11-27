# Handoff rehearsal, 2026-11-27: episode 142 (wlCpj1zPzEA), offline

[עברית: 2026-11-27-handoff-rehearsal-wlCpj1zPzEA.he.md](2026-11-27-handoff-rehearsal-wlCpj1zPzEA.he.md). Same content in Hebrew; file names, fields, endpoints and commands are identical.

This is a rehearsal of the runbook on an episode that already exists in the repository. Nothing was published, nothing was written to production, no paid call or provider request was made, no audio of a real episode was downloaded. It is not a record of a new episode and not a verification of episode 142's content.

Episode: `wlCpj1zPzEA`, "מחרוזת מתוקים | מדברים מהבטן, פרק 142", published 2026-01-21 (from `agentic_extractor/episode_wlCpj1zPzEA_extraction.json`).
Inputs used (repository only): that extraction file, `agentic_extractor/wlCpj1zPzEA/transcript.json` (captions, 1383 segments, source field `youtube-transcript-api-generated`, language `iw`), `scripts/check_episode_publication.py`, `src/publication_quality.py`, `tests/test_publication_quality.py`.
Environment: Python 3.10 on the rehearsal machine (CI uses 3.11), ffmpeg and ffprobe, no repo secrets.

## What was run and what happened

| # | Runbook step | Command / action | Result |
|---|---|---|---|
| 1 | Step 1, pick episode | Read public RSS `https://feeds.megaphone.fm/POLTD3242143576` (read-only) | HTTP 200, 181 items; newest are ep 180 (2026-11-25), 179 (2026-11-18), 178 (2026-11-11), each with an MP3 enclosure URL. |
| 2 | Step 2, audio | `HEAD` on the ep 180 enclosure URL only | HTTP 302 redirect (so the link responds). The MP3 itself was not downloaded. |
| 3 | Steps 3 and 6 command check | On a synthetic 40.05 s sine-tone MP3: `ffmpeg -f segment -segment_time 15 -c copy` and `ffmpeg -ss 20 -t 10 -c copy`; `ffprobe` for durations | Chunks of 15.02, 14.99 and 10.03 s. Clip of 10.06 s. The commands work. No speech was involved, so this says nothing about transcription. |
| 4 | Step 8, local gate | Built a payload from the existing extraction plus `transcript_segments` from the captions file; ran `PYTHONPATH=src python3 scripts/check_episode_publication.py PAYLOAD --data-dir EMPTY_DIR` | Exit 1. 5 venues with verdict `add_to_page`, 3 blockers each (15 total): `identity_context_unverified`, `discussion_not_reviewed`, `photo_review_missing`. As designed: this extraction predates the review evidence. |
| 5 | Timing sanity (informational, not a gate) | For each of the 5 venues, compared stored `timestamp.seconds` with the nearest caption segment start and searched the captions from 10 s before to 60 s after | Stored second vs nearest caption start: 194 vs 194.959, 810 vs 810.079, 1594 vs 1594.799, 2754 vs 2754.359, 1429 vs 1429.799. The venue name appears in the window for all 5. The first 30 characters of the stored first quote appear in the window for 2 of 5 (דוק, טאורוס) and not for 3 (אגדיר, בבקה, גריל 65). Reason not investigated: the stored quote may be edited wording, or the captions may differ. |
| 6 | Existing tests | `PYTHONPATH=src python3 -m pytest tests/test_publication_quality.py` | 30 passed, 2 failed. Both failures are `ModuleNotFoundError: No module named 'fastapi'` (the rehearsal machine had no project dependencies), so they test seed integration and could not run here. Not a code failure; not investigated further. |

## What this shows
- The offline parts of the procedure run from the repository alone: feed listing, the local gate, chunk and clip commands, the gate unit tests (30 of 32 ran).
- An older extraction cannot be published without new review evidence. The gate says so per venue.
- Captions give timing that is well formatted. They do not prove the stored quotes are verbatim: 3 of 5 first quotes were not found in the caption window.

## What this does not show (unproven)
- Downloading a real episode's audio and transcribing it. No speech-to-text was run.
- Identifying a venue, choosing and uploading a photo, writing real `publication_review` values.
- Seed against a running server, the 2 skipped seed tests, live verification, snapshot export, restore.
- That a person with no prior context can complete a real episode from these documents. Next real episode is the actual test, with the owner reviewing.

## Gaps found by the rehearsal and fed back to the runbook
- Two sets of admin credential variable names exist (agent files vs the 179/180 scripts).
- The agent files used folder names (`analyses/`, `data/restaurants/`) that do not match the committed layout (`agentic_extractor/`).
- The deployer instructions uploaded restaurants through `POST /api/restaurants`, which does not run the gate.
- The captions step in the processor instructions conflicts with the audio requirement.

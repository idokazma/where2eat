# Handoff rehearsal, 2026-11-27: episode 142 (wlCpj1zPzEA), partial rehearsal, not a full success

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
| 6 | Existing tests | `PYTHONPATH=src python3 -m pytest tests/test_publication_quality.py` | 30 passed, 2 failed in the first run (32 passed after installing the repository requirements, see the follow-up section). Both failures are `ModuleNotFoundError: No module named 'fastapi'` (the rehearsal machine had no project dependencies), so they test seed integration and could not run here. Not a code failure; not investigated further. |

## What this shows
- The offline parts of the procedure run from the repository alone: feed listing, the local gate, chunk and clip commands, the gate unit tests (30 of 32 ran).
- An older extraction cannot be published without new review evidence. The gate says so per venue.
- Captions give timing that is well formatted. They do not prove the stored quotes are verbatim: the crude exact-substring check did not find 3 of 5 first quotes in the caption window (see the follow-up section for the better check).

## What this does not show (unproven)
- Downloading a real episode's audio and transcribing it. No speech-to-text was run.
- Identifying a venue, choosing and uploading a photo, writing real `publication_review` values.
- Seed against a running server, the 2 skipped seed tests, live verification, snapshot export, restore.
- That a person with no prior context can complete a real episode from these documents. Next real episode is the actual test, with the owner reviewing.

## Gaps found by the rehearsal and fed back to the runbook
- Two sets of admin credential variable names exist (agent files vs the 179/180 scripts).
- The agent files used folder names (`analyses/`, `data/restaurants/`) that do not match the committed layout (`agentic_extractor/`).
- The deployer instructions uploaded restaurants through `POST /api/restaurants`, which does not run the gate.
- The captions step in the processor instructions conflicted with the audio requirement (historical; changed in this PR).

## Follow-up run (same day): dependencies and quote check

Which parts were online and which offline: the RSS read (step 1) and the HEAD request (step 2) are online network reads of public URLs. Steps 3 to 6 ran locally. The ffmpeg test (step 3) used a synthetic tone, so it tests the commands only. It is not a transcription rehearsal: no real audio of any episode was transcribed and no automatic speech-to-text was run.

Dependencies. The first run had Python 3.10 and no project packages, hence the 2 failed tests. Bounded setup: a fresh virtual environment on the same machine, then `pip install -r api/requirements.txt` and `pip install -r requirements.txt` from the repository (public package index, no paid services, no secrets). Result with Python 3.10, pytest 9.2.0, fastapi 0.162.5, starlette 1.7.0, pydantic 2.14.4, python-jose 3.5.0, SQLAlchemy 2.0.58 (installed versions as resolved that day, not pinned by the repo): `PYTHONPATH=src python -m pytest tests/test_publication_quality.py -q` gave 32 passed, 0 failed. The first attempt with only pytest, fastapi and httpx still failed on `jose`, so the minimal set is the two requirements files. CI uses Python 3.11; this run did not.

Quote check, bounded diagnosis. Step 5 compared the first 30 characters of the first stored quote as an exact substring of the caption window (10 s before to 60 s after the stored second). That test is crude: it fails on any wording difference. A second check used word overlap (punctuation removed, word sets). For the first stored quote of each of the 5 venues: the best 12-caption window anywhere in the transcript has word overlap 1.00 for 4 venues and 0.75 for one (Bebeka). So the quote words do exist in the captions. But where they appear differs from the stored second:

| Venue | Stored second | Start of best-matching caption window for quote 1 | Difference |
|---|---|---|---|
| Agadir | 194 | 325.3 | +131 s |
| Bebeka | 810 | 794.9 | -15 s |
| Grill 65 | 1594 | 1591.1 | -3 s |
| Dok | 2754 | 2811.2 | +57 s |
| Taurus | 1429 | 1413.2 | -16 s |

Within the fixed window, word overlap of quote 1 was 0.50 (Agadir), 0.75 (Bebeka), 1.00 (Grill 65), 1.00 (Dok), 1.00 (Taurus). Some later quotes of the same venue have low overlap in the window (for example 0.00 to 0.29), so they are either later in the episode or edited wording. Conclusion, limited to this one episode: the stored seconds mark where the venue is first discussed (or near it), and quotes can come well after it. I did not read the audio, so I cannot say which stored quote is verbatim. The word-set check is weak (it ignores order). The earlier "2 of 5" figure is a property of the crude test, not of the quotes. Open question for a real episode: store one clip start for the venue and a separate time for each quote (the runbook already separates clip boundaries from quote boundaries).

Overall status of the rehearsal: the local tooling runs and the gate behaves as designed. It is not a successful handoff: no real audio, no real transcription, no venue identification, no seed, and quote verbatim-ness against audio is unchecked.

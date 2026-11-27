# Transcripts, timestamps and verification: technical guide

[עברית: TRANSCRIPTS_AND_TIMESTAMPS_GUIDE.he.md](TRANSCRIPTS_AND_TIMESTAMPS_GUIDE.he.md). Same content in Hebrew; file names, fields, endpoints and commands are identical.

Companion to `docs/operations/EPISODE_CONTINUITY_RUNBOOK.md`. This file explains where text and time information come from, their formats, what each can and cannot prove, and what happened in real runs. Labels: **Evidence** (observed, with source), **Recommended**, **Unproven**.

## 1. Sources of transcript text

| Source | How | Output | Used for | Limits |
|---|---|---|---|---|
| YouTube captions through project code | `src/youtube_transcript_collector.py`: DB cache, then `youtube-transcript-api` list/fetch, then `yt-dlp` fallback; 30 s rate limit | JSON with `segments` of `text`, `start`, `duration` | Server pipeline (layer A); `.claude` `episode-processor` step 1 (layer B); older assisted episodes | Automatic captions (ep 142 file says `youtube-transcript-api-generated`, language `iw`). Not the owner's approved source. Memory records say YouTube blocks Railway; not retested. Timing is rolling and overlapping (see 2). |
| Publisher audio (RSS MP3) plus speech-to-text | Feed `https://feeds.megaphone.fm/POLTD3242143576`, MP3 from the item's `enclosure` | Text per audio chunk. No timestamps, no speaker names | Episodes 179 and 180 (Evidence) | Automatic recognition: wrong words, loops, cut words, no speakers. Timing must be rebuilt. |
| Human transcription | none recorded | | | |
| Third-party transcript service | proposed and rejected by the owner (memory: analysis-engine-and-transcript-source.md) | | | |

Evidence for the audio route: ep 179 audio 65:35 split into 5 chunks; ep 180 MP3 about 82 MB, 4095.756 s, 5 chunks. The YouTube video for 180 (`HFfKdElnvuM`) is 4095.6 s long, so MP3 and video agree within 0.2 s on total length.

## 2. Formats

### Captions (repo file `agentic_extractor/wlCpj1zPzEA/transcript.json`, episode 142)
Keys: `video_id`, `video_url`, `transcript`, `segments`, `language`, `segment_count`, `cached`, `source`. Segment: `{"text": ..., "start": seconds_float, "duration": seconds_float}`.
Example (public podcast words from that file): `{"text":"בוקר טוב עמית ויונתן.","start":0.04,"duration":3.52}`, then `{"text":">> בוקר טוב נטא. בוקר טוב אמית.","start":1.52,"duration":4.759}`.
Measured on that file: 1383 segments, text median 37 characters (max 43), duration median 5.3 s (max 12.1 s), last segment ends about 3620 s. 1378 of 1382 neighbouring pairs overlap (`start + duration` runs past the next `start`), so they are rolling captions: do not read `start + duration` as an end. 423 segments contain `>>`, a speaker-change marker; there are no names. A second file (`8OD5R1uwqkc`, language `he`, no `source` field) has the same shape: 1477 segments, 381 with `>>`. The repo holds 38 `transcript.json` files; how each was produced was not checked beyond these two.
A caption can be precisely timed and still wrong (misheard words). Precision of format is not accuracy.

### Audio route output
Plain text per chunk. No `start`, no `duration`, no speaker. Any timing you attach later is something you built. See section 3.

### Seed payload (what the site stores)
`episode`; `restaurants[]` with `timestamp.seconds` (or `mention_timestamp_seconds`), quotes, `publication_review` (identity, discussion, photo); `transcript_segments[]` with `start`, `duration`, `text`. Schema and rules: `docs/episode-publication-quality.md`. The gate's timing check, from `src/publication_quality.py`: the selected second must not exceed the maximum `start + duration` of the supplied segments; some supplied segment must start within 1 s of the selected second; the quote (at least 8 characters) must be contained in the joined text of segments starting between 10 s before and 60 s after the selected second; the review's `selected_seconds` and `video_id` must match.
What this proves: the quote and the second are consistent with the segments you supplied. What it does not prove: that the segments are true, that the second is where the words are in the audio, who spoke, or that the venue is right.

## 3. Timestamps: provenance, as independent facts

Record these for each timestamp. They are separate axes, not a ranking. A player check, for example, is a supplement, not a higher-quality source.

| Axis | Meaning | Examples |
|---|---|---|
| Raw source | where the words came from | captions segment; speech-to-text of a clip; speech-to-text of a chunk |
| Clip start and duration | the real audio span transcribed, if any | clip cut at 2475 s, 20 s long |
| Alignment method | how the second was chosen | clip start; character-position estimate inside a chunk; nearest caption segment |
| Verification method | what was compared | second transcription pass; YouTube player caption line at the second; listening (not done in 179/180) |
| Uncertainty | stated, in seconds | about ±5 to 10 s (ep 180 own statement) |
| Speaker confidence | known, likely, unknown | |
| Gate evidence | what satisfied the gate | original timed segments; segments built from own clips |

A clip boundary is not a quote boundary. The clip is where you cut. The quote is the words you verified inside it. Store the clip as the segment and the quote span as a separate estimate.

## 4. Verification and what it cannot do

- Analysis (layer A, not used for 179/180): a model prompt over transcript text; analysis is a draft only.
- Assisted route (Evidence, ep 180): read all chunks; list venues; find each venue's own pages; re-transcribe short windows to fix quotes and times; choose photos from the venue's own pages; upload through the admin API; check the live page and YouTube player.
- Cannot do: replace listening to the recording; measure the error rate of speech-to-text (never measured against a human reference); assign speakers without labels; prove a venue identity from a name.

## 5. Real cases (Evidence from the 179 and 180 run records)

1. Speech-to-text loop (ep 180): chunk 3 came back with repeated zeros and a chunk edge cut a word mid-way (`אבוקדו ירוק חמאה כ`). The run judged times after about 3000 s untrustworthy and re-transcribed 2550 to 3650 s in 90 s windows (about 18 reads).
2. Estimated timing replaced (ep 180): the first seed used one synthetic segment per venue: start at an estimated second (270, 540, 2490, 2940, 3210), duration 90 s times the number of windows, text the concatenation of the 90 s window transcripts, and an assertion that the quote was inside that text. The gate passed on this. A later QA with 20 s clips set starts of Gettó Gulyás 290, Love Story 485, Café Keshet 2475, Hamudi Plus 2930, Skô 3240 with quote spans 362-380, 652-685, 2664-2682, 3122-3148, 3338-3364 (about ±5 to 10 s). Whether the saved server-side review copy was updated afterwards was not recovered.
3. Player check (ep 180): six probes (368, 500, 668, 2672, 3128, 3344 s) against the YouTube player's caption line agreed with the MP3-based times within a few seconds. A sample, not every second.
4. Quote correction (ep 180, Skô): a second pass heard the goulash sentence end `פטרוזיליה`, not `פטל`, so the stored quote stops before it. Three short clips for the Skô intro failed to transcribe, so that start rests on neighbouring clips.
5. Quote edge (ep 180, Love Story): the quote begins mid-sentence at `מצוין ואני בוודאות` because the first word was heard as both `והמבורגר` and `ההמבורגר`.
6. Same name, different venue: "Love Story" exists in the catalog as a Tel Aviv burger place (hidden record) and also as a venue discussed in ep 180. The run compared the transcript before deciding whether to link or add. Which was chosen was not re-inspected.
7. Identity before photo: for Hamudi an Instagram handle with 17 images was found, but the page was read first because a similar handle might be another business.
8. Speaker attribution: no labels; the Prague "Love Story" lines could be either of two hosts from gendered Hebrew forms alone. Some attributions were left open.
9. Photos: 3 of 5 venues in ep 180 got a venue-owned photo (two official sites, one Instagram), 2 were marked unavailable with a reason.
10. Earlier episodes (ep 179 briefing): a previous worker had copied short caption fragments and misidentified speakers, branches, and tasted versus mentioned. This led to the audio requirement.
11. Cloudflare error 1010 from Railway (ep 177-178 and 179): fixed by an identifying `User-Agent`.
12. Cost (ep 180): the ledger read about 9.17 of 10 (estimate, opening spend unverified), so only free sources were used for identity and photos.

## 6. Recommended practice, in one list

1. Audio route, chunks, full read of every chunk.
2. Re-transcribe short clips for every venue to get time and quote.
3. Build `transcript_segments` from real clips only (runbook section 6).
4. Fill the per-episode record, including the axes above.
5. Offline gate, then snapshot, then seed, then live verify, then commit the record.
6. Say plainly in the record what was not checked.

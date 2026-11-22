# Quote repairs (22.11.2026)

Nine undoable maintenance operations on seven mentions. Details and undo ids: `2026-11-22-quote-repairs-ops.json`. Timings are approximate (+-1-2 s), not word alignment.

Known remaining gaps, not fixed:
- Restaurant-level `engaging_quote` and `mention_timestamp_seconds` (for example Anur 330, Dizengoff 1945) are still the old values. The stories cards read the episode mentions, so they do not show them. This is not a site-wide quote cleanup. Roughly 300 other quotes are unverified raw ASR.
- Lehamim (ep175 @171 s) is probably Zeit fur Brot, Ramat Aviv. Waiting on the user. Nothing changed.
- Future audit: ep175 mention Barad (f11ca897) carries a verified_quote with a 200 s window (1395-1595). It was not written by this work and was not touched.
- Dizengoff mention record carries Jerusalem city/coords and an odd English name. Untouched.

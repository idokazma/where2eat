# Episode 171 interview canary (22.11.2026)

Scope: 2 of the 10 places in episode 171, the two verified against the audio. Nothing hidden, nothing deleted.
Applied through the maintenance repair API (preview, then PATCH). Undo with POST /api/admin/maintenance/operations/{operation_id}/undo (ids in the JSON).

Finding: episode 171 is an interview with Chaim Cohen. The raw ASR quote for Dizengoff 99 ("דנג אוף 99...") is a host question with a garbled name, not a review.
Only the Dizengoff 99 and פיצי mentions were checked (audio 1925-2000 s). The other 8 places in this episode are unverified and unchanged.

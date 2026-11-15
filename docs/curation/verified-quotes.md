# Reviewed display quotes

Raw `episode_mentions.host_quotes` remain immutable. They are extraction
source material, not evidence that text was proofread or checked against audio.

Editors can use the existing revision-bound mention repair API to set a separate
`verified_quote` object:

```json
{
  "changes": {
    "verified_quote": {
      "text": "A complete, short sentence checked against the recording.",
      "source_url": "https://example.com/publisher-recording.mp3",
      "start_seconds": 300,
      "end_seconds": 330
    },
    "host_comments": "Editorial context, not a direct quotation.",
    "speaker": "Verified speaker"
  }
}
```

POST `/api/admin/maintenance/mentions/{id}/preview`, then PATCH the same resource
with the returned `revision`. The actor and review time are stored by the server.
The existing transaction stores before/after snapshots and supports conflict-safe
undo. Raw quote writes are still rejected. Set `verified_quote` to null to restore
the unreviewed source display; undo is preferable when reverting a correction.

GET episode detail and restaurant mentions expose the reviewed text in the
existing `host_quotes` display field, the raw extraction as `source_host_quotes`,
and the review evidence as `verified_quote`. This means the existing episode UI
can display a corrected quote without pretending it is the original transcript.
The database's raw `host_quotes` column is never overwritten.

Only direct speech belongs in `verified_quote.text`. Do not rewrite a summary or
paraphrase into quotation marks. Check the recording, choose a complete sentence,
and use host_comments for context. A source URL and range record the review;
validation cannot establish that a reviewer actually listened or that a quote is
accurate. Existing unreviewed quotes are not automatically approved by this change.

Restaurant cards have their own `engaging_quote` and `host_comments` fields.
Updating those does not update episode mentions. Update each surface explicitly,
with before snapshots. The restaurant PATCH now also accepts a validated
`mention_level` so a corrected mention is not contradicted by its homepage badge.

## November 15 correction set

`2026-11-15-quote-corrections.json` records the six newest cards, publisher audio
URLs and reviewed audio ranges. Restaurant changes were applied through the
existing API. Mention `verified_quote`, comments and speaker changes are **not
applied** by committing this file. After deployment, re-read each live row, preview,
apply a canary, verify the rendered episode page, then apply the remainder.
Do not reseed: the seed endpoint replaces mention rows.

Bono is a discussion of Avi Efrati's review, not a tasted review given in this
episode. Its mention_level was corrected to הוזכר through the existing maintenance
API. Its separate homepage restaurant badge still needs the matching PATCH after
deployment. Pizza 194's discussion is about the Ness Ziona branch, while the seeded
card links to Rehovot. Branch relinking is not part of the quote correction payload;
verify and correct the venue separately rather than silently moving its Place ID,
map or rating. The official site https://www.pizza194.co.il/ lists Ness Ziona at
Moshe Lerer 1 and Rehovot at Ahad Ha'am 1.

The audit covered 50 episodes, 662 mentions, 567 with source quotes. These are
inventory counts, not an error count. Older quotes also need recording review.

# PRD: Where to eat, and according to whom?

**where2eat in ChatGPT and Gemini • Fresh restaurant answers backed by the creator's review moment**

- **Version:** 0.3
- **Date:** November 20, 2026
- **Product owner:** Ido Kazma
- **Status:** Draft. A proposal, not approved for development.
- **Changes in 0.3:** the product is the serving layer only. Collecting and extracting creator content is solved by the existing agentic pipeline and is out of scope. See the change log at the end.

> v0.1 was translated from the Hebrew PRD delivered on 2026-11-20. v0.2 and v0.3 revise it in English; where they differ, this version supersedes the Hebrew v0.1.

---

## 1. Summary

**People already ask ChatGPT and Gemini where to eat. Their answers lean on Google listings and older web content, not on what food creators said last week. where2eat answers inside those assistants with fresh, creator-backed evidence: the place, who recommended it, what they said, when, and a link to the exact moment in the video.**

where2eat's agentic pipeline already watches creators, extracts restaurant mentions with timestamps and quotes, and publishes reviewed entries (about 346 places today, from מדברים מהבטן). This PRD covers only how that published data is served to people through ChatGPT and Gemini.

### Why now

Both assistants now accept third-party apps built on the same standard, MCP (Model Context Protocol):

- **ChatGPT** accepts reviewed app submissions, with identity verification and per-country availability settings. [1–3]
- **Gemini** opened a preview of Google's Connected Apps Platform on 2026-10-28: MCP apps that run in Gemini and Google Search, registered in the Google Connected Console, with mandatory review and a ban on serving third-party ads through the integration. [4–5]

One read-only MCP server can therefore serve both.

### The claim to prove

"Assistants don't know what creators said recently, and where2eat makes their answers better." The first half is Ido's hypothesis, not a measured finding. Stage 0 tests it cheaply before building (section 9).

### Out of scope

Content discovery, transcription, extraction, enrichment and publication review: these belong to the existing pipeline and its publication gate. The serving layer only reads what the pipeline has published. Also out of scope: bookings, payments, user accounts, a unified creator score, and any write access from the assistants.

The demos for Gil Harel, Niv Gilboa, Yubi Yam, Daniel David and Carnivorim Originale are illustrations, not a partnership or a connected source.

---

## 2. Users and journeys

- **Intent-driven diner.** Asks the assistant for a place by area, dish, style or occasion, and wants to know why it fits without watching a full episode.
- **Creator follower.** Asks "where did [creator] eat recently?" or "what did they think of X?"
- **Scene enthusiast.** Asks what's new or getting attention lately.

### Core journeys

1. "Where's good hummus near Tira?" → the assistant calls where2eat → up to three places, each with the creator, a short excerpt, the date and a link to the moment → the user opens the moment or the map.
2. "Where did Medabrim MeHaBeten eat this month?" → recent mentions by publication date, newest first.
3. "Is Abu Omar worth it?" → every mention of that place across creators and episodes, positive and negative, each dated, with no invented average.

---

## 3. What we build

### R1 | A read-only MCP server

Hosted alongside the existing FastAPI API and reading the same published data. Proposed tools (names and shapes to settle in Stage 1):

- **`search_restaurants`** — filters: city or area, cuisine, dish, creator, published after, tasted vs mentioned, limit (max 5). Returns places with evidence (R2).
- **`get_restaurant`** — one place: details, map link, and every mention across creators and episodes, each with date, excerpt and link to the moment.
- **`whats_new`** — mentions published in the last N days (default 30), optionally by city or creator, newest first.
- **`list_creators`** — which creators are included, how many places each, and when each was last updated, so coverage limits are explicit.

The assistant interprets the user's question and calls these tools. **where2eat pays no language-model cost per question:** the server only runs database queries.

### R2 | Every result carries its evidence

Restaurant name and city · creator (channel) and speaker if known · tasted vs mentioned · publication date of the source · a short excerpt · a link to the exact moment (`youtube.com/watch?v=…&t=…s`) · map link · rating where available. Most of this already exists in the data (`episode_mentions`: `host_quotes`, `verified_quote`, `timestamp_seconds`, `mention_level`, `speaker`; `episodes`: `channel_name`, `published_at`).

### R3 | Quote versus summary

An excerpt is returned as a **quote** only when it was checked against the audio (`verified_quote`, added in PR #287). Otherwise it is returned as a **summary**, explicitly labeled. Tool descriptions instruct the assistant to attribute every claim to the named creator, keep summaries out of quotation marks, and always include the link. We cannot fully control how an assistant phrases its answer, so the structured fields must make the right answer the easy one.

### R4 | No match, no invention

When nothing in the catalog matches, the tool returns an explicit "no coverage" result with the reason (city not covered, creator not included, nothing in the date range). It never returns the nearest place that fails a hard filter.

### R5 | Interface

Baseline: structured results that both assistants can render as text with links. Next: ChatGPT result cards (Apps SDK supports cards and carousels; embedding third-party frames such as YouTube players is restricted, so cards link out). [1] Card support in Gemini is to be checked during the preview.

### R6 | Only published data

The server serves only entries the pipeline has published. Rejected, review-held and draft entries are never exposed. Hidden restaurants stay hidden.

---

## 4. Freshness

Freshness is the pitch, so every result shows the source's **publication date**, and "new" means published within the last 30 days, labeled "by publication date". A new video about an old visit is not a "new visit". Visit dates are rarely stated in podcasts; the field can be returned when known but nothing is built on it in v1. Opening hours, prices, kashrut and similar details are returned with their source and date, never as current fact.

How fast new episodes reach the catalog is the pipeline's job. The serving layer exposes `last_updated` per creator (via `list_creators`) so staleness is visible rather than hidden.

---

## 5. Content use without prior permission

Ido has decided not to wait for creator permission. Serving excerpts inside third-party assistants makes these controls more important, not less. They are requirements:

- **Excerpts, not copies.** Short excerpts only (proposed: up to two sentences per mention). Never full transcripts, never re-hosted video, audio or creator images.
- **Attribution and the link, always.** Every result names the creator and links to the original moment. The product sends viewers to the creator.
- **No implied partnership.** Creator results and pages say the creator is not affiliated unless they agreed. No creator names, faces or content in where2eat marketing without consent.
- **Fast removal.** A visible removal contact; a creator's request is honored within 72 hours, and removal takes effect in the assistants immediately because the server reads live data.
- **Notify, don't ask.** Tell each creator when their content is included.
- **Legal check before public submission.** A short consultation with an Israeli IP lawyer on fair use (Copyright Act 2007, section 19) for this excerpt-and-link format, before submitting to the public directories in Stage 2.

---

## 6. Security and cost

- **Read-only and isolated.** The MCP server reads published data and nothing else. No admin data, no write paths, no secrets exposed to the assistant.
- **Fix open write endpoints first.** Publishing the API to two assistant platforms draws attention to it. PR #286 (login required on restaurant writes and paid analysis routes) must be merged before Stage 2.
- **Rate limits.** Per-client and global request limits on the MCP endpoint.
- **Cost.** Database queries cost close to nothing, and the language model runs on the assistant's side. The real cost risk is **photos**: Google Places photos served through `/api/photos` cost about $0.007 per uncached load, and that proxy is never budget-blocked. Inside a popular assistant this could exceed the $10/month cap on its own. v1 returns at most one image per result, prefers curated venue images (PR #283) and existing image URLs, and gives assistant traffic a separate photo budget that falls back to no image.

---

## 7. Measuring it

### Evaluation set (before submission)

40 fixed questions, run in both ChatGPT and Gemini: 15 dish or area questions, 10 with creator and date filters, 5 about places with conflicting opinions, and 10 edge cases (duplicate names, wrong branch, mention-only, unverified kashrut, no coverage). Expected answers are prepared from the data in advance.

### Acceptance gates

- **Trust.** Every quote shown is a checked quote; zero wrong attributions, branches or tasted/mentioned swaps in the sample.
- **Constraint discipline.** Hard filters are always honored; every expected no-coverage case returns "no coverage", not an invented place.
- **Relevance.** In at least 80% of answerable questions, one of the first three results is judged useful.
- **Links.** Every link opens the right video within about 5 seconds of the relevant moment.

### Metrics

Tool calls per day by platform and tool · no-coverage rate (and which cities, dishes and creators people ask for that we lack) · links opened to source moments (tracked with campaign tags in the site's existing analytics) · cost per 1,000 tool calls, including photos. The no-coverage list is also the best signal for which creators the pipeline should add next.

---

## 8. Launch plan

- **Stage 0 | Checks (about one week).**
  - Test the claim: take restaurants from the last month's episodes and ask ChatGPT and Gemini about them. Record what they know and what they miss.
  - Verify eligibility: ChatGPT app submission (identity verification, privacy policy, availability in Israel) and Google Connected Apps preview access.
  - Merge PR #286.
  - Exit: evidence for or against the claim, confirmed access on at least one platform.
- **Stage 1 | Private build.** The MCP server and four tools, tested privately (ChatGPT developer mode, Google Connected Console testing). Run the evaluation set in both. Exit: gates in section 7 pass, cost per 1,000 calls measured.
- **Stage 2 | Public submission.** Legal check (section 5), then submit to the ChatGPT directory and the Gemini/Search preview. Exit: approved and live on at least one platform.
- **Stage 3 | Better presentation and coverage.** ChatGPT cards, Gemini presentation if supported, and more creators prioritized by the no-coverage list.

### Main risks

- **The claim is false:** if assistants already know recent creator picks, the value narrows to attribution and the link to the moment. Stage 0 finds out first.
- **Platform rejection or limited regions:** keep the server platform-neutral, since one MCP server serves both.
- **Wrong attribution inside an assistant:** quote vs summary labels, structured fields and the evaluation gates.
- **Creator objection:** 72-hour removal, short excerpts, notify first.
- **Photo cost:** capped image use and a separate photo budget.

---

## 9. Open decisions

1. **Platform order.** Recommendation: build once, submit to whichever approves first; don't sequence by assumption.
2. **Excerpt length and image policy** inside assistants (proposed: two sentences, one image per result).
3. **Unchecked excerpts:** serve labeled summaries (recommended), or serve only audio-checked quotes and accept fewer results.
4. **Budget:** keep $10/month total including assistant traffic, or set a separate cap for it once Stage 1 measures real cost.

### What counts as a finished first version

A user in ChatGPT or Gemini asks where to eat and gets places from where2eat with who said it, when, a correctly labeled excerpt and a working link to the moment. No coverage is stated plainly. Creators are attributed and can be removed within 72 hours. Cost per 1,000 calls is measured and within the agreed cap.

---

## Sources (checked 2026-11-20)

1. OpenAI: result interfaces, cards, carousels and embedding limits. <https://developers.openai.com/apps-sdk/build/chatgpt-ui>
2. OpenAI: developers can now submit apps to ChatGPT. <https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/>
3. OpenAI: upload and submit (identity verification, country availability). <https://developers.openai.com/plugins/deploy/submission>
4. Google Connected Apps Platform preview: MCP apps in Gemini and Search (secondary report). <https://ppc.land/google-opens-preview-for-third-party-apps-inside-search-and-gemini/>
5. Google Connected Apps Platform preview (secondary report). <https://dev.to/alifar/google-connected-apps-platform-preview-brings-one-mcp-path-to-search-and-gemini-c49>

Sources 4–5 are secondary reports; confirm the details against Google's own documentation in Stage 0.

---

## Change log

**v0.3 (2026-11-20).** The product is the serving layer only:
- Harvesting (monitoring, extraction, publication review) is out of scope; it is solved by the existing agentic pipeline.
- ChatGPT and Gemini are the primary channels, served by one read-only MCP server with four tools. The website is where links land.
- Removed the site-search pilot, editorial time measurements, ingestion freshness targets and ingestion data model from v0.2.
- Added: Gemini Connected Apps preview, cost model (no per-question model cost; photos are the risk), security prerequisites (PR #286), and Stage 0 test of the "assistants are stale" claim.
- Kept: evidence rules, quote vs summary, no invented answers, content-use controls, evaluation gates.

**v0.2 (2026-11-20).** Review recommendations and the decision to use content without waiting for creator permission.

**v0.1 (2026-11-20).** Translated from the Hebrew original.

# PRD: Where to eat, and according to whom?

**where2eat • Fresh restaurant search that returns the review moment**

- **Version:** 0.1
- **Date:** November 20, 2026
- **Product owner:** Ido Kazma
- **Status:** Draft. A proposal, not approved for development.

> Translated from the Hebrew PRD (v0.1) delivered on 2026-11-20. The Hebrew original is the source of record.

---

## 1. Summary and chosen direction

**Turn where2eat from a restaurant-mention archive into a discovery tool: ask in natural language, choose whose content to search, and get places with the reason they fit and the original evidence.** The result connects restaurant, dish, creator, context and date to the moment it was said. Conflicting opinions stay visible.

### The direction chosen in conversation

- **Within where2eat.** A home for several creators, with creator pages and content inside the site, not a network of separate sites.
- **Creator-based search.** Review passages and a verifiable source, not another overall restaurant score.
- **Freshness and a ChatGPT connection.**

These are part of the product vision. The implementation order and first-version scope proposed in this document have not yet been approved for development.

### What has not been decided

This document is not approval for code, a PR, deployment, creator outreach, new content ingestion, automation or spend. The demos for Gil Harel, Niv Gilboa, Yubi Yam, Daniel David and Carnivorim Originale are illustrations, not a partnership or an already-connected repository.

### Decision proposal

Prove search-with-evidence first, on a small, curated collection on the website. Only after quality, usefulness and cost are measured, open a multi-creator pilot and the ChatGPT connection. Every stage has a gate, not an invented launch date.

**Document map:** users and journeys → scope → search → trust → freshness → data → operations → ChatGPT → measurement → launch and budget → decisions and sources.

---

## 2. The problem and the user

**Product hypothesis: trust in a creator + context + fresh evidence shortens the choice.**

### The problem being tested

Food information is scattered across videos, podcasts and short-form content. It is hard to find who tasted what, at which branch, when, and why it fits the current request. An old review may be excellent but says nothing about the current state. New content may be PR rather than a visit. The claim that Google or chat search is not up to date is Ido's problem hypothesis, not a comparative finding. The test is not the absence of competitors, but whether the product finds more relevant, fresher evidence or helps choose better.

### Proposed first audience

- **The intent-driven diner.** Looking for a place by area, dish, style or occasion. Wants to see why the place fits without watching a full episode.
- **The creator follower.** Trusts one or several creators and wants to search within their content, including disagreements and changes of position over time.
- **The scene enthusiast.** Wants to know what opened and what is getting attention. A news feed is a separate track, not a replacement for visit-based review.

### Core journeys

1. Question → constraint understanding → up to three proposed results → source passage → decision whether to watch or read more. The number of results is a UX proposal, not a platform requirement.
2. Choose a creator → search their collection → restaurant or tour → relevant passage. The creator page also shows coverage boundaries, not only top content.
3. One restaurant → timeline of sources → who was enthusiastic, who reserved judgment, and what changed. No mixing of opinions from different periods or branches.

### Not a target user in the first stage

Not a booking tool, not a business-management system for creators, and not a guide promising full coverage of every restaurant in the country. Overseas content can be included if it exists and is well identified, with no geographic coverage promise.

---

## 3. Scope and boundaries

*Everything listed here is a prioritization proposal unless marked as a chosen direction.*

### Must in the first version: search with evidence

- **R1 | Natural search and filtering.** Hebrew, area, dish or style, one or more creators, and a publication range. The chosen interpretation and active constraints are displayed.
- **R2 | A verifiable result.** Restaurant and branch, creator and speaker, dates, source type, a passage faithful to the source, and a link to the review moment. Details in sections 4–5.
- **R3 | A multi-source restaurant page.** Separate reviews by source and date. Positive and negative opinions do not become an invented average.
- **R4 | A creator page inside the site.** Identity and source link, the included collection, last update date, and basic filtering. Presentation does not imply sponsorship or partnership.
- **R5 | No match, no fabrication.** A no-coverage message, a reason, and an option to change the filter. We do not complete an answer from general knowledge as if a review were found.
- **R6 | Quality control and correction.** Manual publication of reviewed content, hiding a problematic passage, versions, and recording the correction source. No automatic publication in the proposed version.

### Near-term next stage

Read-only ChatGPT connection, richer creator comparison, tours and stops, and relatively-new news marking. The infrastructure for news and dates is included in the data model from the start, but a feed is not guaranteed in the first stage.

### Not in the first version

Automatic trend detection, alerts, learning personalization, mandatory accounts, payments, bookings, a unified creator rating, video clipping and storage, continuous ingestion from every network, or a creator-recruitment campaign.

### Baseline and dependencies

Per the project context, the site already shows an archive of Medabrim MeHaBeten, mentions and timestamp links, alongside place information. This is a planning starting point, not a live-service review. The data, search, permissions and API must be re-checked before estimating work or promising an external client.

---

## 4. Search and result behavior

*Search that returns why, not only where.*

### Input and dialog

Usage example for illustration: searching for meat in the Sharon area by two chosen creators. The system extracts area, topic and sources. If the area or branch is ambiguous and changes the result, ask a short question. No clarification is required for every soft preference.

- **Hard constraints.** A chosen creator, an explicit area and a mandatory time range filter the candidates. No silent deviation to fill a list. If visits were requested, news and mere mention are not a substitute.
- **Soft preferences.** Style, atmosphere and dish fit affect ordering only when evidence exists. Budget remains unknown if no dated price is given in the source.

### Proposed retrieval and ranking order

Candidate filtering → name/location/dish matching → fit to the question's meaning → evidence strength → relevant freshness → source diversity. Weights are not set before testing. A new publication alone does not make a restaurant a better fit, and a mention does not get the weight of a tasting.

### Result card

Name and branch • why it fits the question • who said it and who published it • dish and context • publication date and visit date, or marked unknown • a short quote or a labeled summary • content type • commercial disclosure as it appears in the source • a button to the review moment. An image is an improvement, not a condition for understanding the evidence. A generated summary is not shown in quotation marks. On a general where-to-eat request, a positive recommendation requires suitable positive evidence; on a request for reviews of a place, showing a negative review is allowed and even desirable.

### Edge cases and acceptance criteria

- **A1.** Choosing a creator returns only their sources. Removing the filter is a visible user action.
- **A2.** No hard match: a no-match message and an option to widen, with no place that fails the conditions.
- **A3.** A blocked source link or missing timestamp: no promise of watching the moment. Show the limitation and the available source link, or hide the passage if it cannot be verified.

---

## 5. Trust is a product requirement

*Source, speaker, branch and context before persuasive phrasing.*

### The unit of trust: a verified source passage

Every claim rests on an identified source and time range. A quote requires checking against the audio itself, including the surrounding sentences. Automatic transcription is raw material, not proof the speaker said the phrasing. Do not cut a reservation, a joke, another person's quote, or conditions that change the meaning.

- **Who said it.** Speaker, channel or publishing creator and their roles are kept separately. The content editor does not attribute the host's opinion to the guest, or vice versa.
- **What happened.** Separation between a first-hand tasting or visit, a mention, news reporting, and a quoted third-party opinion. A tasting is marked only with clear evidence; otherwise the state is unknown.
- **Where.** Matching to a branch, not only a chain name. An unresolved identification stays in review and is not automatically linked to a similarly named restaurant.
- **Which position.** The opinion is kept about the specific dish or experience. Do not infer a blanket restaurant recommendation from one dish, or invent a score that was never given.

### Quote versus summary

A quote is phrasing verified against the audio, with enough context to understand. A summary is our wording, marked as such and linked to the evidence. When phrasing or meaning cannot be verified, do not publish a quote. Keep the passage in review, or show limited information without unsupported opinion attribution.

### Context-sensitive information

Kashrut, allergens, hours, opening, price and availability do not become current just because a creator mentioned them. Show source and date, or unknown. On a request where this information is a necessary condition, do not promise a fit without suitable verification.

### Quality gate per passage

**A4:** A human reviewer can reconstruct from the card the source, speaker, place and context. An error in quote meaning, branch or visit type blocks publication. An error report allows hiding and correcting even without waiting for re-ingestion of a full episode.

---

## 6. What's new, and what's actually a trend

*An explicit freshness model, not a "new" tag on old content.*

### Four separate times

- **Visit time.** When the experience happened. Kept only if known, with a precision level such as day or month. Never inferred from the upload date.
- **Publication time.** When the source was published. Can be filtered even when the visit time is missing, as long as the interface says so.
- **Event time.** For news such as an opening or change: when the change happened or is expected, and the source for it.
- **Check and ingestion time.** When the information was entered and when verified. These are operational times, not proof the visit or event is fresh.

### Proposed display rules

Instead of a vague "up to date" tag, show an explicit date. If showing "relatively new": the proposed default is publication within the last 30 days, with the text "by publication date". A "visits from the last month" filter includes only visits whose date is known and meets the condition. A new video about an old visit does not get a "new visit" label. Later editing does not reset the age of the experience. Business status changed or a conflicting source: show a context warning, and do not treat the old review as current operational information.

### News is a different content track

An opening, menu change or relocation is shown as a news item with a source, event date and verification level. An opening item is not a recommendation that the food was checked, and a commercial publication is not an independent visit.

### Trends: a later experiment, not an MVP promise

Candidate rule for testing: at least three separate creator sources on the same topic or place within 30 days, after merging repeat publications and marking dependency or a shared campaign. Even then the label is "rising in the repository's sources", not "a national trend". Source count and time window are visible.

**A5:** A single source does not generate a trend tag. Absence of commercial disclosure is not proof of independence, and several videos by the same creator are not several independent sources.

---

## 7. Proposed data model

*The data must preserve the distinctions even if the card shows only some of them.*

### Core entities

- **Creator and speaker.** Stable ID, display name, channels and original sources. A speaker-to-publisher link; collection state: demo, reviewed, published. No "partner" field switched on by mere recording.
- **Source item.** ID and source URL, platform, creator, title, language, publication time, ingestion time, check time, availability, commercial disclosure and the disclosure text if present. Content use and display terms are recorded as needed.
- **Place and branch.** Internal ID, original name and aliases, city, country, address and branch. An external ID is a matching aid, not a substitute for evidence. Identification state: verified, partial or unresolved.
- **Mention or review.** Links to source, speaker and branch; start and end in seconds; raw text, verified quote and summary separately; dish, topic, position, experience type and visit time with precision and source.
- **News item.** Event type, place, source, event date, publication time and verification status. No automatic conversion of a news item into a review.
- **Quality control.** Review status, who checked and when, uncertainty reason, previous version, correction and hiding. A numeric confidence score does not replace these fields.

### Integrity rules

**A6:** A published passage must have an accessible source at check time, speaker attribution, a valid time range and a place identified at display level. An unknown field stays empty with a reason, not filled with a guess. A passage with unresolved branch identification can be kept internally but not appear as a definite result. Many reviews link to the same place without deleting a source or an opinion. Duplicate merging is reversible and documented. A re-uploaded video does not produce a new visit. A tour is an ordered collection of stops linked to passages, not a new source replacing them.

### Compatibility with the current state

The entities are a proposed logical model. No new database, vector engine, model provider or ingestion system was chosen. A fit check against the existing structure precedes any change or migration estimate.

---

## 8. Operations and content ingestion

*Measured expansion, with a responsible editor and no publication without review.*

### Proposed pilot flow

1. Choose a small source list with valid usage rights → 2. Transcribe or obtain a transcript → 3. Extract candidates and timestamps → 4. Identify place and branch → 5. Listen to context and check attribution → 6. Preview → 7. Manual approval to publish → 8. Check result and link in the product.

The existing manual ingestion remains the default. Future automation can suggest candidates for review, but running a standing process or automatic publishing requires a separate decision. No commitment to collect every new piece of content from every creator.

### Responsibilities and work queue

- **Ido as product owner.** Approves the pilot collection, priorities, budget and stage gates. This is a proposed role division, not an already-assigned task.
- **Proposed content editor.** Checks audio, branches and passages; manages an unresolved queue and corrections. Work time must be measured before expanding the collection.
- **Proposed technical owner.** Checks search fitness, permissions, source availability, measurement and hide/restore capability. No assumption that all capabilities exist.

### Correction and unavailable content

A fault report is tied to a passage ID. On a substantive complaint about attribution or branch, stop showing the passage until reviewed; other sources on the place may stay. A removed or restricted video is unavailable for viewing: do not promise a working link and do not replace it with an unauthorized copy. Keep internal documentation for review needs per a policy to be set.

### Coverage and commercial disclosure

A creator page says which items are included and when updated, without the impression this is all the creator's content. Disclosure states: marked commercial collaboration, no disclosure found in the checked source, or not checked. No "independent" label based only on absence of disclosure. Before expansion, content usage terms, attribution, images and a removal-contact mechanism will be clarified. Use source links and content allowed to be shown. No new video or image project is needed to test the search's value.

---

## 9. The same repository, in ChatGPT too

*A proposed channel after the core is proven, not a separate content product.*

### The proposed experience

Question in conversation → search the permitted collection → structured results with creator, passage and dates → short cards and a link to the source moment → option to change constraints. Same result and same trust rules on the site and in chat. Even without card display, return clear evidence and links.

### What is known and what is not yet

OpenAI documentation checked on 2026-11-20 describes interfaces with cards and carousels. Embedding third-party frame content is limited and subject to review. Therefore the proposed base version opens the source via a link and does not promise in-conversation YouTube playback. Clipping and storing video segments is not included. [1–2]

Ido's account eligibility, distribution path, regional availability and publication approval are unverified. Before committing to the channel, check them separately against the relevant documentation and account. A demo on a private connection is not proof of public availability. [3]

### Proposed logical service contract

Input: question, filters, constraints and result limit. Output: stable result IDs, request interpretation, constraint matching, evidence with source and time range, dates, uncertainty and coverage state. An error or no-match result is a structured state, not text that looks like a recommendation. Read-only actions. No data changes, admin-interface exposure or browser secrets. Re-check how an authorized external client calls the API, including source limits, authentication, quotas and cost control. Do not bypass an existing protection to make a demo work.

### Proposed non-functional requirements

Experiment target: 95% of site requests complete within 5 seconds in the test environment with documented concurrency, excluding ChatGPT processing time or opening an external source. This is a measurement target, not a measured performance. Required: RTL, mobile and keyboard use, loading and failure states, limited request rate, and minimal usage logging without unneeded user details.

---

## 10. How we'll know it works

*Quality gates before growth, and usage metrics before claiming market fit.*

### Proposed evaluation set, pre-pilot

Prepare 40 fixed queries from the chosen collection: 15 dish-or-area questions, 10 with creator and time filters, 5 with conflicting opinions, and 10 edge cases such as a duplicate name, wrong branch, mention-only, unverified kashrut and no match. Prepare expected answers from the audio in advance, separately from the search output.

### Proposed acceptance gates

- **Trust.** 100% of quotes shown in the sample are checked against the audio. Zero material errors in attribution, branch, meaning and tasting classification. Such a failure blocks passage and requires correction and re-checking.
- **Constraint discipline.** Every request with a hard filter is honored; in every expected no-match case the system avoids an invented recommendation. Filter changes do not happen silently.
- **Relevance.** In at least 80% of questions answerable from the collection, at least one of the first three results is judged useful by documented human judgment. This is a proposed threshold, not an existing achievement.
- **Source and time.** All sample links open at the right source and right moment; the proposed target is a deviation of up to 5 seconds from the start of the relevant sentence. Publication and visit dates are not swapped.

### Value testing with people

Proposal: 5–8 users, with their own real food questions and a comparison to their usual search method. Measure whether they found a fitting place, whether they understood why, and whether the evidence changed the decision. Separate search failure from coverage failure. Do not infer demand from liking a demo.

### Metrics to collect

Query → result with evidence → source opening → report that a decision was made. Measure separately: no-match search, filter correction, time to choice, source faults and return usage. A click alone is not proof of value. No retention target set yet because there is no baseline. Every run also records QA time per item, ingestion cost, query cost and image cost. Test-set success rate, cost and fault documentation are attached to every expansion decision.

---

## 11. Launch plan and budget

*Progress by proof, not by a feature list.*

### Proposed stages and gates

- **Stage 0 | Feasibility check.** Map existing data and capabilities, choose a sample, clarify source usage and measure costs and editing time. Exit: gap list, test collection and scope decision. No paid infrastructure is needed to approve a document.
- **Stage 1 | Website pilot.** Search and evidence on a curated collection; proposal: 20–30 places and at most two creator sources, only if suitable material is available for use. Exit: passing the quality gates and user testing. Without a second source there is no claim that a multi-creator experience was proven.
- **Stage 2 | ChatGPT.** Read-only connection to the same collection, after checking API and distribution fitness. Exit: the same trust checks, usage and cost measurement on the channel. Public exposure is a separate decision.
- **Stage 3 | Coverage and news.** Expand only if value and cost justify it. Examine tours, a news feed and a trends experiment separately; do not enable unsupervised ingestion by default.

### Economic rule

The project's existing work frame is up to $10 per month in total list-price cost, even if part of the cost is covered by credits. This is not approval to raise the cap. Ongoing expenses and cap protection are not verified within this document; do not infer that budget remains available.

Monthly cost = existing infrastructure + ingestion and analysis + search or answer generation + information and images + other components. Human editing time is measured separately; it does not disappear because there is no invoice. There is currently no measured cost per query or per episode for a reliable forecast.

Before a public connection, proposed: counting every billing path, quotas, an alert before the cap and a safe stop on new requests that may cost money. Caching and a fallback image may help, but choosing and implementing them requires a separate decision. A stopped request shows an explanation, not an invented answer.

### Main risks

Small coverage: show the boundaries. Expensive QA: measure before expansion. Wrong branches and attribution: block the passage. A campaign that looks like a trend: keep dependency and disclosure. Expensive or unavailable external connection: keep the core useful on the site. No timeline or return promise before these checks.

---

## 12. Open decisions and sources

*What is needed to turn the draft into an approved work plan.*

### Decisions for Ido, before development

1. **Version boundary.** Recommendation: website first, ChatGPT connection as a follow-on gate; news and trends do not block proving the search.
2. **The pilot collection.** Which content is available and suitable for testing, and who are the first two sources? Do not choose a creator on the assumption that a demo means consent or partnership.
3. **Operational capacity.** Who checks audio, and how much monthly time can be dedicated? No reliable freshness target without an answer.
4. **Acceptance gates.** Approve or change the proposed 40-question set, relevance threshold, time target and trust gates.
5. **Budget and distribution.** Approve a plan that respects the existing frame after measurement, and check account, access and distribution path before committing to ChatGPT.

### What counts as a finished first version

The user can search, understand according to whom and why the result came back, open the source moment, and identify limitations and dates. The product does not invent a recommendation when there is no coverage. The collection is correctable, the evaluation gates passed, and operating cost was measured within an approved frame. Without these, a pretty interface is not a ready launch.

### Document basis

The direction and boundaries are based on a WhatsApp conversation with Ido from 2026-11-20, mainly choosing integration into where2eat, creator-based search, review moments, freshness and the PRD request. The site state and budget are based on the project context provided, not a live review of the product or account at writing time. The requirements, stages, measurement thresholds and logical model are proposals in this document. Demand, creator collaboration, advantage over alternatives and unit economics are unverified.

### External documentation checked on 2026-11-20

1. OpenAI: result interfaces, cards, carousels and embedding limits. <https://developers.openai.com/apps-sdk/build/chatgpt-ui>
2. OpenAI: interface guidelines and in-conversation card display. <https://developers.openai.com/apps-sdk/concepts/ui-guidelines>
3. OpenAI Help: custom connectors in ChatGPT. Separate verification required for this product's eligibility and distribution. <https://help.openai.com/en/articles/12584461-creating-custom-mcp-apps-in-chatgpt>

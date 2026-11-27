# where2eat: project overview and how it works

Status: written 2026-11-27 from the repository at main 3132300 and read-only checks of the Railway and Vercel configuration that day. Statements come from the code and existing docs unless marked "not verified". Where this file and older docs disagree, check the code. See also `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ADMIN_MAINTENANCE.md`, `docs/episode-publication-quality.md`, `docs/plans/location-stories-design.md`.

## 1. What it is

A restaurant discovery site built from Hebrew food podcasts and shows on YouTube. Episodes are transcribed, restaurant mentions are extracted and reviewed, venues are enriched (location, contact details, photos), and the public site shows them in a feed, on a map, and as location-ordered stories with the moment in the video where the host talks about the place. The UI is Hebrew first (RTL) with English available.

## 2. Components

| Part | Path | Notes |
|---|---|---|
| Public web app | `web/` | Next.js 16, React 19, TypeScript, Tailwind 4. Deployed on Vercel. Jest tests. |
| API | `api/` | FastAPI (`api/main.py`, routers in `api/routers/`) is what the Docker image runs on Railway. `api/index.js` (Express) and `api/routes/` are an older/alternative server still in the tree. |
| Python backend | `src/` | Transcript collection, LLM analyzers, enrichment, DB layer, scheduler, cost ledger, publication quality checks. |
| Admin UI | `web/src/app/admin/` (and a separate `admin/` Next.js app) | The Vercel account has one project, `where2eat` (root `web`, aliases where2eat.rest, www.where2eat.rest, where2eat-delta.vercel.app). The separate `admin/` app has no Vercel project there, so the deployed admin UI is the one inside `web/`. |
| Scripts | `scripts/` | CLI, backfills, data cleanup, exports, publication check (`check_episode_publication.py`), story place builder. |
| Tests | `tests/` (pytest), `web/src/**/__tests__` (Jest) | CI in `.github/workflows/ci.yml`. |

## 3. Ingestion and extraction workflow

1. Source: YouTube channels/playlists (subscriptions) or single videos (`src/subscription_manager.py`, `src/video_queue_manager.py`, `src/pipeline_scheduler.py`, `scripts/cli.py`, `scripts/process_queue.py`).
2. Transcript (see 3a for the layers): the code has a collector (`src/youtube_transcript_collector.py`) that can fetch and cache YouTube captions. That is a code capability, not the approved workflow. The owner's standing requirement is a full transcript made from the episode audio, not auto-captions, and quotes that are checked against the recording and edited before publishing (raw auto-caption snippets are not acceptable). The canonical transcript is committed as `agentic_extractor/<video_id>/transcript.json`. Railway's IP is blocked by YouTube, so the server does not fetch transcripts itself.
3. Extraction: LLM analyzers (`claude_restaurant_analyzer.py`, `openai_restaurant_analyzer.py`, `unified_restaurant_analyzer.py`) produce restaurant mentions with host opinion, quotes and timestamps. Production variables include `LLM_PROVIDER` and `GEMINI_API_KEY`, and the cost ledger prices only Gemini 2.5 Flash. Output is `agentic_extractor/episode_<video_id>_extraction.json` (and a `.md` report).
4. Quality gate: `docs/episode-publication-quality.md` and `src/publication_quality.py`. An analysis is a draft, not permission to publish. The same offline validator runs in `POST /api/episodes/seed` and in `BackendService.process_video(save_to_db=True)`. It requires source-backed identity (the venue is confirmed with city/branch/address/chef context from a venue or other authoritative source), the discussion (exact quote, all occurrences reviewed, selected start second), and a photo decision. Without evidence, seed returns 422 and automatic processing returns `needs_review` without saving an episode or restaurant. Check locally with `PYTHONPATH=src python scripts/check_episode_publication.py extraction.json --data-dir <dir>`.
5. Enrichment: Google Places (`google_places_enricher.py`, `restaurant_location_collector.py`), website og:image (`website_image_scraper.py`), Instagram (`instagram_enricher.py`). Google calls cost money; see section 8.
6. Seeding: `POST /api/episodes/seed` (admin bearer auth required). A new review of a venue that already exists can be attached to the existing card with `canonical_restaurant_id`.
7. Ingestion is manual: new episodes are added only when the owner asks for a backfill; an automatic proxy-plus-cron setup was offered and declined on 2026-11-01. The scheduler code (`pipeline_scheduler.py`) exists, but on 2026-11-27 the production service had `PIPELINE_SCHEDULER_ENABLED=false` and `PIPELINE_POLL_INTERVAL_HOURS=9999` (read from the Railway service variables). `docs/episode-publication-quality.md` also states processing is manual and enables no scheduler or paid lookup.
8. `.github/workflows/scraper.yml` has a daily schedule (`0 6 * * *`) but its run step only executes `python scripts/cli.py health` and then commits `data/`. It does not ingest episodes. Whether GitHub Actions currently runs it was not verified.

Who runs episodes: the Instinct agent runs its own episode analysis pipeline, as the runbook below describes. Episode procedure (English and Hebrew): `docs/operations/EPISODE_CONTINUITY_RUNBOOK.md` / `.he.md`; transcript and timestamp guide: `docs/operations/TRANSCRIPTS_AND_TIMESTAMPS_GUIDE.md` / `.he.md`; per-episode record: `docs/operations/episode-records/TEMPLATE.md` / `.he.md`.

## 3a. Three layers: server pipeline, repository agents, and manual preparation

Do not treat these as one path. They differ in where they run, which keys they use and what has been shown to run.

| | A. Server pipeline | B. Repository agents (`.claude/agents`) | C. Manual preparation outside the site |
|---|---|---|---|
| What | Python in `src/` and `api/`: `pipeline_scheduler.py`, `youtube_transcript_collector.py`, `unified_restaurant_analyzer.py` (prompt in `_create_analysis_prompt`), enrichment, `BackendService.process_video(save_to_db=True)` | Claude Code subagent definitions: `episode-processor` (opus), `extraction-verifier` (sonnet), `episode-deployer` (sonnet), `production-manager` (opus), `site-checker` (sonnet), plus six development agents; also `CLAUDE.md`, `.claude/skills/*`, `.claude/mcp.json` | Transcript made from the episode audio with automatic speech-to-text, mention list prepared and checked by hand, then uploaded through the site API |
| Runs where | Railway, when enabled. Production scheduler is off (`PIPELINE_SCHEDULER_ENABLED=false`). | On the developer's machine inside Claude Code (paths in the files are local) | Outside the repository and outside the site |
| Model and keys | Provider from `LLM_PROVIDER` (default `gemini`, model `gemini-2.5-flash`), `GEMINI_API_KEY` set on the Railway service; Claude and OpenAI supported in code. Whether `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` exist in production is not verified. The production `LLM_PROVIDER` value is not verified. | Model access through the user's Claude Code (account or key not known). Place checks use `GOOGLE_PLACES_API_KEY` from a local `.env` (whether it is the same key as on Railway is not known). Admin login uses `WHERE2EAT_ADMIN_EMAIL` / `WHERE2EAT_ADMIN_PASSWORD` from the local environment. | No Gemini or Claude key of the project. Site writes use the site's own admin authorization. |
| Output | Episode, restaurants and mentions in the live database (SQLite on the Railway volume), or `needs_review` with nothing saved | `agentic_extractor/episode_<id>_extraction.json` and `.md`, a verification report, upload-ready JSON, and (after approval) uploads to the API | A seed file, owned venue images, API writes |
| Shown to have run | Yes for episodes 174-176 on 2026-11-03 (Gemini in the server, after a payment error was fixed), per the maintenance record. Later runs not verified. | Definitions exist and were edited 2026-03, 2026-11-06, 2026-11-07 and 2026-11-22. The repo holds 26 extraction files, latest commit 2026-05-16. Episode 180 has no extraction or transcript in Git. For the preparation of episodes 179 and 180 no evidence was found that these agent files were loaded or that `check_episode_publication.py` was run. Episodes 174-178 were not inspected. Use of layer B for recent episodes is therefore not proven. | Yes for episodes 179 and 180. Episodes 177-178 were seeded through the data API after the Gemini payment error; who produced their transcripts was not verified. |

Shared enforcement: `src/publication_quality.py` (`publication_issues`) is called from `POST /api/episodes/seed` and from `process_video(save_to_db=True)`. A code search found no call to it from `POST /api/restaurants`, so uploads through that route (still described in the older body of `episode-deployer.md`) do not pass through it. Whether layer B used `seed` in practice is not proven.

Required versus actual:
- Required (owner): transcript from the audio, not auto-captions; quotes checked against the recording; manual ingestion; no new paid calls without approval.
- Actual for episodes 179-180: speech-to-text on the audio, then review. It is automatic recognition, not direct listening, so it contains errors and has no speaker labels. Quote checks used short re-transcribed clips. Start times for episode 180 are approximate (about 5-10 seconds).
- Historical: layer B step 1 (`episode-processor`) fetched YouTube captions through `youtube_transcript_collector`, which conflicted with the owner's requirement. The aligned agent instructions in PR 360 replace it with the audio route.

Drift between the agent files and the code, recorded here and not changed:
- Output paths: `episode-processor` and `extraction-verifier` use `analyses/<id>/` and `data/restaurants/` (the `analyses/` folder is not in the tree), while `episode-deployer` reads `agentic_extractor/`.
- The shared "source-backed publication review" block added on 2026-11-07 overrides older steps, but the body of `episode-deployer.md` still describes creating restaurants with `POST /api/restaurants`.
- `.claude/mcp.json` points to paths from another machine; its secrets are environment-variable references.

## 4. Data entities

Defined in `src/database.py` (SQLite, the live database; per-route map in the storage map below) and `src/models/` (SQLAlchemy; tried only as a fallback, or first by `/api/restaurants/search` when `DATABASE_URL` or `USE_SQLALCHEMY=true` is set, see `api/routers/restaurants.py`). Verified 27.11.2026 that production answers from SQLite on both endpoints.
- `episodes`: `video_id`, channel (`channel_id`, `channel_name`), title, language, transcript, `episode_summary`, `published_at`.
- `restaurants`: Hebrew/English names, city, neighborhood, address, coordinates, cuisine, `status`, price range, `host_opinion`, `host_comments`, menu items, contact (hours, phone, website, social), `mention_context`, `mention_timestamp`, Google fields (`google_place_id`, rating), `photos`, `image_url`, `og_image_url`, plus provenance `image_credit` and `image_source` for installed photos.
- `episode_mentions`: links a restaurant to an episode with the timed mention (this is what the stories and the episode page use). The maintenance API repoints mentions when duplicate restaurants are merged.
- Operations: `jobs`, `subscriptions`, `monitored_channels`, `video_queue`, `pipeline_logs`, `restaurant_edits` / `restaurant_history`, `admin_users`, `articles`, `settings`, `error_logs`, `system_metrics`, `place_photos`.
- Attribution: each mention carries its episode, channel/creator and, from the quality gate, a `publication_review` (identity source, quote, selected second, photo source). The episode `source label` and summary can be edited through the maintenance API with preview and revision checks.

Durable record and backups (section 4a below).

### Storage map (ACTUAL from code at this commit; deployed settings partly unverified)

| Data | Where | Used by |
|---|---|---|
| Episodes, restaurants, mentions, pipeline and admin tables (primary) | SQLite file `where2eat.db` in `DATABASE_DIR` (`/app/persistent` on Railway, a path in the repo `data/` locally) | `GET /api/restaurants`, `GET /api/restaurants/{id}`, `GET /api/episodes` and the episode detail, `POST /api/episodes/seed`, admin patch and maintenance routes, the pipeline. The restaurant list, the search fallback and the detail page read it first. |
| Postgres tables (`DATABASE_URL`), secondary | Railway `postgres` service (not re-checked) | `GET /api/restaurants/search` tries it first when `DATABASE_URL` is set and falls back to SQLite if it errors. Create, update and delete in `api/routers/restaurants.py` write SQLite first, then Postgres. The pipeline writes Postgres through at the end of `process_video`. `POST /api/episodes/seed` and the admin patch route write SQLite only. The startup SQLite to Postgres sync is commented out in `api/main.py` ("SQLite is primary"). |
| Venue image bytes | `<DATABASE_DIR>/venue_images/<sha256>.jpg` on the volume (the database holds only the link) | `GET /api/venue-images/<sha>.jpg`, upload route |
| Google photo cache | `<DATABASE_DIR>/photo_cache/` on the volume | photo proxy |
| Cost estimates | SQLite file `cost_estimates.db` in `DATABASE_DIR` (a local estimate, not Google's balance) | `src/cost_ledger.py` |
| Local developer SQLite | `data/where2eat.db` in a checkout | local runs only; not the live site |

Verified on 2026-11-27 by calling the public read routes with an allowed Origin (no writes): the restaurant list returned 411 and the search returned 411 with filter counts and a timeline filled in. That response shape comes from the SQLite or fallback branch, not the Postgres branch (which returns empty filter counts), so the live search was served from SQLite. Why the Postgres branch was not used (`DATABASE_URL` unset, or a session or query error) is NOT verified. Not verified: whether `DATABASE_URL` is set on the service, what Postgres holds, how stale it is, and any backup. Do not state that "the live site reads Postgres".

## 4a. Backup and recovery status

- Git holds transcripts, extraction files and `data/snapshots/*`. This is the intended durable text record. It is not proven sufficient to rebuild the live site.
- The live data is the SQLite file on the Railway volume (`/app/persistent/where2eat.db`, under `DATABASE_DIR`). The API reads it first; Postgres (`DATABASE_URL`) is only a fallback and a partial copy (write-through from some paths, the SQLite-to-Postgres sync is disabled in `api/main.py`). Uploaded venue image bytes, `photo_cache/` and `cost_estimates.db` are on the same volume, outside Git.
- Snapshot freshness: `data/snapshots/manifest.json` on main records `exported_at` 2026-04-24, 141 restaurants and 25 episodes, with `schema_sql_included: false`. The live site showed 411 visible restaurants on 2026-11-27, so the committed snapshot is much older than the live data. The photo repair of 2026-11-27 (37 records, owned images) is recorded in `docs/operations/2026-11-27-photo-repair-changes.csv` but the image files themselves exist only on the volume.
- Needed: a scheduled copy of the volume, above all `where2eat.db` (plus `venue_images/`, `photo_cache/`, `cost_estimates.db`), snapshot refresh checks, and a tested restore. A Postgres dump is only a secondary copy. None of these is verified to exist. Backup and restore status of the Railway volume and Postgres was not checked.

## 5. Public pages (web/src/app)

`/` and `/home` discovery feed; `/restaurant/[id]` detail; `/episode/[videoId]` and `/episodes`; `/map`; `/stories`; `/trending`; `/saved`; `/settings`, `/more`, `/about`, `/privacy`, `/data-sources`; `/admin/*` dashboard routes.
- Stories (`web/src/app/stories`, `web/src/components/stories`, `web/src/lib/stories.ts`, design in `docs/plans/location-stories-design.md`): a vertical feed of restaurants ordered by straight-line distance from the viewer, sideways pages for photos and for each mention of the place, and a map sheet. Everything is computed in the browser from data the site already loaded. The first photo of a story is a stored or direct image; further photos may use the Google proxy and load only when the viewer moves to them.
- Map: `web/src/components/map`, `web/src/lib/geo-utils.ts`.
- Image choice: see `docs/operations/2026-11-27-image-402-and-photo-repair.md` (section "How an image is chosen").

## 6. Admin and data operations

- Auth: JWT admin login (`/api/admin/auth/login`); roles editor, admin, super_admin.
- Maintenance API (`api/routers/admin_maintenance.py`, `docs/ADMIN_MAINTENANCE.md`): merge duplicates with preview and revision, mention repair, source label and summary edits, delete preview, an operations log with undo, and `GET /api/admin/maintenance/costs`.
- Restaurant edits: `PUT /api/restaurants/{id}` (editor or admin).
- Venue images: authenticated upload to the volume and public GET. Details in the operations note.
- Snapshots and backups: see section 4 and `docs/ADMIN_MAINTENANCE.md` (back up the persistent DB before deploys).

## 7. Deployment and configuration

- Railway runs the `Dockerfile` (Python 3.11, uvicorn on 8080). Persistent volume: set `DATABASE_DIR` inside the mounted volume. The venue image store refuses to work in Railway if it is not.
- Vercel hosts `web/`. `NEXT_PUBLIC_API_URL` points at the API.
- Both Vercel and Railway deploy from GitHub `main` through their native integrations (Railway deployment on 2026-11-27 17:17 UTC was commit 3132300 from `idokazma/where2eat` branch `main`). `.github/workflows/deploy.yml` has supplementary jobs that skip without secrets; its Railway job targets `--service where2eat-api`, while the actual Railway service is named `where2eat`, so that job would not match.
- Origin gate: the API rejects requests whose `Origin` is not in `ALLOWED_ORIGINS` plus defaults (exceptions: health, docs, photos, venue image GET and upload). Preview deployments on other origins can't load data unless allowed.
- Main env vars: `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (optional), `API_SECRET_KEY` (venue image upload bearer, at least 32 chars), `ALLOWED_ORIGINS`, `DATABASE_DIR`, `DATABASE_URL`, cost variables (`COST_MONTHLY_BUDGET_USD`, `COST_OPENING_MONTH`, `COST_OPENING_SPEND_USD`, `COST_REQUIRE_VERIFIED_OPENING`, `COST_PUBLIC_PHOTOS_REQUIRE_VERIFIED`), scheduler variables. Never commit secret values.

## 8. Operational constraints

- Paid calls: Google Places (search, details, photos) and LLM calls cost money. `src/cost_ledger.py` keeps a local gross estimate, not the provider balance. The code default budget is $10; the owner's monthly cap is a firm $10. It does not cover other keys, replicas or external usage. Set provider-side billing alerts too.
- Hebrew spelling in transcripts is preserved as heard; venue identity needs more than a name match.
- Persistent files must live on the volume (`DATABASE_DIR`): `cost_estimates.db`, `venue_images/`, `photo_cache/`, and the main database `where2eat.db`.
- Episode seed, mention deletion and reset need admin or super_admin auth.

## 9. Testing

- Python: `python -m pytest tests/`; CI runs path-resolution tests first, then the Python suite, frontend lint and build, and an API syntax check. `CLAUDE.md` asks for TDD and over 90% coverage on new code.
- Frontend: `cd web && npm run test` (Jest), `npm run lint`, `npm run build`.
- Visual or network checks of pages that show Google photos should block `/api/photos` requests so tests do not spend money.

## 10. Known open issues (as of 2026-11-27)

- Google photo proxy exposure: thumbnails and gallery slides can still call the paid `/api/photos` proxy. A guard that stopped this was prepared on a branch but is not in the merged code. The risk is unresolved. See the operations note.
- Missing or dead hero images remain for some records (counts in the operations note).
- Duplicate restaurant records exist (examples in the operations note) and are not merged.
- `CLAUDE.md` and this file were updated together to match the code (FastAPI as the production API, pages, deployment). When code changes, update both.
- Backup and recovery are unproven (section 4a).
- `.github/workflows/scraper.yml` runs a placeholder health check and commits `data/`; whether it is enabled in GitHub is not verified.
- No `COST_*` variables are set in production, so the ledger runs on defaults with an unverified opening spend.

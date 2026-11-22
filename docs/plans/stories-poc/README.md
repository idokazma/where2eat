# Stories prototype (location-ordered)

A standalone HTML prototype of stage A in [`../location-stories-design.md`](../location-stories-design.md): restaurants ordered by straight-line distance from a chosen point, one story per restaurant, one slide per creator mention, with the quote, a jump to the YouTube moment, a map and saving.

Only the source is in the repository. Build the page from the live site's public data:

```bash
python docs/plans/stories-poc/build_stories_poc.py                 # ~0.3 MB, photos loaded as links
python docs/plans/stories-poc/build_stories_poc.py --embed-photos  # ~7 MB, photos inside the file (needs Pillow)
```

The page is written to `docs/plans/stories-poc/out/`, which git ignores. Open it in a regular browser.

## What it does and doesn't do

- **Reads only public data:** `GET /api/restaurants`, `/api/episodes/search` and `/api/episodes/{id}`. It writes nothing and calls no paid API.
- **Photos:** only stored photos (`/api/venue-images/…`, from PR #283) or direct links that answer 200 at build time. Never the paid `/api/photos` proxy. Restaurants without a working photo are hidden by default (a setting shows them as colored cards).
- **Location** is used only in the browser, as in the design.
- **Quotes:** audio-checked quotes are shown in quotation marks; transcript excerpts and summaries without them.
- **YouTube:** the embedded player does not work when the file is opened from disk (YouTube error 153); the "open in YouTube" link does. Host the page to test the embedded player.
- **Map, font and linked photos** need an internet connection. `--embed-photos` makes the photos work offline and in viewers that block outside images.

## Do not commit built files

A built page contains Google Places photos and creators' quotes. Google's terms don't allow storing Places photos, and the quotes are the creators' content. Keep built files local and share them privately.

Tests for the build script: `python -m pytest tests/test_stories_poc_build.py`.

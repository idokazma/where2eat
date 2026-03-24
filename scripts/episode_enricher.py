#!/usr/bin/env python3
"""
Episode Enricher Script for Where2Eat.

Fetches transcript, verifies restaurants on Google Places, discovers Instagram URLs,
and checks production DB — all in one run. Outputs a JSON file that the episode-processor
agent can use to generate extraction reports, upload-ready JSONs, and HTML mockups
without needing any additional API calls.

Usage:
    python scripts/episode_enricher.py VIDEO_ID [--restaurants restaurant1,restaurant2,...]

The --restaurants flag accepts a comma-separated list of Hebrew restaurant names
to verify. If omitted, only the transcript is fetched (the agent handles extraction).

Output: analyses/VIDEO_ID/enrichment.json
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# Add src to path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "src"))

# Load .env
env_path = ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("'\""))

GOOGLE_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")
PRODUCTION_API = "https://where2eat-production.up.railway.app"
ORIGIN = "https://where2eat-delta.vercel.app"


def fetch_url_json(url: str, headers: dict = None) -> dict:
    """Fetch a URL and return parsed JSON."""
    hdrs = {"User-Agent": "Where2Eat/1.0"}
    if headers:
        hdrs.update(headers)
    try:
        req = Request(url, headers=hdrs)
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"  [WARN] Failed to fetch {url[:80]}...: {e}")
        return {}


def fetch_transcript(video_id: str) -> dict:
    """Fetch transcript using the project's transcript collector."""
    print(f"\n[Step 1] Fetching transcript for {video_id}...")
    try:
        from youtube_transcript_collector import YouTubeTranscriptCollector
        collector = YouTubeTranscriptCollector()
        result = collector.get_transcript(video_id)
        if result:
            print(f"  OK: {len(result['transcript'])} chars, {len(result.get('segments', []))} segments, lang: {result.get('language')}")
            return result
        print("  WARN: Collector returned None")
    except Exception as e:
        print(f"  WARN: Collector failed: {e}")

    # Fallback: direct youtube-transcript-api
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["iw", "he", "en"])
        result = {
            "video_id": video_id,
            "video_url": f"https://www.youtube.com/watch?v={video_id}",
            "transcript": " ".join(s["text"] for s in transcript),
            "segments": transcript,
            "language": "he",
            "segment_count": len(transcript),
        }
        print(f"  OK (fallback): {len(result['transcript'])} chars, {len(transcript)} segments")
        return result
    except Exception as e:
        print(f"  ERROR: Could not fetch transcript: {e}")
        return {}


def verify_google_places(name: str, city: str = "") -> dict:
    """Verify a restaurant on Google Places and get full details."""
    if not GOOGLE_API_KEY:
        print(f"  [SKIP] No Google API key for {name}")
        return {}

    # Find place
    query = f"{name} {city}".strip()
    encoded = quote_plus(query)
    find_url = f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={encoded}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key={GOOGLE_API_KEY}"

    find_result = fetch_url_json(find_url)
    candidates = find_result.get("candidates", [])
    if not candidates:
        # Try without city
        if city:
            encoded = quote_plus(name)
            find_url = f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={encoded}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&key={GOOGLE_API_KEY}"
            find_result = fetch_url_json(find_url)
            candidates = find_result.get("candidates", [])
        if not candidates:
            print(f"  [MISS] Google Places: no results for '{query}'")
            return {"verified": False}

    place = candidates[0]
    place_id = place.get("place_id")

    # Get details
    details_url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours,photos,geometry,url,price_level&key={GOOGLE_API_KEY}"
    details_result = fetch_url_json(details_url)
    details = details_result.get("result", {})

    # Resolve first photo
    photo_url = None
    photos_data = []
    raw_photos = details.get("photos", [])
    if raw_photos:
        ref = raw_photos[0].get("photo_reference", "")
        if ref:
            try:
                photo_req = Request(
                    f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference={ref}&key={GOOGLE_API_KEY}",
                    headers={"User-Agent": "Where2Eat/1.0"},
                )
                photo_req.method = "HEAD"
                # Follow redirect to get permanent URL
                import http.client
                import urllib.request

                class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
                    def redirect_request(self, req, fp, code, msg, headers, newurl):
                        return None

                opener = urllib.request.build_opener(NoRedirectHandler)
                try:
                    opener.open(photo_req, timeout=10)
                except urllib.error.HTTPError as e:
                    if e.code in (301, 302, 303, 307, 308):
                        photo_url = e.headers.get("Location")
                except Exception:
                    pass
            except Exception:
                pass

        for p in raw_photos[:5]:
            entry = {
                "photo_reference": p.get("photo_reference"),
                "width": p.get("width"),
                "height": p.get("height"),
            }
            if photo_url and p == raw_photos[0]:
                entry["resolved_url"] = photo_url
            photos_data.append(entry)

    geo = details.get("geometry", {}).get("location", {})

    return {
        "place_id": place_id,
        "google_name": details.get("name"),
        "google_url": details.get("url"),
        "formatted_address": details.get("formatted_address"),
        "rating": details.get("rating"),
        "review_count": details.get("user_ratings_total"),
        "price_level": details.get("price_level"),
        "phone": details.get("formatted_phone_number"),
        "website": details.get("website"),
        "latitude": geo.get("lat"),
        "longitude": geo.get("lng"),
        "photo_url": photo_url,
        "photos": photos_data,
        "opening_hours": details.get("opening_hours", {}).get("weekday_text"),
        "verified": True,
    }


def discover_instagram(name_hebrew: str, name_english: str = None, website_url: str = None, city: str = None, google_name: str = None) -> str:
    """Discover Instagram URL using the project's enricher."""
    try:
        from instagram_enricher import discover_instagram as _discover
        result = _discover(
            name_hebrew=name_hebrew,
            name_english=name_english,
            website_url=website_url,
            city=city,
            google_name=google_name,
        )
        return result
    except Exception as e:
        print(f"  [WARN] Instagram enricher failed for {name_hebrew}: {e}")
        return None


def check_production_db(video_id: str, restaurant_names: list) -> dict:
    """Check which restaurants exist in the production DB."""
    print(f"\n[Step 6] Checking production DB...")
    results = {}

    # Check by episode
    url = f"{PRODUCTION_API}/api/restaurants/search?episode_id={video_id}&include_hidden=true&limit=50"
    data = fetch_url_json(url, headers={"Origin": ORIGIN})
    for r in data.get("restaurants", []):
        name = r.get("name_hebrew", "")
        results[name] = {"exists": True, "id": r.get("id")}
        print(f"  Found in DB (episode): {name} -> {r.get('id')}")

    # Check each restaurant by name
    for name in restaurant_names:
        if name in results:
            continue
        encoded = quote_plus(name)
        url = f"{PRODUCTION_API}/api/restaurants/search?query={encoded}&include_hidden=true&limit=5"
        data = fetch_url_json(url, headers={"Origin": ORIGIN})
        for r in data.get("restaurants", []):
            if r.get("name_hebrew") == name:
                results[name] = {"exists": True, "id": r.get("id")}
                print(f"  Found in DB (search): {name} -> {r.get('id')}")
                break
        if name not in results:
            results[name] = {"exists": False, "id": None}
            print(f"  New: {name}")

    return results


def find_timestamps(name: str, segments: list, video_id: str) -> dict:
    """Find all occurrences of a restaurant name in transcript segments.

    Returns a dict with all occurrences and a recommended discussion timestamp
    (skipping intro/agenda mentions in the first 180 seconds).
    """
    if not segments:
        return {"occurrences": [], "recommended": None, "recommended_display": None, "youtube_url": None}

    episode_duration = segments[-1]["start"] + segments[-1].get("duration", 0) if segments else 0

    # Build search variants: the name itself + common transcript manglings
    search_terms = [name]
    # Remove apostrophes for mangled search
    clean = name.replace("'", "").replace("׳", "").replace("'", "")
    if clean != name:
        search_terms.append(clean)
    # Try without spaces (transcript sometimes merges words)
    no_spaces = name.replace(" ", "")
    if no_spaces != name:
        search_terms.append(no_spaces)

    occurrences = []
    seen_times = set()

    for term in search_terms:
        for i, seg in enumerate(segments):
            text = seg.get("text", "")
            if term in text:
                start = seg["start"]
                # Deduplicate by rounding to nearest second
                rounded = round(start)
                if rounded in seen_times:
                    continue
                seen_times.add(rounded)

                # Get context: surrounding segments
                context_before = segments[i - 1]["text"] if i > 0 else ""
                context_after = segments[i + 1]["text"] if i < len(segments) - 1 else ""

                occurrences.append({
                    "seconds": round(start, 1),
                    "display": f"{int(start // 60)}:{int(start % 60):02d}",
                    "segment_index": i,
                    "text": text,
                    "context_before": context_before[:80],
                    "context_after": context_after[:80],
                    "is_intro": start < 180,  # First 3 minutes = likely intro/agenda
                })

    occurrences.sort(key=lambda x: x["seconds"])

    # Pick recommended: first non-intro occurrence, or first occurrence if all are intro
    recommended = None
    for occ in occurrences:
        if not occ["is_intro"]:
            recommended = occ["seconds"]
            break
    if recommended is None and occurrences:
        recommended = occurrences[0]["seconds"]

    recommended_display = None
    youtube_url = None
    if recommended is not None:
        recommended_display = f"{int(recommended // 60)}:{int(recommended % 60):02d}"
        youtube_url = f"https://www.youtube.com/watch?v={video_id}&t={int(recommended)}s"

    return {
        "occurrences": occurrences,
        "recommended_seconds": recommended,
        "recommended_display": recommended_display,
        "youtube_url": youtube_url,
        "episode_duration_seconds": round(episode_duration, 1),
    }


def get_episode_metadata(video_id: str) -> dict:
    """Get episode metadata from production API and YouTube."""
    print(f"\n[Step 5] Getting episode metadata...")
    metadata = {"episode_id": None, "published_at": None, "title": None}

    # Check production API
    url = f"{PRODUCTION_API}/api/episodes/search?limit=50"
    data = fetch_url_json(url, headers={"Origin": ORIGIN})
    for e in data.get("episodes", []):
        info = e.get("episode_info", {})
        if info.get("video_id") == video_id:
            restaurants = e.get("restaurants", [])
            metadata["episode_id"] = restaurants[0]["episode_id"] if restaurants else None
            metadata["published_at"] = info.get("published_at")
            metadata["title"] = info.get("title")
            print(f"  Episode ID: {metadata['episode_id']}")
            print(f"  Published: {metadata['published_at']}")
            break

    # Get title from YouTube if missing
    if not metadata["title"]:
        try:
            req = Request(
                f"https://www.youtube.com/watch?v={video_id}",
                headers={"User-Agent": "Mozilla/5.0", "Accept-Language": "he"},
            )
            with urlopen(req, timeout=10) as resp:
                html = resp.read(200_000).decode("utf-8", errors="ignore")
            match = re.search(r'"title":"([^"]+)"', html)
            if match:
                metadata["title"] = match.group(1)
                print(f"  Title (YouTube): {metadata['title']}")
            match = re.search(r'"publishDate":"([^"]+)"', html)
            if match and not metadata["published_at"]:
                metadata["published_at"] = match.group(1)[:10]
                print(f"  Published (YouTube): {metadata['published_at']}")
        except Exception as e:
            print(f"  [WARN] YouTube fetch failed: {e}")

    return metadata


def main():
    parser = argparse.ArgumentParser(description="Episode enricher for Where2Eat")
    parser.add_argument("video_id", help="YouTube video ID")
    parser.add_argument("--restaurants", help="Comma-separated Hebrew restaurant names to verify", default="")
    parser.add_argument("--city-hints", help="Comma-separated city hints (same order as restaurants)", default="")
    args = parser.parse_args()

    video_id = args.video_id
    restaurant_names = [n.strip() for n in args.restaurants.split(",") if n.strip()] if args.restaurants else []
    city_hints = [c.strip() for c in args.city_hints.split(",") if c.strip()] if args.city_hints else []

    # Create output dir
    output_dir = ROOT / "analyses" / video_id
    output_dir.mkdir(parents=True, exist_ok=True)

    enrichment = {
        "video_id": video_id,
        "transcript": None,
        "episode_metadata": None,
        "restaurants": {},
        "timestamps": {},
        "production_db": {},
    }

    # Step 1: Fetch transcript
    transcript_data = fetch_transcript(video_id)
    if transcript_data:
        # Save full transcript separately (can be large)
        transcript_path = output_dir / "transcript.json"
        with open(transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript_data, f, ensure_ascii=False, indent=2)
        print(f"  Saved transcript to {transcript_path}")
        enrichment["transcript"] = {
            "length": len(transcript_data.get("transcript", "")),
            "segment_count": len(transcript_data.get("segments", [])),
            "language": transcript_data.get("language"),
            "path": str(transcript_path),
        }

    # Steps 3-4: Verify restaurants on Google Places + Instagram
    if restaurant_names:
        print(f"\n[Steps 3-4] Verifying {len(restaurant_names)} restaurants...")
        for i, name in enumerate(restaurant_names):
            city = city_hints[i] if i < len(city_hints) else ""
            print(f"\n  [{i+1}/{len(restaurant_names)}] {name} ({city or 'no city hint'})...")

            # Google Places
            places = verify_google_places(name, city)

            # Instagram
            instagram_url = None
            website = places.get("website", "")
            if website and "instagram.com" in website:
                instagram_url = website
                print(f"  Instagram (from website): {instagram_url}")
            else:
                instagram_url = discover_instagram(
                    name_hebrew=name,
                    name_english=None,
                    website_url=website,
                    city=city,
                    google_name=places.get("google_name"),
                )
                if instagram_url:
                    print(f"  Instagram: {instagram_url}")
                else:
                    print(f"  Instagram: not found")

            places["instagram_url"] = instagram_url

            enrichment["restaurants"][name] = places

            # Rate limit between Google API calls
            if i < len(restaurant_names) - 1:
                time.sleep(0.3)

    # Timestamp extraction from segments
    if restaurant_names and transcript_data:
        segments = transcript_data.get("segments", [])
        if segments:
            print(f"\n[Timestamps] Finding timestamps for {len(restaurant_names)} restaurants...")
            episode_dur = segments[-1]["start"] + segments[-1].get("duration", 0)
            print(f"  Episode duration: {int(episode_dur // 60)}:{int(episode_dur % 60):02d}")
            for name in restaurant_names:
                ts = find_timestamps(name, segments, video_id)
                enrichment["timestamps"][name] = ts
                n_occ = len(ts["occurrences"])
                rec = ts["recommended_display"] or "NOT FOUND"
                intro_count = sum(1 for o in ts["occurrences"] if o["is_intro"])
                if n_occ == 0:
                    print(f"  {name}: NOT FOUND in segments")
                else:
                    print(f"  {name}: {n_occ} occurrences, recommended={rec} (skipped {intro_count} intro mentions)")

    # Step 5: Episode metadata
    enrichment["episode_metadata"] = get_episode_metadata(video_id)

    # Step 6: Check production DB
    if restaurant_names:
        enrichment["production_db"] = check_production_db(video_id, restaurant_names)

    # Save enrichment
    output_path = output_dir / "enrichment.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enrichment, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Enrichment complete: {output_path}")
    print(f"  Transcript: {'OK' if enrichment['transcript'] else 'FAILED'}")
    print(f"  Restaurants verified: {len(enrichment['restaurants'])}")
    n_found = sum(1 for v in enrichment["restaurants"].values() if v.get("verified"))
    print(f"  Google Places matches: {n_found}/{len(enrichment['restaurants'])}")
    n_insta = sum(1 for v in enrichment["restaurants"].values() if v.get("instagram_url"))
    print(f"  Instagram found: {n_insta}/{len(enrichment['restaurants'])}")
    n_new = sum(1 for v in enrichment["production_db"].values() if not v.get("exists"))
    n_exist = sum(1 for v in enrichment["production_db"].values() if v.get("exists"))
    print(f"  Production DB: {n_new} new, {n_exist} existing")
    n_ts_found = sum(1 for v in enrichment.get("timestamps", {}).values() if v.get("recommended_seconds"))
    n_ts_total = len(enrichment.get("timestamps", {}))
    if n_ts_total:
        print(f"  Timestamps found: {n_ts_found}/{n_ts_total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()

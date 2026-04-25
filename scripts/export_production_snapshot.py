#!/usr/bin/env python3
"""
Export a snapshot of the production Where2Eat data into data/snapshots/.

Writes three files:
  data/snapshots/restaurants.json  — full list from GET /api/restaurants
  data/snapshots/episodes.json     — full list from GET /api/episodes/search
  data/snapshots/manifest.json     — counts + timestamp + source URL

Optionally, if DATABASE_URL is set in the environment and `pg_dump` is on PATH,
also writes:
  data/snapshots/schema.sql        — Postgres schema (pg_dump --schema-only)

Determinism
-----------
All JSON is pretty-printed with sort_keys=True and stable list ordering so git
diffs reflect real data changes.

Usage
-----
  python scripts/export_production_snapshot.py
  API_URL=https://... python scripts/export_production_snapshot.py
  python scripts/export_production_snapshot.py --output-dir data/snapshots
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_API_URL = "https://where2eat-production.up.railway.app"
DEFAULT_ORIGIN = "https://where2eat-delta.vercel.app"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "snapshots"


def http_get_json(url: str, origin: str, timeout: int = 60) -> Any:
    req = urllib.request.Request(url, headers={"Origin": origin, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def sort_restaurants(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda r: (r.get("video_id") or "", r.get("name_hebrew") or "", r.get("id") or ""))


def sort_episodes(items: list[dict]) -> list[dict]:
    def key(ep: dict) -> tuple[str, str]:
        info = ep.get("episode_info") or {}
        return (info.get("published_at") or "", info.get("video_id") or "")
    return sorted(items, key=key)


def sort_restaurants_within_episode(ep: dict) -> dict:
    if isinstance(ep.get("restaurants"), list):
        ep["restaurants"] = sorted(
            ep["restaurants"],
            key=lambda r: (r.get("mention_timestamp_seconds") or 0, r.get("name_hebrew") or "", r.get("id") or ""),
        )
    return ep


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def dump_schema(output_path: Path) -> bool:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("[schema] DATABASE_URL not set — skipping pg_dump", file=sys.stderr)
        return False
    if not shutil.which("pg_dump"):
        print("[schema] pg_dump not on PATH — skipping", file=sys.stderr)
        return False
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "pg_dump",
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--no-comments",
        database_url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"[schema] pg_dump failed: {result.stderr}", file=sys.stderr)
        return False
    output_path.write_text(result.stdout, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default=os.environ.get("API_URL", DEFAULT_API_URL))
    parser.add_argument("--origin", default=os.environ.get("API_ORIGIN", DEFAULT_ORIGIN))
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--skip-schema", action="store_true", help="Skip pg_dump schema dump even if DATABASE_URL is set")
    args = parser.parse_args()

    api_url = args.api_url.rstrip("/")
    out = args.output_dir

    print(f"[snapshot] API: {api_url}")
    print(f"[snapshot] Output: {out}")

    print("[snapshot] Fetching /api/restaurants ...")
    rest_payload = http_get_json(f"{api_url}/api/restaurants?limit=1000", args.origin)
    restaurants = sort_restaurants(rest_payload.get("restaurants", []))

    print("[snapshot] Fetching /api/episodes/search ...")
    eps_payload = http_get_json(f"{api_url}/api/episodes/search?limit=100", args.origin)
    episodes = [sort_restaurants_within_episode(ep) for ep in eps_payload.get("episodes", [])]
    episodes = sort_episodes(episodes)

    write_json(out / "restaurants.json", restaurants)
    write_json(out / "episodes.json", episodes)

    manifest = {
        "api_url": api_url,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "restaurant_count": len(restaurants),
        "episode_count": len(episodes),
        "total_restaurants_in_episodes": eps_payload.get("total_restaurants"),
    }

    wrote_schema = False
    if not args.skip_schema:
        wrote_schema = dump_schema(out / "schema.sql")
    manifest["schema_sql_included"] = wrote_schema

    write_json(out / "manifest.json", manifest)

    print(f"[snapshot] Wrote {len(restaurants)} restaurants, {len(episodes)} episodes")
    if wrote_schema:
        print("[snapshot] Wrote schema.sql")
    return 0


if __name__ == "__main__":
    sys.exit(main())

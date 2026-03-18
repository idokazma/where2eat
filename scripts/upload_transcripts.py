#!/usr/bin/env python3
"""Fetch transcripts locally and upload them to the production server.

Usage:
    # Upload transcripts for all failed videos on the server
    python scripts/upload_transcripts.py

    # Upload transcript for specific video IDs
    python scripts/upload_transcripts.py w-n3zFXTuGM LXC39QRwVlc
"""

import os
import sys
import json
import requests

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'src'))

from youtube_transcript_collector import YouTubeTranscriptCollector

API_BASE = os.getenv(
    "W2E_API_URL", "https://where2eat-production.up.railway.app"
)
ADMIN_EMAIL = os.getenv("W2E_ADMIN_EMAIL", "admin@where2eat.app")
ADMIN_PASSWORD = os.getenv("W2E_ADMIN_PASSWORD", "w2e_admin_2026!")


def login():
    r = requests.post(
        f"{API_BASE}/api/admin/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    r.raise_for_status()
    return r.json()["token"]


def get_failed_video_ids(token):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(
        f"{API_BASE}/api/admin/pipeline/all-videos",
        params={"status": "failed", "limit": 100},
        headers=headers,
    )
    r.raise_for_status()
    data = r.json()
    videos = data.get("videos", data) if isinstance(data, dict) else data
    return [v["video_id"] for v in videos if v.get("video_id")]


def upload_transcript(token, video_id, transcript, language="he"):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(
        f"{API_BASE}/api/admin/pipeline/upload-transcript",
        json={
            "video_id": video_id,
            "transcript": transcript,
            "language": language,
        },
        headers=headers,
    )
    r.raise_for_status()
    return r.json()


def main():
    token = login()
    print(f"Logged in to {API_BASE}")

    # Get video IDs to process
    if len(sys.argv) > 1:
        video_ids = sys.argv[1:]
    else:
        print("Fetching failed video IDs from server...")
        video_ids = get_failed_video_ids(token)
        if not video_ids:
            print("No failed videos found.")
            return

    print(f"Processing {len(video_ids)} videos...\n")

    collector = YouTubeTranscriptCollector()
    success = 0
    failed = 0

    for video_id in video_ids:
        print(f"  [{video_id}] Fetching transcript locally...")
        result = collector.get_transcript(video_id)

        if not result or not result.get("transcript"):
            print(f"  [{video_id}] Could not fetch transcript locally either")
            failed += 1
            continue

        language = result.get("language", "he")
        transcript_len = len(result["transcript"])
        print(f"  [{video_id}] Got {transcript_len:,} chars ({language}), uploading...")

        try:
            resp = upload_transcript(token, video_id, result["transcript"], language)
            print(f"  [{video_id}] Uploaded successfully")
            success += 1
        except Exception as e:
            print(f"  [{video_id}] Upload failed: {e}")
            failed += 1

    print(f"\nDone: {success} uploaded, {failed} failed")


if __name__ == "__main__":
    main()

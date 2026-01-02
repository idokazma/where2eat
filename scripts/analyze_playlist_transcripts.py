#!/usr/bin/env python3
"""
Demo script to analyze YouTube videos from a playlist and extract restaurant mentions.
Uses transcript API directly (no YouTube Data API key needed for transcripts).
"""

import os
import sys
import json
import re

# Add project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.youtube_transcript_collector import YouTubeTranscriptCollector


def extract_video_ids_from_playlist_page(playlist_id):
    """
    Extract video IDs by fetching the playlist page directly.
    This is a fallback when we don't have the YouTube Data API key.
    """
    import urllib.request
    import urllib.error

    url = f"https://www.youtube.com/playlist?list={playlist_id}"

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        with urllib.request.urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8')

        # Extract video IDs from the page
        # Pattern matches "videoId":"XXXXXXXXXXX"
        pattern = r'"videoId":"([a-zA-Z0-9_-]{11})"'
        matches = re.findall(pattern, html)

        # Remove duplicates while preserving order
        seen = set()
        video_ids = []
        for vid in matches:
            if vid not in seen:
                seen.add(vid)
                video_ids.append(vid)

        return video_ids
    except Exception as e:
        print(f"Error fetching playlist page: {e}")
        return []


def main():
    playlist_id = "PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"

    print("=" * 70)
    print("YouTube Playlist Transcript Analyzer")
    print("=" * 70)

    # Get video IDs from the playlist
    print(f"\nFetching videos from playlist: {playlist_id}")
    video_ids = extract_video_ids_from_playlist_page(playlist_id)

    if not video_ids:
        print("Could not fetch video IDs from playlist")
        sys.exit(1)

    print(f"Found {len(video_ids)} videos in playlist")

    # Limit to latest 10
    video_ids = video_ids[:10]
    print(f"Processing first {len(video_ids)} videos...")
    print("=" * 70)

    # Initialize transcript collector
    transcript_collector = YouTubeTranscriptCollector()

    # Process each video
    results = []
    for i, video_id in enumerate(video_ids, 1):
        print(f"\n[{i}/{len(video_ids)}] Processing video: {video_id}")
        print(f"    URL: https://youtube.com/watch?v={video_id}")

        try:
            transcript_data = transcript_collector.get_transcript(video_id)
            if transcript_data:
                transcript_text = transcript_data.get('transcript', '')
                language = transcript_data.get('language', 'unknown')
                print(f"    Transcript: {len(transcript_text)} chars ({language})")

                results.append({
                    'video_id': video_id,
                    'url': f"https://youtube.com/watch?v={video_id}",
                    'transcript_length': len(transcript_text),
                    'language': language,
                    'transcript': transcript_text
                })
            else:
                print(f"    No transcript available")
                results.append({
                    'video_id': video_id,
                    'url': f"https://youtube.com/watch?v={video_id}",
                    'error': 'No transcript'
                })
        except Exception as e:
            error_msg = str(e)
            print(f"    Error: {error_msg[:80]}")
            results.append({
                'video_id': video_id,
                'url': f"https://youtube.com/watch?v={video_id}",
                'error': error_msg
            })

    # Summary
    print("\n" + "=" * 70)
    print("TRANSCRIPT FETCH SUMMARY")
    print("=" * 70)

    successful = [r for r in results if 'transcript' in r]
    print(f"\nSuccessfully fetched: {len(successful)}/{len(results)} transcripts")

    for r in results:
        if 'transcript_length' in r:
            status = f"{r['transcript_length']} chars ({r['language']})"
        else:
            status = f"ERROR: {r.get('error', 'Unknown')[:50]}"
        print(f"  [{r['video_id']}] {status}")

    # Save results for analysis
    output_file = os.path.join(os.path.dirname(__file__), '..', 'playlist_transcripts.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nTranscripts saved to: {output_file}")

    return results


if __name__ == "__main__":
    main()

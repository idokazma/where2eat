#!/usr/bin/env python3
"""
Analyze YouTube playlist using Tactiq for transcripts.
Fetches transcripts via browser automation and analyzes for restaurant mentions.
"""

import asyncio
import os
import sys
import json
import argparse
import re

# Add project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.tactiq_transcript_fetcher import TactiqTranscriptFetcher, TranscriptResult


def extract_video_ids_from_playlist_url(playlist_url: str) -> list:
    """
    Extract video IDs from a playlist URL.
    For now, we'll manually specify videos or use a simple approach.
    """
    # Extract the video ID from the URL if present
    video_match = re.search(r'[?&]v=([a-zA-Z0-9_-]{11})', playlist_url)
    if video_match:
        return [video_match.group(1)]
    return []


async def analyze_playlist(
    video_urls: list,
    max_videos: int = 10,
    headless: bool = True,
    output_file: str = "tactiq_analysis_results.json"
):
    """
    Analyze videos using Tactiq for transcripts.
    """
    print("=" * 70)
    print("YouTube Playlist Analyzer (Tactiq)")
    print("=" * 70)
    print(f"Videos to analyze: {len(video_urls)}")
    print(f"Max videos: {max_videos}")
    print("=" * 70)

    results = []
    all_transcripts = []

    async with TactiqTranscriptFetcher(headless=headless) as fetcher:
        for i, url in enumerate(video_urls[:max_videos]):
            print(f"\n[{i+1}/{min(len(video_urls), max_videos)}] Fetching: {url}")

            result = await fetcher.get_transcript(url)

            if result.success:
                print(f"    ✓ Got transcript: {len(result.transcript)} chars")
                all_transcripts.append({
                    "video_id": result.video_id,
                    "video_url": result.video_url,
                    "title": result.title,
                    "transcript": result.transcript,
                    "language": result.language
                })
            else:
                print(f"    ✗ Error: {result.error}")

            results.append({
                "video_id": result.video_id,
                "video_url": result.video_url,
                "title": result.title,
                "success": result.success,
                "transcript_length": len(result.transcript) if result.transcript else 0,
                "error": result.error
            })

            # Rate limiting
            if i < min(len(video_urls), max_videos) - 1:
                await asyncio.sleep(3)

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    successful = [r for r in results if r["success"]]
    print(f"Successfully fetched: {len(successful)}/{len(results)} transcripts")

    for r in results:
        status = f"{r['transcript_length']} chars" if r["success"] else f"ERROR: {r['error']}"
        print(f"  [{r['video_id']}] {status}")

    # Save results
    output_path = os.path.join(os.path.dirname(__file__), '..', output_file)
    output_data = {
        "summary": {
            "total_videos": len(results),
            "successful": len(successful),
            "failed": len(results) - len(successful)
        },
        "videos": results,
        "transcripts": all_transcripts
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    print(f"\nResults saved to: {output_path}")

    return output_data


def main():
    parser = argparse.ArgumentParser(
        description='Analyze YouTube videos using Tactiq for transcripts'
    )
    parser.add_argument(
        'urls',
        nargs='+',
        help='YouTube video URLs to analyze'
    )
    parser.add_argument(
        '--max-videos',
        type=int,
        default=10,
        help='Maximum number of videos to analyze (default: 10)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='tactiq_analysis_results.json',
        help='Output file path'
    )
    parser.add_argument(
        '--show-browser',
        action='store_true',
        help='Show browser window (non-headless mode)'
    )

    args = parser.parse_args()

    # Run the async analysis
    asyncio.run(analyze_playlist(
        video_urls=args.urls,
        max_videos=args.max_videos,
        headless=not args.show_browser,
        output_file=args.output
    ))


if __name__ == "__main__":
    main()

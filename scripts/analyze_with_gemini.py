#!/usr/bin/env python3
"""
Analyze YouTube playlist using Gemini's video understanding.
Extracts restaurants from each video in the playlist.
"""

import os
import sys
import json
import argparse

# Add project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.gemini_video_analyzer import GeminiVideoAnalyzer, analyze_playlist_with_gemini


def main():
    parser = argparse.ArgumentParser(
        description='Analyze YouTube playlist for restaurant mentions using Gemini'
    )
    parser.add_argument(
        'url',
        help='YouTube playlist URL or video URL with playlist'
    )
    parser.add_argument(
        '--max-videos',
        type=int,
        default=10,
        help='Maximum number of videos to analyze (default: 10)'
    )
    parser.add_argument(
        '--api-key',
        type=str,
        help='Gemini API key (or set GEMINI_API_KEY env var)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='gemini_analysis_results.json',
        help='Output file path (default: gemini_analysis_results.json)'
    )

    args = parser.parse_args()

    # Check for API key
    api_key = args.api_key or os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        print("Error: Gemini API key required")
        print("Set GEMINI_API_KEY environment variable or use --api-key flag")
        sys.exit(1)

    print("=" * 70)
    print("YouTube Playlist Analyzer (Gemini)")
    print("=" * 70)
    print(f"Playlist URL: {args.url}")
    print(f"Max videos: {args.max_videos}")
    print("=" * 70)

    try:
        # Analyze the playlist
        results = analyze_playlist_with_gemini(
            playlist_url=args.url,
            api_key=api_key,
            max_videos=args.max_videos
        )

        # Print summary
        print("\n" + "=" * 70)
        print("ANALYSIS COMPLETE")
        print("=" * 70)

        if results['success']:
            print(f"Videos analyzed: {results['videos_analyzed']}")
            print(f"Total restaurants found: {results['total_restaurants_found']}")

            print("\n--- RESTAURANTS BY EPISODE ---")
            for video in results['videos']:
                print(f"\n[{video['video_id']}] {video.get('title', 'Unknown')}")
                if video['success']:
                    if video['restaurants']:
                        for r in video['restaurants']:
                            name = r.get('name_hebrew') or r.get('name_english', 'Unknown')
                            location = r.get('location', {}).get('city', '')
                            opinion = r.get('host_opinion', '')
                            print(f"  - {name} ({location}) [{opinion}]")
                    else:
                        print("  No restaurants mentioned")
                else:
                    print(f"  ERROR: {video.get('error', 'Unknown error')}")

            # Save to file
            output_path = os.path.join(os.path.dirname(__file__), '..', args.output)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"\nResults saved to: {output_path}")

        else:
            print(f"Analysis failed: {results.get('error', 'Unknown error')}")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()

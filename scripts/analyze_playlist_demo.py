#!/usr/bin/env python3
"""
Demo script to analyze a YouTube playlist and extract restaurant mentions.
"""

import os
import sys
import json

# Add project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.youtube_channel_collector import YouTubeChannelCollector, PlaylistNotFoundError
from src.youtube_transcript_collector import YouTubeTranscriptCollector


def main():
    playlist_url = "https://www.youtube.com/watch?v=6jvskRWvQkg&list=PLZPgleW4baxrsrU-metYY1imJ85uH9FNg"

    # Check for API key
    api_key = os.getenv('YOUTUBE_DATA_API_KEY')
    if not api_key:
        print("Error: YOUTUBE_DATA_API_KEY not set")
        sys.exit(1)

    print("=" * 60)
    print("YouTube Playlist Restaurant Analyzer")
    print("=" * 60)

    # Initialize collectors
    channel_collector = YouTubeChannelCollector(api_key=api_key)
    transcript_collector = YouTubeTranscriptCollector()

    # Extract playlist ID
    playlist_id = channel_collector.extract_playlist_id(playlist_url)
    print(f"\nPlaylist ID: {playlist_id}")

    # Get playlist info
    try:
        playlist_info = channel_collector.get_playlist_info(playlist_id)
        print(f"Playlist Title: {playlist_info['title']}")
        print(f"Channel: {playlist_info['channel_title']}")
        print(f"Total Videos: {playlist_info['video_count']}")
    except PlaylistNotFoundError as e:
        print(f"Error: {e}")
        sys.exit(1)

    # Get latest 10 videos
    print(f"\nFetching latest 10 videos...")
    videos = channel_collector.get_playlist_videos(playlist_id, max_results=10)

    print(f"Found {len(videos)} videos to process")
    print("=" * 60)

    # Process each video
    results = []
    for i, video in enumerate(videos, 1):
        video_id = video['video_id']
        title = video['title']

        print(f"\n[{i}/{len(videos)}] Processing: {title[:50]}...")
        print(f"    Video ID: {video_id}")

        # Get transcript
        try:
            transcript_data = transcript_collector.get_transcript(video_id)
            if transcript_data:
                transcript_text = transcript_data.get('transcript', '')
                language = transcript_data.get('language', 'unknown')
                print(f"    Transcript: {len(transcript_text)} chars ({language})")

                results.append({
                    'video_id': video_id,
                    'title': title,
                    'transcript_length': len(transcript_text),
                    'language': language,
                    'transcript_preview': transcript_text[:500] if transcript_text else None
                })
            else:
                print(f"    No transcript available")
                results.append({
                    'video_id': video_id,
                    'title': title,
                    'error': 'No transcript'
                })
        except Exception as e:
            print(f"    Error: {str(e)[:50]}")
            results.append({
                'video_id': video_id,
                'title': title,
                'error': str(e)
            })

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    successful = [r for r in results if 'transcript_length' in r]
    print(f"\nSuccessfully fetched transcripts: {len(successful)}/{len(results)}")

    for r in results:
        status = f"{r.get('transcript_length', 0)} chars" if 'transcript_length' in r else f"ERROR: {r.get('error', 'Unknown')}"
        print(f"  - {r['title'][:40]}... : {status}")

    # Save results
    output_file = os.path.join(os.path.dirname(__file__), '..', 'playlist_analysis_results.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nResults saved to: {output_file}")

    return results


if __name__ == "__main__":
    main()

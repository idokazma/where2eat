"""
Demo script for YouTube Transcript Collector
Demonstrates how to collect transcripts from YouTube videos about restaurants.
"""

from youtube_transcript_collector import YouTubeTranscriptCollector


def main():
    """Run demo of YouTube transcript collection."""

    # Initialize the collector
    collector = YouTubeTranscriptCollector()

    print("=" * 80)
    print("YouTube Transcript Collector - Demo")
    print("=" * 80)
    print()

    # Example 1: Single video transcript
    print("Example 1: Fetching transcript from a single video")
    print("-" * 80)

    # You can use any YouTube video URL here
    # This is just an example format - replace with actual video URLs about restaurants
    example_url = input("Enter a YouTube video URL (or press Enter to skip): ").strip()

    if example_url:
        print(f"\nFetching transcript for: {example_url}")
        result = collector.get_transcript(example_url)

        if result:
            print(f"\n✓ Successfully fetched transcript!")
            print(f"  Video ID: {result['video_id']}")
            print(f"  Video URL: {result['video_url']}")
            print(f"  Language: {result['language']}")
            print(f"  Number of segments: {result['segment_count']}")
            print(f"  Total characters: {len(result['transcript'])}")
            print(f"\n  First 500 characters of transcript:")
            print(f"  {result['transcript'][:500]}...")

            # Show first few segments with timestamps
            print(f"\n  First 3 segments with timestamps:")
            for i, segment in enumerate(result['segments'][:3]):
                timestamp = segment.get('start', 0)
                minutes = int(timestamp // 60)
                seconds = int(timestamp % 60)
                print(f"    [{minutes}:{seconds:02d}] {segment['text']}")
        else:
            print("✗ Failed to fetch transcript")

    print()
    print("=" * 80)

    # Example 2: Batch processing
    print("Example 2: Batch processing multiple videos")
    print("-" * 80)

    batch_urls = []
    print("Enter YouTube URLs (one per line, empty line to finish):")
    while True:
        url = input("  URL: ").strip()
        if not url:
            break
        batch_urls.append(url)

    if batch_urls:
        print(f"\nFetching transcripts for {len(batch_urls)} videos...")
        results = collector.get_transcripts_batch(batch_urls)

        print(f"\n✓ Successfully fetched {len(results)} out of {len(batch_urls)} transcripts")

        for i, result in enumerate(results, 1):
            print(f"\n  Video {i}:")
            print(f"    Video ID: {result['video_id']}")
            print(f"    Segments: {result['segment_count']}")
            print(f"    Characters: {len(result['transcript'])}")

    print()
    print("=" * 80)

    # Example 3: Keyword search
    print("Example 3: Search for keywords in transcript")
    print("-" * 80)

    search_url = input("Enter a YouTube video URL to search (or press Enter to skip): ").strip()

    if search_url:
        keyword = input("Enter keyword to search for (e.g., 'restaurant', 'food'): ").strip()

        if keyword:
            print(f"\nSearching for '{keyword}' in video transcript...")
            matches = collector.search_transcript(search_url, keyword)

            print(f"\n✓ Found {len(matches)} segments containing '{keyword}'")

            if matches:
                print(f"\n  First 5 matches:")
                for i, segment in enumerate(matches[:5], 1):
                    timestamp = segment.get('start', 0)
                    minutes = int(timestamp // 60)
                    seconds = int(timestamp % 60)
                    print(f"    {i}. [{minutes}:{seconds:02d}] {segment['text']}")

    print()
    print("=" * 80)
    print("Demo complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()

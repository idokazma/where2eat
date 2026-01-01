"""
Example: How to fetch Hebrew transcripts from YouTube videos

This demonstrates multi-language support including Hebrew.
"""

from youtube_transcript_collector import YouTubeTranscriptCollector


def main():
    collector = YouTubeTranscriptCollector()

    # Your video with Hebrew subtitles
    video_url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

    print("=" * 80)
    print("MULTI-LANGUAGE TRANSCRIPT FETCHING EXAMPLE")
    print("=" * 80)
    print()

    # ========================================================================
    # Method 1: List all available languages first
    # ========================================================================
    print("Method 1: Check what languages are available")
    print("-" * 80)
    print()

    available = collector.list_available_transcripts(video_url)

    if available:
        print(f"Found {len(available)} available transcript(s):\n")
        for i, transcript in enumerate(available, 1):
            auto = " (auto-generated)" if transcript['is_generated'] else " (manual)"
            translatable = " [can translate]" if transcript['is_translatable'] else ""
            print(f"  {i}. {transcript['language']} ({transcript['language_code']}){auto}{translatable}")
    else:
        print("Could not list available transcripts (network issue)")

    print()

    # ========================================================================
    # Method 2: Fetch Hebrew transcript specifically
    # ========================================================================
    print("Method 2: Fetch Hebrew transcript (עברית)")
    print("-" * 80)
    print()

    # Hebrew can be 'he' or 'iw' depending on the video
    result = collector.get_transcript(video_url, languages=['he', 'iw'])

    if result:
        print(f"✓ Successfully fetched Hebrew transcript!")
        print(f"  Language: {result['language']}")
        print(f"  Segments: {result['segment_count']}")
        print(f"  Characters: {len(result['transcript'])}")
        print()
        print("First 5 segments:")
        for i, segment in enumerate(result['segments'][:5], 1):
            print(f"  {i}. [{segment['start']:.1f}s] {segment['text']}")
    else:
        print("✗ Hebrew transcript not available (or network issue)")

    print()

    # ========================================================================
    # Method 3: Auto-detect any available language
    # ========================================================================
    print("Method 3: Auto-detect and fetch any available language")
    print("-" * 80)
    print()

    result = collector.get_transcript_auto(video_url)

    if result:
        print(f"✓ Auto-detected transcript in: {result['language']}")
        print(f"  Video: {result['video_url']}")
        print(f"  Segments: {result['segment_count']}")
        print()
        print("Sample transcript:")
        print(result['transcript'][:500] + "...")
    else:
        print("✗ Could not fetch any transcript (network issue)")

    print()

    # ========================================================================
    # Method 4: Batch processing with multiple languages
    # ========================================================================
    print("Method 4: Batch processing with language preferences")
    print("-" * 80)
    print()

    videos = [
        "https://www.youtube.com/watch?v=rGS7OCpZ8J4",  # Hebrew video
        # Add more videos here
    ]

    print(f"Processing {len(videos)} video(s) with Hebrew preference...\n")

    results = collector.get_transcripts_batch(videos, languages=['he', 'iw', 'en'])

    print(f"✓ Successfully fetched {len(results)} transcript(s)")

    for i, result in enumerate(results, 1):
        print(f"  {i}. Video {result['video_id']}: {result['language']} ({result['segment_count']} segments)")

    print()
    print("=" * 80)
    print("USAGE SUMMARY")
    print("=" * 80)
    print()
    print("For Hebrew videos, use any of these methods:")
    print()
    print("1. Specific Hebrew:")
    print("   result = collector.get_transcript(url, languages=['he', 'iw'])")
    print()
    print("2. Auto-detect:")
    print("   result = collector.get_transcript_auto(url)")
    print()
    print("3. Check available first:")
    print("   available = collector.list_available_transcripts(url)")
    print("   # Then choose language from the list")
    print()
    print("All methods work with Hebrew (עברית) and any other language!")
    print("=" * 80)


if __name__ == "__main__":
    main()

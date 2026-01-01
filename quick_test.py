"""
Quick test script to verify YouTube transcript collection with specific video.
Tests the video: https://www.youtube.com/watch?v=rGS7OCpZ8J4
"""

from youtube_transcript_collector import YouTubeTranscriptCollector


def main():
    print("=" * 80)
    print("QUICK TEST: YouTube Transcript Collector")
    print("=" * 80)
    print()

    # Initialize collector
    collector = YouTubeTranscriptCollector()

    # Test video provided by user
    test_url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

    print(f"Testing with video: {test_url}")
    print("-" * 80)
    print()

    # Fetch transcript
    print("Fetching transcript...")
    result = collector.get_transcript(test_url)

    if result:
        print("✓ SUCCESS! Transcript fetched successfully.\n")

        print(f"Video Details:")
        print(f"  • Video ID: {result['video_id']}")
        print(f"  • Video URL: {result['video_url']}")
        print(f"  • Language: {result['language']}")
        print(f"  • Number of segments: {result['segment_count']}")
        print(f"  • Total characters: {len(result['transcript'])}")
        print(f"  • Total words (approx): {len(result['transcript'].split())}")
        print()

        print("First 500 characters of transcript:")
        print("-" * 80)
        print(result['transcript'][:500])
        print("...")
        print()

        print("First 10 segments with timestamps:")
        print("-" * 80)
        for i, segment in enumerate(result['segments'][:10], 1):
            timestamp = segment['start']
            minutes = int(timestamp // 60)
            seconds = int(timestamp % 60)
            print(f"{i:2d}. [{minutes:2d}:{seconds:02d}] {segment['text']}")
        print()

        # Test keyword search
        print("Testing keyword search functionality:")
        print("-" * 80)

        keywords_to_test = ['food', 'restaurant', 'eat', 'the', 'and']

        for keyword in keywords_to_test:
            matches = collector.search_transcript(test_url, keyword)
            print(f"  • Keyword '{keyword}': {len(matches)} occurrences")

            if matches and len(matches) > 0:
                # Show first match
                first_match = matches[0]
                timestamp = first_match['start']
                minutes = int(timestamp // 60)
                seconds = int(timestamp % 60)
                print(f"    First match at [{minutes}:{seconds:02d}]: {first_match['text'][:60]}...")

        print()
        print("=" * 80)
        print("✓ ALL TESTS PASSED!")
        print("=" * 80)

    else:
        print("✗ FAILED! Could not fetch transcript.")
        print()
        print("Possible reasons:")
        print("  • Video does not have captions/transcripts available")
        print("  • Video is private or unavailable")
        print("  • Network connectivity issues")
        print("  • Video ID is incorrect")
        print()
        print("=" * 80)
        print("✗ TEST FAILED")
        print("=" * 80)


if __name__ == "__main__":
    main()

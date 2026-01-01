"""
Fetch and print real transcript from YouTube video
"""

from youtube_transcript_collector import YouTubeTranscriptCollector

def main():
    # The video provided by user
    video_url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

    print("=" * 80)
    print("FETCHING REAL TRANSCRIPT FROM YOUTUBE")
    print("=" * 80)
    print(f"\nVideo URL: {video_url}")
    print("\nAttempting to fetch transcript...\n")

    # Initialize collector
    collector = YouTubeTranscriptCollector()

    # Fetch the transcript
    result = collector.get_transcript(video_url)

    if result:
        print("✓ SUCCESS!\n")
        print("-" * 80)
        print(f"Video ID: {result['video_id']}")
        print(f"Language: {result['language']}")
        print(f"Total Segments: {result['segment_count']}")
        print(f"Total Characters: {len(result['transcript'])}")
        print(f"Total Words (approx): {len(result['transcript'].split())}")
        print("-" * 80)

        print("\n" + "=" * 80)
        print("FULL TRANSCRIPT")
        print("=" * 80)
        print()
        print(result['transcript'])
        print()

        print("=" * 80)
        print("TRANSCRIPT SEGMENTS WITH TIMESTAMPS")
        print("=" * 80)
        print()

        for i, segment in enumerate(result['segments'], 1):
            timestamp = segment['start']
            minutes = int(timestamp // 60)
            seconds = int(timestamp % 60)
            print(f"[{minutes:2d}:{seconds:02d}] {segment['text']}")

        print()
        print("=" * 80)
        print(f"✓ Successfully fetched {result['segment_count']} segments")
        print("=" * 80)

    else:
        print("✗ FAILED to fetch transcript")
        print("\nThis could be due to:")
        print("  - Network connectivity issues")
        print("  - Video doesn't have transcripts available")
        print("  - Proxy/firewall restrictions")

if __name__ == "__main__":
    main()

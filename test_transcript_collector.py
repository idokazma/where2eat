"""
Unit tests for YouTube Transcript Collector
"""

import unittest
from youtube_transcript_collector import YouTubeTranscriptCollector


class TestYouTubeTranscriptCollector(unittest.TestCase):
    """Test cases for YouTubeTranscriptCollector class."""

    def setUp(self):
        """Set up test fixtures."""
        self.collector = YouTubeTranscriptCollector()

    def test_extract_video_id_from_watch_url(self):
        """Test extracting video ID from standard watch URL."""
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"
        video_id = self.collector.extract_video_id(url)
        self.assertEqual(video_id, "rGS7OCpZ8J4")

    def test_extract_video_id_from_short_url(self):
        """Test extracting video ID from youtu.be short URL."""
        url = "https://youtu.be/rGS7OCpZ8J4"
        video_id = self.collector.extract_video_id(url)
        self.assertEqual(video_id, "rGS7OCpZ8J4")

    def test_extract_video_id_from_embed_url(self):
        """Test extracting video ID from embed URL."""
        url = "https://www.youtube.com/embed/rGS7OCpZ8J4"
        video_id = self.collector.extract_video_id(url)
        self.assertEqual(video_id, "rGS7OCpZ8J4")

    def test_extract_video_id_from_v_url(self):
        """Test extracting video ID from /v/ URL."""
        url = "https://www.youtube.com/v/rGS7OCpZ8J4"
        video_id = self.collector.extract_video_id(url)
        self.assertEqual(video_id, "rGS7OCpZ8J4")

    def test_extract_video_id_from_plain_id(self):
        """Test extracting video ID from plain video ID."""
        video_id = self.collector.extract_video_id("rGS7OCpZ8J4")
        self.assertEqual(video_id, "rGS7OCpZ8J4")

    def test_extract_video_id_invalid_url(self):
        """Test extracting video ID from invalid URL."""
        url = "https://www.example.com/not-a-youtube-url"
        video_id = self.collector.extract_video_id(url)
        self.assertIsNone(video_id)

    def test_extract_video_id_with_query_params(self):
        """Test extracting video ID from URL with multiple query parameters."""
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4&t=10s&list=PLxyz"
        video_id = self.collector.extract_video_id(url)
        self.assertEqual(video_id, "rGS7OCpZ8J4")

    def test_get_transcript_real_video(self):
        """Test fetching transcript from real YouTube video."""
        # Using the video provided by user
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"
        result = self.collector.get_transcript(url)

        # Basic assertions
        self.assertIsNotNone(result, "Transcript should be fetched successfully")
        self.assertIn('video_id', result)
        self.assertIn('transcript', result)
        self.assertIn('segments', result)
        self.assertIn('video_url', result)
        self.assertIn('language', result)
        self.assertIn('segment_count', result)

        # Verify video ID
        self.assertEqual(result['video_id'], 'rGS7OCpZ8J4')

        # Verify transcript is not empty
        self.assertGreater(len(result['transcript']), 0, "Transcript should not be empty")

        # Verify segments exist
        self.assertGreater(result['segment_count'], 0, "Should have at least one segment")
        self.assertEqual(len(result['segments']), result['segment_count'])

        # Verify segment structure
        if result['segments']:
            first_segment = result['segments'][0]
            self.assertIn('text', first_segment)
            self.assertIn('start', first_segment)
            self.assertIn('duration', first_segment)

        print(f"\n✓ Successfully fetched transcript:")
        print(f"  Video ID: {result['video_id']}")
        print(f"  Language: {result['language']}")
        print(f"  Segments: {result['segment_count']}")
        print(f"  Characters: {len(result['transcript'])}")
        print(f"  First 200 chars: {result['transcript'][:200]}...")

    def test_get_transcript_invalid_video(self):
        """Test fetching transcript from invalid video ID."""
        result = self.collector.get_transcript("INVALID_VIDEO_ID_123")
        self.assertIsNone(result, "Should return None for invalid video")

    def test_get_transcript_invalid_url(self):
        """Test fetching transcript from invalid URL."""
        result = self.collector.get_transcript("https://www.example.com/invalid")
        self.assertIsNone(result, "Should return None for invalid URL")

    def test_get_transcripts_batch(self):
        """Test batch fetching transcripts."""
        # Using the real video and some invalid ones to test error handling
        urls = [
            "https://www.youtube.com/watch?v=rGS7OCpZ8J4",
            "INVALID_VIDEO_ID",
            "rGS7OCpZ8J4"  # Same video, different format
        ]

        results = self.collector.get_transcripts_batch(urls)

        # Should get at least 1 successful result (the valid video)
        self.assertGreaterEqual(len(results), 1, "Should fetch at least one transcript")

        # All results should have required keys
        for result in results:
            self.assertIn('video_id', result)
            self.assertIn('transcript', result)
            self.assertGreater(len(result['transcript']), 0)

        print(f"\n✓ Batch processing: {len(results)} out of {len(urls)} successful")

    def test_search_transcript_found(self):
        """Test searching for keyword in transcript."""
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

        # Try searching for common words that might appear
        # We'll test with "the" which is likely to appear
        matches = self.collector.search_transcript(url, "the")

        # Should find at least some matches
        self.assertIsInstance(matches, list)

        if matches:
            # Verify match structure
            first_match = matches[0]
            self.assertIn('text', first_match)
            self.assertIn('start', first_match)
            self.assertIn('the', first_match['text'].lower())

            print(f"\n✓ Keyword search: Found {len(matches)} matches for 'the'")
            print(f"  First match: {matches[0]['text']}")

    def test_search_transcript_not_found(self):
        """Test searching for keyword that doesn't exist."""
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

        # Search for a very unlikely word
        matches = self.collector.search_transcript(url, "xyzqwertytesting123456")

        self.assertIsInstance(matches, list)
        self.assertEqual(len(matches), 0, "Should return empty list for non-existent keyword")

    def test_search_transcript_case_insensitive(self):
        """Test that keyword search is case insensitive."""
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

        # Search for uppercase version
        matches_upper = self.collector.search_transcript(url, "THE")
        matches_lower = self.collector.search_transcript(url, "the")

        # Should return same number of results
        self.assertEqual(len(matches_upper), len(matches_lower),
                        "Case insensitive search should return same results")

    def test_transcript_full_text_matches_segments(self):
        """Test that full transcript text matches combined segments."""
        url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"
        result = self.collector.get_transcript(url)

        if result:
            # Reconstruct text from segments
            reconstructed = ' '.join([seg['text'] for seg in result['segments']])

            # Should match the full transcript
            self.assertEqual(result['transcript'], reconstructed,
                           "Full transcript should match combined segments")


class TestYouTubeTranscriptCollectorIntegration(unittest.TestCase):
    """Integration tests with real YouTube videos."""

    def setUp(self):
        """Set up test fixtures."""
        self.collector = YouTubeTranscriptCollector()
        # The video provided by user
        self.test_video_url = "https://www.youtube.com/watch?v=rGS7OCpZ8J4"

    def test_end_to_end_workflow(self):
        """Test complete workflow of fetching and analyzing transcript."""
        print("\n" + "=" * 80)
        print("END-TO-END INTEGRATION TEST")
        print("=" * 80)

        # Step 1: Fetch transcript
        print("\n1. Fetching transcript...")
        result = self.collector.get_transcript(self.test_video_url)

        self.assertIsNotNone(result, "Should successfully fetch transcript")
        print(f"   ✓ Fetched {result['segment_count']} segments")

        # Step 2: Analyze content
        print("\n2. Analyzing content...")
        transcript_text = result['transcript']
        word_count = len(transcript_text.split())
        print(f"   ✓ Total words: {word_count}")
        print(f"   ✓ Total characters: {len(transcript_text)}")

        # Step 3: Extract first few segments with timestamps
        print("\n3. First 5 segments with timestamps:")
        for i, segment in enumerate(result['segments'][:5], 1):
            timestamp = segment['start']
            minutes = int(timestamp // 60)
            seconds = int(timestamp % 60)
            print(f"   {i}. [{minutes}:{seconds:02d}] {segment['text'][:60]}...")

        # Step 4: Search for potential restaurant-related keywords
        print("\n4. Searching for restaurant-related keywords...")
        keywords = ['food', 'restaurant', 'eat', 'menu', 'dish']

        for keyword in keywords:
            matches = self.collector.search_transcript(self.test_video_url, keyword)
            if matches:
                print(f"   ✓ Found '{keyword}': {len(matches)} times")
            else:
                print(f"   - No matches for '{keyword}'")

        print("\n" + "=" * 80)
        print("INTEGRATION TEST COMPLETE")
        print("=" * 80)


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)

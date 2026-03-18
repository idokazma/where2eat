#!/usr/bin/env python3
"""
Extract timestamps and engaging quotes from a cached YouTube transcript
and update the corresponding restaurant JSON files.

Usage:
    python scripts/extract_timestamps_quotes.py
"""

import json
import hashlib
import glob
import os

# Paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRANSCRIPT_PATH = os.path.join(
    PROJECT_ROOT,
    "transcripts/6jvskRWvQkg_20260101_211724.json"
)
RESTAURANTS_DIR = os.path.join(PROJECT_ROOT, "data/restaurants")

# Known restaurant name -> segment mapping (pre-verified matches)
KNOWN_MATCHES = {
    "צ'קולי": {"segment_idx": 398, "start": 1077.2},
    "גורמי סבזי": {"segment_idx": 196, "start": 513.279, "search_term": "סבזי"},
    "הלנסן": {"segment_idx": 315, "start": 856.519},
    "מושיק": {"segment_idx": 560, "start": 1521.64},
    "פרינו": {"segment_idx": 499, "start": 1376.2},
    "מיז'נה": {"segment_idx": 205, "start": 535.12},
    "אלקבר": {"segment_idx": 223, "start": 596.32},
    "סטודיו גורשה": {"segment_idx": 438, "start": 1203.039, "search_term": "גורשה"},
    "מרי פוסה": {"segment_idx": 164, "start": 419.759, "search_term": "פוסה"},
    "הסתקיה": {"segment_idx": 264, "start": 707.839},
    "צפרירים": {"segment_idx": 332, "start": 901.959},
    "השוארמות": {"segment_idx": 346, "start": 947.399},
    # These were originally "maybe real" but verified in transcript
    "שוק": {"segment_idx": 900, "start": 2455.64},
    "מקומון": {"segment_idx": 510, "start": 1402.32},
}

# "Maybe real" restaurants - search for them, set null if not found
MAYBE_REAL = set()


def load_transcript(path):
    """Load the transcript JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_quote(segments, center_idx, max_chars=200):
    """
    Extract an engaging quote from segments around a mention.

    Grabs 2 segments before and 2 after the center, joins them,
    and trims to max_chars while keeping whole words.
    """
    total = len(segments)

    # Grab 2 before, the center, and 2 after (5 segments total)
    start_idx = max(0, center_idx - 2)
    end_idx = min(total, center_idx + 3)

    quote_segments = segments[start_idx:end_idx]
    raw_quote = " ".join(seg["text"] for seg in quote_segments)

    # Clean up: remove >> markers used for speaker changes
    raw_quote = raw_quote.replace(">>", "").strip()
    # Collapse multiple spaces
    raw_quote = " ".join(raw_quote.split())

    # Trim to max_chars at word boundary
    if len(raw_quote) > max_chars:
        trimmed = raw_quote[:max_chars]
        last_space = trimmed.rfind(" ")
        if last_space > max_chars * 0.6:
            trimmed = trimmed[:last_space]
        raw_quote = trimmed + "..."

    return raw_quote


def search_transcript_for_name(segments, name):
    """
    Search transcript segments for a restaurant name.
    Returns (segment_index, start_time) or (None, None).
    """
    # Try exact name first, then partial matches
    search_terms = [name]

    # For multi-word names, also search for the most distinctive word
    words = name.split()
    if len(words) > 1:
        # Add each word as a fallback search term (longest first)
        search_terms.extend(sorted(words, key=len, reverse=True))

    for term in search_terms:
        for i, seg in enumerate(segments):
            if term in seg["text"]:
                return i, seg["start"]

    return None, None


def generate_id(video_id, name_hebrew):
    """Generate a stable ID from video_id and restaurant name."""
    return hashlib.md5(f"{video_id}_{name_hebrew}".encode()).hexdigest()[:12]


def main():
    print("Loading transcript...")
    transcript = load_transcript(TRANSCRIPT_PATH)
    video_id = transcript["video_id"]
    segments = transcript["segments"]
    print(f"  Video ID: {video_id}")
    print(f"  Segments: {len(segments)}")
    print()

    # Find all restaurant JSON files for this video
    pattern = os.path.join(RESTAURANTS_DIR, f"{video_id}_*.json")
    restaurant_files = sorted(glob.glob(pattern))
    print(f"Found {len(restaurant_files)} restaurant files")
    print("=" * 70)

    results = []

    for filepath in restaurant_files:
        filename = os.path.basename(filepath)
        with open(filepath, "r", encoding="utf-8") as f:
            restaurant = json.load(f)

        name_hebrew = restaurant["name_hebrew"]
        print(f"\nProcessing: {name_hebrew} ({filename})")

        # Generate stable ID
        stable_id = generate_id(video_id, name_hebrew)
        restaurant["id"] = stable_id
        print(f"  ID: {stable_id}")

        # Find timestamp
        seg_idx = None
        start_time = None

        if name_hebrew in KNOWN_MATCHES:
            # Use pre-verified match
            match = KNOWN_MATCHES[name_hebrew]
            seg_idx = match["segment_idx"]
            start_time = match["start"]
            print(f"  Using known match: segment {seg_idx}, start={start_time}s")
        else:
            # Search transcript
            seg_idx, start_time = search_transcript_for_name(segments, name_hebrew)
            if seg_idx is not None:
                print(f"  Found via search: segment {seg_idx}, start={start_time}s")
            else:
                if name_hebrew in MAYBE_REAL:
                    print(f"  Not found in transcript (maybe-real restaurant)")
                else:
                    print(f"  WARNING: Not found in transcript!")

        # Set timestamp
        if start_time is not None:
            restaurant["mention_timestamp_seconds"] = int(start_time)
        else:
            restaurant["mention_timestamp_seconds"] = None

        # Extract engaging quote
        if seg_idx is not None:
            quote = extract_quote(segments, seg_idx)
            restaurant["engaging_quote"] = quote
            print(f"  Quote: {quote[:80]}...")
        else:
            restaurant["engaging_quote"] = None
            print(f"  Quote: None")

        # Save updated JSON
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(restaurant, f, ensure_ascii=False, indent=2)

        results.append({
            "name": name_hebrew,
            "id": stable_id,
            "timestamp": restaurant["mention_timestamp_seconds"],
            "quote_length": len(restaurant["engaging_quote"]) if restaurant["engaging_quote"] else 0,
            "filename": filename,
        })

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    found = sum(1 for r in results if r["timestamp"] is not None)
    print(f"Restaurants with timestamps: {found}/{len(results)}")
    print()
    for r in results:
        ts = r["timestamp"]
        ts_str = f"{ts}s ({ts // 60}:{ts % 60:02d})" if ts else "None"
        print(f"  {r['name']:20s}  id={r['id']}  timestamp={ts_str}  quote_len={r['quote_length']}")


if __name__ == "__main__":
    main()

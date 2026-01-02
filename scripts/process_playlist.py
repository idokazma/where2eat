#!/usr/bin/env python3
"""
YouTube Playlist Processing Script
Command-line interface for processing YouTube playlists using the batch processor.
"""

import argparse
import os
import sys
from datetime import datetime
from typing import Optional

# Add project root to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.channel_batch_processor import ChannelBatchProcessor, BatchProcessingError
from src.youtube_channel_collector import APIQuotaExceededError, PlaylistNotFoundError


def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Process YouTube playlists for restaurant discovery'
    )

    parser.add_argument(
        'playlist_url',
        help='YouTube playlist URL to process (e.g., https://youtube.com/playlist?list=PLxxx or video URL with list= parameter)'
    )

    # Filtering options
    parser.add_argument(
        '--max_results',
        type=int,
        default=50,
        help='Maximum number of videos to process (default: 50)'
    )

    parser.add_argument(
        '--date_from',
        type=str,
        help='Start date filter (YYYY-MM-DD)'
    )

    parser.add_argument(
        '--date_to',
        type=str,
        help='End date filter (YYYY-MM-DD)'
    )

    parser.add_argument(
        '--min_views',
        type=int,
        help='Minimum view count filter'
    )

    parser.add_argument(
        '--min_duration_seconds',
        type=int,
        help='Minimum video duration in seconds'
    )

    # Processing options
    parser.add_argument(
        '--batch_size',
        type=int,
        default=5,
        help='Number of videos to process in each batch (default: 5)'
    )

    parser.add_argument(
        '--skip_existing',
        type=bool,
        default=True,
        help='Skip videos that have already been processed (default: True)'
    )

    parser.add_argument(
        '--output_dir',
        type=str,
        default='batch_jobs',
        help='Directory to save job results (default: batch_jobs)'
    )

    return parser.parse_args()


def convert_date_string(date_str: Optional[str]) -> Optional[datetime]:
    """Convert date string to datetime object."""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        print(f"Error: Invalid date format '{date_str}'. Use YYYY-MM-DD format.")
        sys.exit(1)


def progress_callback(job_id: str, progress: dict):
    """Print progress updates to console."""
    percentage = progress.get('percentage', 0)
    completed = progress.get('videos_completed', 0)
    total = progress.get('videos_total', 0)
    failed = progress.get('videos_failed', 0)
    restaurants = progress.get('restaurants_found', 0)

    print(f"📊 Progress: {percentage:.1f}% ({completed}/{total} videos)")
    print(f"✅ Completed: {completed}, ❌ Failed: {failed}, 🍴 Restaurants: {restaurants}")


def main():
    """Main execution function."""
    args = parse_arguments()

    print("🚀 YouTube Playlist Processing Script")
    print("=" * 50)
    print(f"📋 Playlist URL: {args.playlist_url}")
    print(f"⚙️ Max Results: {args.max_results}")
    print(f"📦 Batch Size: {args.batch_size}")
    print("=" * 50)

    # Check for YouTube Data API key
    api_key = os.getenv('YOUTUBE_DATA_API_KEY')
    if not api_key:
        print("❌ Error: YOUTUBE_DATA_API_KEY environment variable not set")
        print("   Please set your YouTube Data API key:")
        print("   export YOUTUBE_DATA_API_KEY='your-api-key-here'")
        sys.exit(1)

    try:
        # Initialize batch processor
        processor = ChannelBatchProcessor(
            batch_size=args.batch_size,
            output_dir=args.output_dir
        )

        # Set progress callback
        processor.set_progress_callback(progress_callback)

        # Prepare filters
        filters = {
            'max_results': args.max_results
        }

        if args.date_from:
            filters['date_from'] = convert_date_string(args.date_from)

        if args.date_to:
            filters['date_to'] = convert_date_string(args.date_to)

        if args.min_views:
            filters['min_views'] = args.min_views

        if args.min_duration_seconds:
            filters['min_duration_seconds'] = args.min_duration_seconds

        print(f"🔧 Applied Filters: {filters}")
        print("")

        # Start playlist processing
        print("🎯 Starting playlist processing...")
        job = processor.start_playlist_processing(
            playlist_url=args.playlist_url,
            api_key=api_key,
            filters=filters
        )

        print(f"✅ Job created successfully!")
        print(f"📊 Job ID: {job.job_id}")
        print(f"📋 Playlist: {job.channel_title}")
        print(f"🎬 Total Videos: {job.total_videos}")
        print(f"📦 Batches: {len(job.video_batches)}")
        print("")

        if job.total_videos == 0:
            print("⚠️  No videos found matching the specified filters.")
            print("   Try adjusting your filters or check the playlist URL.")
            sys.exit(0)

        # For now, we'll just simulate processing since we don't have the full async infrastructure
        print("🚧 Note: This is a proof-of-concept implementation.")
        print("   In the full system, videos would be processed asynchronously.")
        print("")

        # Estimate processing time
        estimated_time = processor.estimate_processing_time(job.total_videos)
        print(f"⏱️  Estimated Processing Time: {estimated_time:.1f} minutes")

        # Save job information
        job_file = processor.save_job_results(job)
        print(f"📁 Job details saved to: {job_file}")

        print("")
        print("✅ Playlist processing setup completed successfully!")
        print(f"🎯 Ready to process {job.total_videos} videos from '{job.channel_title}'")

    except PlaylistNotFoundError as e:
        print(f"❌ Playlist Error: {str(e)}")
        print("   Please check the playlist URL and try again.")
        sys.exit(1)

    except APIQuotaExceededError as e:
        print(f"❌ API Quota Error: {str(e)}")
        print("   Please wait or increase your YouTube Data API quota.")
        sys.exit(1)

    except BatchProcessingError as e:
        print(f"❌ Processing Error: {str(e)}")
        sys.exit(1)

    except Exception as e:
        print(f"❌ Unexpected Error: {str(e)}")
        print("   Please check your inputs and try again.")
        sys.exit(1)


if __name__ == "__main__":
    main()

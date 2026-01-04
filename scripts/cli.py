#!/usr/bin/env python3
"""
Where2Eat Backend CLI

Command-line interface for backend operations.
Use this to test and run backend functionality independently of the frontend.

Usage:
    python scripts/cli.py process-video <youtube_url>
    python scripts/cli.py process-transcript <file_path>
    python scripts/cli.py process-transcripts <folder_path> [--recursive]
    python scripts/cli.py list-restaurants [--location CITY] [--cuisine TYPE]
    python scripts/cli.py import-json <directory>
    python scripts/cli.py stats
    python scripts/cli.py health

Transcript File Formats:
    Supported formats for process-transcript and process-transcripts:
    - .txt  - Plain text transcript
    - .json - JSON with 'transcript' or 'segments' field
    - .srt  - SubRip subtitle format
    - .vtt  - WebVTT subtitle format
"""

import os
import sys
import argparse
import json
from datetime import datetime

# Add project paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(PROJECT_ROOT, 'src'))

from backend_service import BackendService, get_backend_service


def create_service(db_path: str = None) -> BackendService:
    """Create backend service instance."""
    return get_backend_service(db_path)


def cmd_process_video(args):
    """Process a YouTube video and extract restaurants."""
    service = create_service(args.db)

    print(f"Processing video: {args.url}")
    print("-" * 50)

    def progress_callback(step, progress):
        steps = {
            'validating_url': 'Validating URL',
            'fetching_transcript': 'Fetching transcript',
            'analyzing_transcript': 'Analyzing with AI',
            'saving_results': 'Saving to database',
            'completed': 'Completed'
        }
        step_name = steps.get(step, step)
        print(f"  [{int(progress * 100):3d}%] {step_name}")

    result = service.process_video(
        video_url=args.url,
        language=args.language or 'he',
        save_to_db=not args.dry_run,
        progress_callback=progress_callback
    )

    print("-" * 50)

    if result['success']:
        print(f"Success! Found {result['restaurants_found']} restaurants")
        print(f"Episode ID: {result.get('episode_id', 'N/A')}")
        print()

        if result['restaurants']:
            print("Restaurants found:")
            for i, restaurant in enumerate(result['restaurants'], 1):
                name = restaurant.get('name_hebrew', 'Unknown')
                city = restaurant.get('location', {}).get('city', 'Unknown')
                cuisine = restaurant.get('cuisine_type', 'Unknown')
                print(f"  {i}. {name} ({city}) - {cuisine}")

        if result.get('food_trends'):
            print(f"\nFood trends: {', '.join(result['food_trends'])}")

        if result.get('episode_summary'):
            print(f"\nSummary: {result['episode_summary']}")
    else:
        print(f"Failed: {result.get('error', 'Unknown error')}")

    return 0 if result['success'] else 1


def cmd_list_restaurants(args):
    """List restaurants from the database."""
    service = create_service(args.db)

    filters = {}
    if args.location:
        filters['location'] = args.location
    if args.cuisine:
        filters['cuisine'] = args.cuisine
    if args.price:
        filters['price_range'] = args.price
    if args.opinion:
        filters['host_opinion'] = args.opinion

    if filters:
        result = service.search_restaurants(**filters, limit=args.limit or 50)
        restaurants = result['restaurants']
        total = result['analytics']['total_count']
        print(f"Found {total} restaurants matching filters")
    else:
        restaurants = service.get_all_restaurants()
        total = len(restaurants)
        print(f"Total restaurants: {total}")

    if args.limit:
        restaurants = restaurants[:args.limit]

    print("-" * 80)

    if args.json:
        print(json.dumps(restaurants, indent=2, ensure_ascii=False))
    else:
        for i, r in enumerate(restaurants, 1):
            name = r.get('name_hebrew', 'Unknown')
            city = r.get('location', {}).get('city', 'Unknown')
            cuisine = r.get('cuisine_type', 'Unknown')
            opinion = r.get('host_opinion', 'Unknown')
            price = r.get('price_range', 'Unknown')

            print(f"{i:3d}. {name}")
            print(f"     Location: {city} | Cuisine: {cuisine} | Price: {price} | Opinion: {opinion}")

            if r.get('episode_info', {}).get('video_id'):
                print(f"     Episode: {r['episode_info']['video_id']}")

            print()

    return 0


def cmd_import_json(args):
    """Import restaurants from JSON files."""
    service = create_service(args.db)

    if not os.path.exists(args.directory):
        print(f"Error: Directory not found: {args.directory}")
        return 1

    print(f"Importing from: {args.directory}")
    result = service.import_json_files(args.directory)

    print(f"Imported: {result['imported']}")
    print(f"Failed: {result['failed']}")

    if result.get('errors'):
        print("\nErrors:")
        for error in result['errors']:
            print(f"  - {error}")

    return 0 if result['failed'] == 0 else 1


def cmd_stats(args):
    """Show database statistics."""
    service = create_service(args.db)

    stats = service.get_stats()

    print("Database Statistics")
    print("-" * 40)
    print(f"Restaurants: {stats['restaurants']}")
    print(f"Episodes: {stats['episodes']}")
    print(f"Unique cities: {stats['unique_cities']}")
    print(f"Unique cuisines: {stats['unique_cuisines']}")
    print(f"Active jobs: {stats['active_jobs']}")

    if args.json:
        print("\nJSON:")
        print(json.dumps(stats, indent=2))

    return 0


def cmd_health(args):
    """Check system health."""
    service = create_service(args.db)

    health = service.health_check()

    print("System Health Check")
    print("-" * 40)
    print(f"Status: {health['status']}")
    print(f"Timestamp: {health['timestamp']}")
    print()
    print("Components:")
    for component, status in health['checks'].items():
        status_str = "OK" if status else "FAILED"
        print(f"  - {component}: {status_str}")

    if args.json:
        print("\nJSON:")
        print(json.dumps(health, indent=2))

    return 0 if health['status'] == 'healthy' else 1


def cmd_search_episodes(args):
    """Search episodes."""
    service = create_service(args.db)

    result = service.search_episodes(
        min_restaurants=args.min_restaurants or 1,
        cuisine_filter=args.cuisine,
        location_filter=args.location,
        limit=args.limit or 20
    )

    print(f"Found {result['count']} episodes with {result['total_restaurants']} total restaurants")
    print("-" * 80)

    for episode in result['episodes']:
        ep_info = episode.get('episode_info', {})
        video_id = ep_info.get('video_id', 'Unknown')
        title = ep_info.get('title', 'Untitled')
        date = ep_info.get('analysis_date', 'Unknown')
        count = episode.get('matching_restaurants', 0)

        print(f"Episode: {video_id}")
        if title:
            print(f"  Title: {title}")
        print(f"  Date: {date}")
        print(f"  Restaurants: {count}")

        if args.verbose:
            for r in episode.get('restaurants', [])[:5]:
                print(f"    - {r.get('name_hebrew', 'Unknown')}")
            if len(episode.get('restaurants', [])) > 5:
                print(f"    ... and {len(episode['restaurants']) - 5} more")

        print()

    return 0


def cmd_analytics(args):
    """Show analytics."""
    service = create_service(args.db)

    if args.type == 'timeline':
        result = service.get_timeline_analytics(
            granularity=args.granularity or 'day'
        )

        print("Timeline Analytics")
        print("-" * 50)
        print(f"Total restaurants: {result['summary']['total_restaurants']}")
        print(f"Unique episodes: {result['summary']['unique_episodes']}")
        print()

        if result['timeline']:
            print("Recent activity:")
            for item in result['timeline'][:10]:
                print(f"  {item['date']}: {item['count']} restaurants")

        print()
        print("Cuisine distribution:")
        for cuisine, count in sorted(
            result['analytics']['cuisine_distribution'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]:
            print(f"  {cuisine}: {count}")

    elif args.type == 'trends':
        result = service.get_trends_analytics(
            period=args.period or '3months'
        )

        print("Trends Analytics")
        print("-" * 50)
        summary = result['period_summary']
        print(f"Period: {summary['period']}")
        print(f"Restaurants discovered: {summary['restaurants_discovered']}")
        print(f"Most active region: {summary['most_active_region']}")
        print()

        if result['trending_restaurants']:
            print("Trending restaurants:")
            for r in result['trending_restaurants']:
                name = r.get('name_hebrew', 'Unknown')
                city = r.get('location', {}).get('city', 'Unknown')
                print(f"  - {name} ({city})")

        print()
        print("Regional patterns:")
        for region in result['regional_patterns']:
            if region['total'] > 0:
                print(f"  {region['region']}: {region['total']} restaurants")
                if region['top_cuisine']:
                    print(f"    Top cuisine: {region['top_cuisine']}")
                if region['top_city']:
                    print(f"    Top city: {region['top_city']}")

    return 0


def cmd_process_transcript(args):
    """Process a transcript file and extract restaurants."""
    service = create_service(args.db)

    print(f"Processing transcript: {args.file}")
    print("-" * 50)

    def progress_callback(step, progress):
        steps = {
            'loading_file': 'Loading file',
            'analyzing_transcript': 'Analyzing with AI',
            'saving_results': 'Saving to database',
            'completed': 'Completed'
        }
        step_name = steps.get(step, step)
        print(f"  [{int(progress * 100):3d}%] {step_name}")

    result = service.process_transcript_file(
        file_path=args.file,
        language=args.language or 'he',
        save_to_db=not args.dry_run,
        progress_callback=progress_callback
    )

    print("-" * 50)

    if result['success']:
        print(f"Success! Found {result['restaurants_found']} restaurants")
        print(f"Episode ID: {result.get('episode_id', 'N/A')}")
        print()

        if result['restaurants']:
            print("Restaurants found:")
            for i, restaurant in enumerate(result['restaurants'], 1):
                name = restaurant.get('name_hebrew', 'Unknown')
                city = restaurant.get('location', {}).get('city', 'Unknown')
                cuisine = restaurant.get('cuisine_type', 'Unknown')
                print(f"  {i}. {name} ({city}) - {cuisine}")

        if result.get('food_trends'):
            print(f"\nFood trends: {', '.join(result['food_trends'])}")

        if result.get('episode_summary'):
            print(f"\nSummary: {result['episode_summary']}")
    else:
        print(f"Failed: {result.get('error', 'Unknown error')}")

    return 0 if result['success'] else 1


def cmd_process_transcripts(args):
    """Process multiple transcript files from a folder."""
    service = create_service(args.db)

    print(f"Processing transcripts from: {args.folder}")
    print(f"Recursive: {args.recursive}")
    print("-" * 50)

    def progress_callback(status, current, total):
        print(f"  Processing file {current}/{total}")

    result = service.process_transcript_folder(
        folder_path=args.folder,
        language=args.language or 'he',
        recursive=args.recursive,
        save_to_db=not args.dry_run,
        progress_callback=progress_callback
    )

    print("-" * 50)

    if result['success']:
        print(f"Processed: {result['files_processed']} files")
        print(f"Failed: {result['files_failed']} files")
        print(f"Total restaurants: {result['total_restaurants']}")
        print()

        if args.verbose and result.get('file_results'):
            print("File details:")
            for file_result in result['file_results']:
                file_name = os.path.basename(file_result['file'])
                if file_result['success']:
                    print(f"  ✓ {file_name}: {file_result['restaurants_found']} restaurants")
                else:
                    print(f"  ✗ {file_name}: {file_result.get('error', 'Unknown error')}")
    else:
        print(f"Failed: {result.get('error', 'Unknown error')}")

    return 0 if result['success'] else 1


def main():
    parser = argparse.ArgumentParser(
        description='Where2Eat Backend CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument('--db', help='Path to database file')

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # process-video command
    p_video = subparsers.add_parser('process-video', help='Process a YouTube video')
    p_video.add_argument('url', help='YouTube video URL')
    p_video.add_argument('--language', '-l', default='he', help='Preferred language (default: he)')
    p_video.add_argument('--dry-run', '-n', action='store_true', help='Do not save to database')
    p_video.set_defaults(func=cmd_process_video)

    # process-transcript command (single file)
    p_transcript = subparsers.add_parser(
        'process-transcript',
        help='Process a transcript file (.txt, .json, .srt, .vtt)'
    )
    p_transcript.add_argument('file', help='Path to transcript file')
    p_transcript.add_argument('--language', '-l', default='he', help='Preferred language (default: he)')
    p_transcript.add_argument('--dry-run', '-n', action='store_true', help='Do not save to database')
    p_transcript.set_defaults(func=cmd_process_transcript)

    # process-transcripts command (folder)
    p_transcripts = subparsers.add_parser(
        'process-transcripts',
        help='Process multiple transcript files from a folder'
    )
    p_transcripts.add_argument('folder', help='Path to folder containing transcript files')
    p_transcripts.add_argument('--language', '-l', default='he', help='Preferred language (default: he)')
    p_transcripts.add_argument('--recursive', '-r', action='store_true', help='Search subdirectories')
    p_transcripts.add_argument('--dry-run', '-n', action='store_true', help='Do not save to database')
    p_transcripts.add_argument('--verbose', '-v', action='store_true', help='Show per-file details')
    p_transcripts.set_defaults(func=cmd_process_transcripts)

    # list-restaurants command
    p_list = subparsers.add_parser('list-restaurants', help='List restaurants')
    p_list.add_argument('--location', help='Filter by city')
    p_list.add_argument('--cuisine', help='Filter by cuisine type')
    p_list.add_argument('--price', help='Filter by price range')
    p_list.add_argument('--opinion', help='Filter by host opinion')
    p_list.add_argument('--limit', type=int, help='Limit number of results')
    p_list.add_argument('--json', action='store_true', help='Output as JSON')
    p_list.set_defaults(func=cmd_list_restaurants)

    # import-json command
    p_import = subparsers.add_parser('import-json', help='Import from JSON files')
    p_import.add_argument('directory', help='Directory containing JSON files')
    p_import.set_defaults(func=cmd_import_json)

    # stats command
    p_stats = subparsers.add_parser('stats', help='Show database statistics')
    p_stats.add_argument('--json', action='store_true', help='Output as JSON')
    p_stats.set_defaults(func=cmd_stats)

    # health command
    p_health = subparsers.add_parser('health', help='Check system health')
    p_health.add_argument('--json', action='store_true', help='Output as JSON')
    p_health.set_defaults(func=cmd_health)

    # search-episodes command
    p_episodes = subparsers.add_parser('search-episodes', help='Search episodes')
    p_episodes.add_argument('--min-restaurants', type=int, help='Minimum restaurants per episode')
    p_episodes.add_argument('--cuisine', help='Filter by cuisine')
    p_episodes.add_argument('--location', help='Filter by location')
    p_episodes.add_argument('--limit', type=int, help='Limit results')
    p_episodes.add_argument('--verbose', '-v', action='store_true', help='Show restaurant details')
    p_episodes.set_defaults(func=cmd_search_episodes)

    # analytics command
    p_analytics = subparsers.add_parser('analytics', help='Show analytics')
    p_analytics.add_argument('type', choices=['timeline', 'trends'], help='Analytics type')
    p_analytics.add_argument('--period', choices=['1month', '3months', '6months', '1year'],
                             help='Time period (for trends)')
    p_analytics.add_argument('--granularity', choices=['day', 'week', 'month'],
                             help='Granularity (for timeline)')
    p_analytics.set_defaults(func=cmd_analytics)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\nCancelled")
        return 130
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())

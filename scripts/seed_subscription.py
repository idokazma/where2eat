#!/usr/bin/env python3
"""
Seed subscription script for Where2Eat pipeline.

Usage:
    # Add a playlist subscription
    python scripts/seed_subscription.py add --url "https://www.youtube.com/playlist?list=PLxxx" --name "My Playlist"

    # Add a channel subscription
    python scripts/seed_subscription.py add --url "https://www.youtube.com/@ChannelName" --name "My Channel"

    # List all subscriptions
    python scripts/seed_subscription.py list

    # Trigger immediate poll for all active subscriptions
    python scripts/seed_subscription.py poll

    # Show pipeline status
    python scripts/seed_subscription.py status

This script is designed to be run:
- Locally against the local database
- On Railway via `railway run python scripts/seed_subscription.py`
- Or via the admin API after Phase 1 is deployed

Environment:
    DATABASE_DIR: Override the data directory (for Railway volumes)
"""

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# Add src to path
src_path = Path(__file__).parent.parent / "src"
if src_path.exists():
    sys.path.insert(0, str(src_path.resolve()))

# Also check Railway path
railway_src = Path("/app/src")
if railway_src.exists():
    sys.path.insert(0, str(railway_src.resolve()))


def get_db():
    """Get database instance."""
    from database import Database

    db_dir = os.getenv("DATABASE_DIR")
    if db_dir:
        db_path = os.path.join(db_dir, "where2eat.db")
    else:
        db_path = str(Path(__file__).parent.parent / "data" / "where2eat.db")

    return Database(db_path)


def normalize_playlist_url(url: str) -> str:
    """Convert a video+list URL to a proper playlist URL.

    Handles:
      youtube.com/watch?v=xxx&list=PLxxx  ->  youtube.com/playlist?list=PLxxx
      youtube.com/playlist?list=PLxxx     ->  youtube.com/playlist?list=PLxxx (unchanged)
    """
    parsed = urlparse(url)
    query = parse_qs(parsed.query)

    list_ids = query.get("list", [])
    if list_ids and "/watch" in parsed.path:
        return f"https://www.youtube.com/playlist?list={list_ids[0]}"

    return url


def cmd_add(args):
    """Add a subscription."""
    from subscription_manager import SubscriptionManager

    db = get_db()
    manager = SubscriptionManager(db)

    url = normalize_playlist_url(args.url)

    try:
        sub = manager.add_subscription(
            source_url=url,
            source_name=args.name,
            priority=args.priority,
            check_interval_hours=args.interval,
        )
        print(f"Subscription added successfully!")
        print(f"  ID:       {sub['id']}")
        print(f"  Type:     {sub['source_type']}")
        print(f"  Source:   {sub['source_id']}")
        print(f"  Name:     {sub['source_name'] or '(none)'}")
        print(f"  Priority: {sub['priority']}")
        print(f"  Interval: {sub['check_interval_hours']}h")
        return sub
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_list(args):
    """List all subscriptions."""
    from subscription_manager import SubscriptionManager

    db = get_db()
    manager = SubscriptionManager(db)
    subs = manager.list_subscriptions(active_only=not args.all)

    if not subs:
        print("No subscriptions found.")
        return

    print(f"{'ID':<38} {'Type':<10} {'Name':<25} {'Active':<8} {'Videos':<8} {'Checked'}")
    print("-" * 120)
    for sub in subs:
        print(
            f"{sub['id']:<38} "
            f"{sub['source_type']:<10} "
            f"{(sub.get('source_name') or sub['source_id'])[:24]:<25} "
            f"{'Yes' if sub['is_active'] else 'No':<8} "
            f"{sub.get('total_videos_found', 0):<8} "
            f"{sub.get('last_checked_at') or 'Never'}"
        )


def cmd_poll(args):
    """Trigger immediate poll for all active subscriptions."""
    from pipeline_scheduler import PipelineScheduler

    db = get_db()
    scheduler = PipelineScheduler(db=db)

    print("Polling all active subscriptions...")
    scheduler.poll_subscriptions()
    print("Poll complete.")

    # Show queue depth
    from video_queue_manager import VideoQueueManager
    queue = VideoQueueManager(db)
    depth = queue.get_queue_depth()
    print(f"Queue depth: {depth} videos awaiting processing")


def cmd_status(args):
    """Show pipeline status."""
    from video_queue_manager import VideoQueueManager
    from subscription_manager import SubscriptionManager

    db = get_db()
    queue = VideoQueueManager(db)
    sub_manager = SubscriptionManager(db)

    subs = sub_manager.list_subscriptions(active_only=False)
    queue_result = queue.get_queue(page=1, limit=5)
    processing = queue.get_processing()

    print("=== Pipeline Status ===")
    print(f"Subscriptions:    {len(subs)} total, {sum(1 for s in subs if s['is_active'])} active")
    print(f"Queue depth:      {queue.get_queue_depth()}")
    print(f"Processing now:   {len(processing)}")
    print()

    if queue_result["items"]:
        print("Next in queue:")
        for item in queue_result["items"][:5]:
            print(f"  - {item['video_id']}: {item.get('video_title', 'untitled')}")


def main():
    parser = argparse.ArgumentParser(
        description="Where2Eat pipeline subscription management"
    )
    subparsers = parser.add_subparsers(dest="command")

    # add command
    add_parser = subparsers.add_parser("add", help="Add a subscription")
    add_parser.add_argument("--url", required=True, help="YouTube channel or playlist URL")
    add_parser.add_argument("--name", default=None, help="Display name for the subscription")
    add_parser.add_argument("--priority", type=int, default=5, help="Priority (1=highest, 10=lowest)")
    add_parser.add_argument("--interval", type=int, default=12, help="Check interval in hours")

    # list command
    list_parser = subparsers.add_parser("list", help="List subscriptions")
    list_parser.add_argument("--all", action="store_true", help="Include inactive subscriptions")

    # poll command
    subparsers.add_parser("poll", help="Trigger immediate poll for all subscriptions")

    # status command
    subparsers.add_parser("status", help="Show pipeline status")

    args = parser.parse_args()

    if args.command == "add":
        cmd_add(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "poll":
        cmd_poll(args)
    elif args.command == "status":
        cmd_status(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

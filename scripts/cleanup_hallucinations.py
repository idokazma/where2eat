#!/usr/bin/env python3
"""
Cleanup Hallucinations Script

Processes existing restaurant data and removes hallucinated entries.
Uses both rule-based and LLM-based verification.

Usage:
    python scripts/cleanup_hallucinations.py --dry-run  # Preview changes
    python scripts/cleanup_hallucinations.py --apply    # Apply changes
    python scripts/cleanup_hallucinations.py --llm      # Use LLM verification
"""

import os
import sys
import json
import shutil
import argparse
import logging
from pathlib import Path
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from hallucination_detector import HallucinationDetector, filter_hallucinations

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_restaurants(data_dir: Path) -> list:
    """Load all restaurant JSON files from directory."""
    restaurants = []

    for json_file in data_dir.glob("*.json"):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                data['_file_path'] = str(json_file)
                data['_file_name'] = json_file.name
                restaurants.append(data)
        except Exception as e:
            logger.warning(f"Could not load {json_file}: {e}")

    logger.info(f"Loaded {len(restaurants)} restaurants from {data_dir}")
    return restaurants


def run_rule_based_detection(restaurants: list) -> tuple:
    """Run rule-based hallucination detection."""
    logger.info("Running rule-based hallucination detection...")

    accepted, rejected, needs_review = filter_hallucinations(
        restaurants,
        strict_mode=True
    )

    return accepted, rejected, needs_review


def run_llm_verification(restaurants: list) -> tuple:
    """Run LLM-based verification for uncertain restaurants."""
    try:
        from restaurant_verifier_agent import RestaurantVerifierAgent
    except ImportError:
        logger.error("Could not import LLM verifier. Make sure ANTHROPIC_API_KEY is set.")
        return restaurants, []

    logger.info(f"Running LLM verification for {len(restaurants)} restaurants...")

    agent = RestaurantVerifierAgent()
    verified = []
    rejected = []

    for i, restaurant in enumerate(restaurants):
        name = restaurant.get('name_hebrew', 'Unknown')
        logger.info(f"[{i+1}/{len(restaurants)}] LLM verifying: {name}")

        try:
            result = agent.verify_restaurant(
                name_hebrew=name,
                name_english=restaurant.get('name_english'),
                city=restaurant.get('location', {}).get('city'),
                context=restaurant.get('host_comments')
            )

            restaurant['_llm_verification'] = {
                'is_real': result.is_real,
                'confidence': result.confidence,
                'reasoning': result.reasoning,
                'evidence': result.evidence
            }

            if result.is_real and result.confidence >= 0.6:
                verified.append(restaurant)
                logger.info(f"  ✅ VERIFIED (confidence: {result.confidence:.2f})")
            else:
                rejected.append(restaurant)
                logger.info(f"  ❌ REJECTED (confidence: {result.confidence:.2f})")

        except Exception as e:
            logger.error(f"  ⚠️ Error verifying {name}: {e}")
            # On error, keep the restaurant but flag it
            restaurant['_llm_verification'] = {'error': str(e)}
            verified.append(restaurant)  # Keep on error

    return verified, rejected


def archive_rejected(rejected: list, archive_dir: Path):
    """Move rejected restaurants to archive directory."""
    archive_dir.mkdir(parents=True, exist_ok=True)

    for restaurant in rejected:
        file_path = Path(restaurant.get('_file_path', ''))
        if file_path.exists():
            # Move to archive
            archive_path = archive_dir / file_path.name
            shutil.move(str(file_path), str(archive_path))
            logger.info(f"Archived: {file_path.name}")

            # Also save rejection reason
            reason_file = archive_dir / f"{file_path.stem}_rejection.json"
            rejection_info = {
                'name_hebrew': restaurant.get('name_hebrew'),
                'name_english': restaurant.get('name_english'),
                'rejection_reason': restaurant.get('_hallucination_check', {}),
                'llm_verification': restaurant.get('_llm_verification', {}),
                'archived_at': datetime.now().isoformat()
            }
            with open(reason_file, 'w', encoding='utf-8') as f:
                json.dump(rejection_info, f, ensure_ascii=False, indent=2)


def update_accepted(accepted: list):
    """Update accepted restaurants with verification metadata."""
    for restaurant in accepted:
        file_path = Path(restaurant.get('_file_path', ''))
        if file_path.exists():
            # Add verification metadata
            restaurant['_verified'] = True
            restaurant['_verified_at'] = datetime.now().isoformat()

            # Remove internal fields before saving
            clean_data = {k: v for k, v in restaurant.items()
                         if not k.startswith('_file')}

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(clean_data, f, ensure_ascii=False, indent=2)

            logger.info(f"Updated: {file_path.name}")


def print_summary(accepted: list, rejected: list, needs_review: list = None):
    """Print summary of cleanup results."""
    print("\n" + "="*70)
    print("CLEANUP SUMMARY")
    print("="*70)

    print(f"\n✅ ACCEPTED ({len(accepted)} restaurants):")
    for r in accepted[:10]:  # Show first 10
        name = r.get('name_hebrew', 'Unknown')
        city = r.get('location', {}).get('city', 'Unknown')
        print(f"   - {name} ({city})")
    if len(accepted) > 10:
        print(f"   ... and {len(accepted) - 10} more")

    print(f"\n❌ REJECTED ({len(rejected)} restaurants):")
    for r in rejected:
        name = r.get('name_hebrew', 'Unknown')
        check = r.get('_hallucination_check', {})
        reasons = check.get('reasons', ['Unknown reason'])
        print(f"   - {name}")
        for reason in reasons[:2]:
            print(f"     • {reason}")

    if needs_review:
        print(f"\n⚠️ NEEDS REVIEW ({len(needs_review)} restaurants):")
        for r in needs_review:
            name = r.get('name_hebrew', 'Unknown')
            check = r.get('_hallucination_check', {})
            confidence = check.get('confidence', 0)
            print(f"   - {name} (confidence: {confidence:.2f})")

    print("\n" + "="*70)


def main():
    parser = argparse.ArgumentParser(description='Clean up hallucinated restaurant entries')
    parser.add_argument('--dry-run', action='store_true',
                        help='Preview changes without applying')
    parser.add_argument('--apply', action='store_true',
                        help='Apply changes (archive rejected, update accepted)')
    parser.add_argument('--llm', action='store_true',
                        help='Use LLM verification for uncertain restaurants')
    parser.add_argument('--llm-all', action='store_true',
                        help='Use LLM verification for ALL restaurants')
    parser.add_argument('--data-dir', type=str, default='data/restaurants_backup',
                        help='Directory containing restaurant JSON files')
    parser.add_argument('--archive-dir', type=str, default='data/restaurants_rejected',
                        help='Directory to archive rejected restaurants')

    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Please specify --dry-run or --apply")
        parser.print_help()
        return

    # Setup paths
    project_root = Path(__file__).parent.parent
    data_dir = project_root / args.data_dir
    archive_dir = project_root / args.archive_dir

    if not data_dir.exists():
        logger.error(f"Data directory not found: {data_dir}")
        return

    # Load restaurants
    restaurants = load_restaurants(data_dir)

    if not restaurants:
        logger.info("No restaurants found to process")
        return

    if args.llm_all:
        # LLM verification for all restaurants
        accepted, rejected = run_llm_verification(restaurants)
        needs_review = []
    else:
        # Run rule-based detection first
        accepted, rejected, needs_review = run_rule_based_detection(restaurants)

        # Optionally run LLM for uncertain cases
        if args.llm and needs_review:
            logger.info(f"\nRunning LLM verification for {len(needs_review)} uncertain restaurants...")
            llm_verified, llm_rejected = run_llm_verification(needs_review)
            accepted.extend(llm_verified)
            rejected.extend(llm_rejected)
            needs_review = []  # All reviewed by LLM

    # Print summary
    print_summary(accepted, rejected, needs_review)

    # Apply changes if requested
    if args.apply:
        logger.info("\nApplying changes...")
        archive_rejected(rejected, archive_dir)
        update_accepted(accepted)
        logger.info(f"\nDone! Archived {len(rejected)} rejected restaurants to {archive_dir}")
    else:
        logger.info("\n[DRY RUN] No changes applied. Use --apply to archive rejected restaurants.")


if __name__ == "__main__":
    main()

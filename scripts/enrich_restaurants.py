#!/usr/bin/env python3
"""
Script to enrich restaurant data with Google Places API information
"""

import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables from .env file
load_dotenv(project_root / '.env')

from src.google_places_enricher import GooglePlacesEnricher

def main():
    """Main enrichment script"""
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    logger = logging.getLogger(__name__)
    
    # Get restaurants directory
    restaurants_dir = project_root / "data" / "restaurants"
    
    if not restaurants_dir.exists():
        logger.error(f"Restaurants directory not found: {restaurants_dir}")
        sys.exit(1)
    
    # Check for API key
    api_key = os.getenv('GOOGLE_PLACES_API_KEY')
    if not api_key:
        logger.error("Google Places API key not found!")
        logger.info("To get an API key:")
        logger.info("1. Go to https://console.cloud.google.com/")
        logger.info("2. Enable Google Places API")
        logger.info("3. Create credentials (API key)")
        logger.info("4. Set environment variable: export GOOGLE_PLACES_API_KEY='your-key-here'")
        sys.exit(1)
    
    try:
        # Initialize enricher
        logger.info("🚀 Starting restaurant data enrichment with Google Places API")
        enricher = GooglePlacesEnricher(api_key)
        
        # Enrich all restaurants
        stats = enricher.enrich_all_restaurants(str(restaurants_dir))
        
        # Print summary
        logger.info("=" * 60)
        logger.info("🎯 ENRICHMENT SUMMARY")
        logger.info("=" * 60)
        logger.info(f"📁 Total files processed: {stats['total_files']}")
        logger.info(f"✅ Successfully enriched: {stats['enriched']}")
        logger.info(f"⏭️  Already enriched (skipped): {stats['skipped']}")
        logger.info(f"❌ Failed to enrich: {stats['failed']}")
        
        if stats['enriched'] > 0:
            logger.info("\n🗺️  Enriched restaurants now include:")
            logger.info("   • Google Place ID")
            logger.info("   • Exact coordinates (lat/lng)")
            logger.info("   • Full address")
            logger.info("   • Google ratings & reviews")
            logger.info("   • Photos")
            logger.info("   • Phone numbers")
            logger.info("   • Website URLs")
            logger.info("   • Business hours")
            logger.info("\n🎯 Ready for Google Maps integration!")
        
    except Exception as e:
        logger.error(f"Enrichment failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Final cleanup - keep only the clearly valid core restaurants
"""

import os
import json
import shutil
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Keep only the core valid restaurants"""
    
    project_root = Path(__file__).parent.parent
    restaurants_dir = project_root / "data" / "restaurants"
    
    # Core restaurants that we definitely want to keep (from the original 11)
    core_valid_restaurants = {
        'מרי פוסה': 'Mari Posa',           # Thai in Caesarea
        'מיז\'נה': 'Mijena',               # Modern Arab 
        'אלקבר': 'Al-Kaber',              # American food truck
        'צ\'קולי': 'Chakoli',             # Spanish Mediterranean Tel Aviv
        'הסתקיה': 'Hastakia',             # Modern Israeli Jerusalem
        'גורמי סבזי': 'Gourmet Sabzi',     # Persian Levinsky Market
        'סטודיו גורשה': 'Studio Gorosha',  # Fine dining Tel Aviv
        'פרינו': 'Prino',                 # Neapolitan pizzeria Ashdod
        'צפרירים': 'Tsfrirím',            # Traditional bistro Haifa
        'הלנסן': 'Hallansan',             # Italian Tel Aviv
        'מושיק': 'Moshik'                 # Gourmet Tel Aviv
    }
    
    # Get all current files
    restaurant_files = list(restaurants_dir.glob("*.json"))
    files_to_keep = []
    files_to_remove = []
    
    logger.info(f"🔍 Final cleanup of {len(restaurant_files)} restaurants...")
    
    for file_path in restaurant_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                restaurant_data = json.load(f)
            
            name_hebrew = restaurant_data.get('name_hebrew', '').strip()
            name_english = restaurant_data.get('name_english', '').strip()
            google_name = restaurant_data.get('google_places', {}).get('google_name', '').strip()
            rating = restaurant_data.get('rating', {}).get('google_rating', 0)
            
            # Check if this matches any core restaurant
            is_core = False
            for core_hebrew, core_english in core_valid_restaurants.items():
                if (core_hebrew in name_hebrew or 
                    core_english.lower() in name_english.lower() or
                    core_hebrew in google_name or 
                    core_english.lower() in google_name.lower()):
                    is_core = True
                    break
            
            if is_core:
                files_to_keep.append({
                    'file': file_path,
                    'hebrew': name_hebrew,
                    'english': name_english,
                    'google': google_name,
                    'rating': rating
                })
                logger.info(f"✅ KEEP: {name_hebrew} ({name_english}) - {rating}★")
            else:
                files_to_remove.append({
                    'file': file_path,
                    'hebrew': name_hebrew,
                    'english': name_english,
                    'reason': 'Not in core restaurant list'
                })
                logger.warning(f"❌ REMOVE: {name_hebrew} ({name_english}) - Not core restaurant")
                
        except Exception as e:
            logger.error(f"Error processing {file_path.name}: {e}")
            files_to_remove.append({'file': file_path, 'hebrew': 'ERROR', 'reason': f"Error: {e}"})
    
    # Remove non-core restaurants
    logger.info(f"\n🗑️  Removing {len(files_to_remove)} non-core restaurants...")
    for item in files_to_remove:
        if item['file'].exists():
            item['file'].unlink()
            logger.info(f"   Deleted: {item['file'].name}")
    
    # Summary
    logger.info(f"\n📊 FINAL CLEANUP SUMMARY:")
    logger.info(f"   Core restaurants kept: {len(files_to_keep)}")
    logger.info(f"   Non-core restaurants removed: {len(files_to_remove)}")
    
    logger.info(f"\n🍽️  FINAL VALID RESTAURANTS:")
    for restaurant in files_to_keep:
        logger.info(f"   • {restaurant['hebrew']} ({restaurant['english']}) - {restaurant['rating']}★")
    
    logger.info(f"\n✅ Restaurant data is now clean and ready for Google Maps integration! 🗺️")

if __name__ == "__main__":
    main()
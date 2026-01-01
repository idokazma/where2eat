#!/usr/bin/env python3
"""
Clean restaurant data by removing restaurants with invalid Google Places matches
Keeps only restaurants that are real establishments with proper matches
"""

import os
import json
import shutil
from pathlib import Path
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def is_valid_restaurant_match(restaurant_data, filename):
    """
    Determine if a restaurant has a valid Google Places match
    
    Args:
        restaurant_data: Restaurant JSON data
        filename: Original filename
    
    Returns:
        tuple: (is_valid, reason)
    """
    name_hebrew = restaurant_data.get('name_hebrew', '').strip()
    name_english = restaurant_data.get('name_english', '').strip()
    google_name = restaurant_data.get('google_places', {}).get('google_name', '').strip()
    google_rating = restaurant_data.get('rating', {}).get('google_rating')
    
    # Core valid restaurants from our original analysis
    core_restaurants = {
        'מרי פוסה', 'Mari Posa', 'Mariposa',
        'מיז\'נה', 'Mijena', 'מיג\'אנה',
        'אלקבר', 'Al-Kaber', 'ELKA BAR',
        'צ\'קולי', 'Chakoli', 'Chacoli',
        'הסתקיה', 'Hastakia',
        'גורמי סבזי', 'Gourmet Sabzi',
        'סטודיו גורשה', 'Studio Gorosha',
        'פרינו', 'Prino',
        'צפרירים', 'Tsfrirím',
        'הלנסן', 'Hallansan',
        'מושיק', 'Moshik', '&Moshik'
    }
    
    # Check if this matches any of our core restaurants
    if any(core_name.lower() in name_hebrew.lower() or 
           core_name.lower() in name_english.lower() or
           core_name.lower() in google_name.lower() 
           for core_name in core_restaurants):
        return True, "Core restaurant match"
    
    # Invalid patterns - these are not real restaurant names
    invalid_patterns = [
        # Generic Hebrew words
        'השנה', 'ולא', 'בדיוק', 'שף', 'כלל', 'שוק', 'חיפה', 'תור',
        'קיסריה', 'רים', 'וזה', 'דיוק', 'יאן', 'ארוש', 'החצי',
        'מקומון', 'מזכיר', 'השוארמות', 'ספרירים', 'בחיפה', 'ביסטרו',
        # Generic English translations
        'The Year', 'And Not', 'Exactly', 'Chef', 'Generally', 'Market',
        'Haifa', 'Queue', 'Caesarea', 'Rim', 'And This', 'Accuracy',
        'Ian', 'Arush', 'Half', 'Local', 'Reminds', 'Shawarma',
        # Pattern-based false positives
        'Hshnh', 'Vla', 'Bdyvk', 'Shף', 'Kll', 'Shvk', 'Kysryh',
        'Hshvarmvt', 'Spryryם', 'Hyph', 'Tvr', 'Yaן', 'Dyvk',
        'Mkvmvן', 'Atzם', 'Hyyth', 'Lך'
    ]
    
    # Check if name contains invalid patterns
    for pattern in invalid_patterns:
        if (pattern.lower() in name_hebrew.lower() or 
            pattern.lower() in name_english.lower()):
            return False, f"Invalid pattern detected: {pattern}"
    
    # Check if Google match seems inappropriate
    if google_name:
        # Generic business names that aren't restaurants
        generic_google_names = [
            'HIBA Restaurant',  # This was matched to a wrong Hebrew phrase
            'Tel Aviv',
            'Haifa',
            'Jerusalem',
        ]
        
        for generic in generic_google_names:
            if generic.lower() in google_name.lower() and len(name_hebrew) < 10:
                return False, f"Generic Google match: {google_name}"
    
    # If it has a good Google rating and reasonable name, probably valid
    if google_rating and google_rating >= 3.0 and len(name_hebrew) >= 3:
        return True, f"Valid Google match: {google_name} ({google_rating}★)"
    
    # Default to invalid if no clear indicators
    return False, "No clear validation indicators"

def clean_restaurant_data(restaurants_dir):
    """
    Clean restaurant data by removing invalid matches
    """
    restaurants_path = Path(restaurants_dir)
    backup_dir = restaurants_path.parent / "restaurants_backup"
    
    # Create backup
    if backup_dir.exists():
        shutil.rmtree(backup_dir)
    shutil.copytree(restaurants_path, backup_dir)
    logger.info(f"📁 Created backup at: {backup_dir}")
    
    # Analyze all restaurants
    restaurant_files = list(restaurants_path.glob("*.json"))
    valid_restaurants = []
    invalid_restaurants = []
    
    logger.info(f"🔍 Analyzing {len(restaurant_files)} restaurant files...")
    
    for file_path in restaurant_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                restaurant_data = json.load(f)
            
            is_valid, reason = is_valid_restaurant_match(restaurant_data, file_path.name)
            
            restaurant_info = {
                'file': file_path.name,
                'hebrew_name': restaurant_data.get('name_hebrew', ''),
                'english_name': restaurant_data.get('name_english', ''),
                'google_name': restaurant_data.get('google_places', {}).get('google_name', ''),
                'rating': restaurant_data.get('rating', {}).get('google_rating'),
                'reason': reason
            }
            
            if is_valid:
                valid_restaurants.append(restaurant_info)
                logger.info(f"✅ KEEP: {restaurant_info['hebrew_name']} ({restaurant_info['english_name']}) - {reason}")
            else:
                invalid_restaurants.append(restaurant_info)
                logger.warning(f"❌ REMOVE: {restaurant_info['hebrew_name']} ({restaurant_info['english_name']}) - {reason}")
                
        except Exception as e:
            logger.error(f"Error processing {file_path.name}: {e}")
            invalid_restaurants.append({
                'file': file_path.name,
                'hebrew_name': 'ERROR',
                'english_name': 'ERROR',
                'reason': f"Processing error: {e}"
            })
    
    # Remove invalid restaurants
    logger.info(f"\n🗑️  Removing {len(invalid_restaurants)} invalid restaurant files...")
    for restaurant in invalid_restaurants:
        file_path = restaurants_path / restaurant['file']
        if file_path.exists():
            file_path.unlink()
            logger.info(f"   Deleted: {restaurant['file']}")
    
    # Summary
    logger.info(f"\n📊 CLEANUP SUMMARY:")
    logger.info(f"   Total files processed: {len(restaurant_files)}")
    logger.info(f"   Valid restaurants kept: {len(valid_restaurants)}")
    logger.info(f"   Invalid restaurants removed: {len(invalid_restaurants)}")
    logger.info(f"   Backup created at: {backup_dir}")
    
    # List valid restaurants
    logger.info(f"\n🍽️  VALID RESTAURANTS REMAINING:")
    for restaurant in valid_restaurants:
        rating_text = f"({restaurant['rating']}★)" if restaurant['rating'] else ""
        logger.info(f"   • {restaurant['hebrew_name']} ({restaurant['english_name']}) {rating_text}")
    
    return len(valid_restaurants), len(invalid_restaurants)

def main():
    """Main cleanup function"""
    project_root = Path(__file__).parent.parent
    restaurants_dir = project_root / "data" / "restaurants"
    
    if not restaurants_dir.exists():
        logger.error(f"Restaurants directory not found: {restaurants_dir}")
        return
    
    logger.info("🧹 Starting restaurant data cleanup...")
    valid_count, removed_count = clean_restaurant_data(restaurants_dir)
    
    logger.info(f"\n✅ Cleanup complete!")
    logger.info(f"   Kept {valid_count} valid restaurants")
    logger.info(f"   Removed {removed_count} invalid entries")
    logger.info(f"   Ready for clean Google Maps integration! 🗺️")

if __name__ == "__main__":
    main()
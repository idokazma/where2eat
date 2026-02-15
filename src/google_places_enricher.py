"""
Google Places API integration for enriching restaurant data
Fetches complete restaurant details including addresses, coordinates, ratings, and photos
"""

import os
import json
import time
import logging
from typing import Dict, List, Optional, Tuple
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class GooglePlacesEnricher:
    """Enriches restaurant data using Google Places API (New API with legacy fallback)"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize with Google Places API key

        Args:
            api_key: Google Places API key. If None, will try to get from environment
        """
        self.api_key = api_key or os.getenv('GOOGLE_PLACES_API_KEY')
        if not self.api_key:
            raise ValueError("Google Places API key required. Set GOOGLE_PLACES_API_KEY environment variable.")

        self.base_url = "https://maps.googleapis.com/maps/api/place"
        self.new_api_base_url = "https://places.googleapis.com/v1"
        self.logger = logging.getLogger(__name__)

        # Set up logging
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)

    def enrich_restaurant(self, restaurant_data: Dict) -> Dict:
        """
        Enrich a single restaurant with Google Places data
        
        Args:
            restaurant_data: Original restaurant data dict
            
        Returns:
            Enhanced restaurant data with Google Places information
        """
        restaurant_name = restaurant_data.get('name_english', '')
        hebrew_name = restaurant_data.get('name_hebrew', '')
        city = restaurant_data.get('location', {}).get('city', '')
        
        self.logger.info(f"🔍 Enriching restaurant: {restaurant_name} ({hebrew_name}) in {city}")
        
        # Try multiple search strategies
        place_details = None
        
        # Strategy 1: English name + city
        if restaurant_name and city:
            place_details = self._search_restaurant(f"{restaurant_name} {city}")
        
        # Strategy 2: Hebrew name + city  
        if not place_details and hebrew_name and city:
            place_details = self._search_restaurant(f"{hebrew_name} {city}")
            
        # Strategy 3: English name + "restaurant" + city
        if not place_details and restaurant_name and city:
            place_details = self._search_restaurant(f"{restaurant_name} restaurant {city}")
        
        # Strategy 4: Just the name (broader search)
        if not place_details and restaurant_name:
            place_details = self._search_restaurant(restaurant_name)
            
        if place_details:
            # Merge Google Places data with existing data
            enhanced_data = self._merge_google_data(restaurant_data, place_details)
            self.logger.info(f"✅ Successfully enriched {restaurant_name}")
            return enhanced_data
        else:
            self.logger.warning(f"❌ Could not find Google Places data for {restaurant_name}")
            # Return original data with enrichment attempt flag
            restaurant_data['google_places_enriched'] = False
            restaurant_data['google_places_attempted'] = True
            return restaurant_data

    def _search_restaurant(self, query: str) -> Optional[Dict]:
        """
        Search for restaurant using Google Places API.
        Tries the new Places API first, falls back to legacy on error.

        Args:
            query: Search query string

        Returns:
            Place details if found, None otherwise
        """
        # Try new API first
        result = self._search_restaurant_new_api(query)
        if result is not None:
            return result

        # Fall back to legacy API
        self.logger.debug("New Places API returned no result, falling back to legacy API")
        return self._search_restaurant_legacy(query)

    def _search_restaurant_new_api(self, query: str) -> Optional[Dict]:
        """
        Search for restaurant using the new Google Places API (places.googleapis.com).

        Args:
            query: Search query string

        Returns:
            Place details in legacy-compatible format if found, None otherwise
        """
        try:
            # Step 1: Text Search
            search_url = f"{self.new_api_base_url}/places:searchText"
            headers = {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': self.api_key,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.regularOpeningHours,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri'
            }
            body = {
                'textQuery': query,
                'includedType': 'restaurant',
                'languageCode': 'he'
            }

            self.logger.debug(f"🔎 Searching new Places API for: {query}")

            response = requests.post(search_url, headers=headers, json=body)
            response.raise_for_status()

            search_data = response.json()
            places = search_data.get('places', [])

            if not places:
                self.logger.debug(f"No results from new API for query: {query}")
                return None

            place = places[0]
            place_id = place.get('id')
            if not place_id:
                return None

            # Step 2: Get detailed place information
            time.sleep(0.1)

            details_url = f"{self.new_api_base_url}/places/{place_id}"
            details_headers = {
                'X-Goog-Api-Key': self.api_key,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,userRatingCount,priceLevel,photos,regularOpeningHours,internationalPhoneNumber,websiteUri,googleMapsUri'
            }

            details_response = requests.get(details_url, headers=details_headers)
            details_response.raise_for_status()

            details_data = details_response.json()
            return self._map_new_api_response(details_data)

        except requests.RequestException as e:
            self.logger.warning(f"New Places API error: {str(e)}")
            return None
        except Exception as e:
            self.logger.warning(f"Unexpected error in new Places API search: {str(e)}")
            return None

    def _map_new_api_response(self, data: Dict) -> Dict:
        """
        Convert new Places API response format to legacy-compatible format.

        Args:
            data: New API response dict

        Returns:
            Dict in the same shape as legacy Place Details result
        """
        result = {
            'place_id': data.get('id'),
            'name': data.get('displayName', {}).get('text', ''),
            'formatted_address': data.get('formattedAddress'),
            'url': data.get('googleMapsUri'),
        }

        # Geometry / location
        location = data.get('location')
        if location:
            result['geometry'] = {
                'location': {
                    'lat': location.get('latitude'),
                    'lng': location.get('longitude')
                }
            }

        # Rating
        if data.get('rating') is not None:
            result['rating'] = data['rating']
        if data.get('userRatingCount') is not None:
            result['user_ratings_total'] = data['userRatingCount']

        # Price level - new API uses enum strings like PRICE_LEVEL_MODERATE
        price_level_map = {
            'PRICE_LEVEL_FREE': 0,
            'PRICE_LEVEL_INEXPENSIVE': 1,
            'PRICE_LEVEL_MODERATE': 2,
            'PRICE_LEVEL_EXPENSIVE': 3,
            'PRICE_LEVEL_VERY_EXPENSIVE': 4,
        }
        price_str = data.get('priceLevel')
        if price_str and isinstance(price_str, str):
            result['price_level'] = price_level_map.get(price_str)
        elif isinstance(price_str, (int, float)):
            result['price_level'] = int(price_str)

        # Phone
        if data.get('internationalPhoneNumber'):
            result['formatted_phone_number'] = data['internationalPhoneNumber']

        # Website
        if data.get('websiteUri'):
            result['website'] = data['websiteUri']

        # Photos - new API uses `name` field instead of `photo_reference`
        new_photos = data.get('photos', [])
        if new_photos:
            result['photos'] = []
            for photo in new_photos:
                photo_name = photo.get('name', '')
                if photo_name:
                    result['photos'].append({
                        'photo_reference': photo_name,
                        'width': photo.get('widthPx', 0),
                        'height': photo.get('heightPx', 0),
                        '_new_api': True,
                    })

        # Opening hours
        hours = data.get('regularOpeningHours')
        if hours:
            result['opening_hours'] = {
                'open_now': hours.get('openNow'),
                'weekday_text': hours.get('weekdayDescriptions', [])
            }

        return result

    def _search_restaurant_legacy(self, query: str) -> Optional[Dict]:
        """
        Search for restaurant using the legacy Google Places Text Search API.

        Args:
            query: Search query string

        Returns:
            Place details if found, None otherwise
        """
        try:
            # Step 1: Text Search to find place_id
            search_url = f"{self.base_url}/textsearch/json"
            search_params = {
                'query': query,
                'type': 'restaurant',
                'key': self.api_key
            }

            self.logger.debug(f"🔎 Searching legacy Google Places for: {query}")

            response = requests.get(search_url, params=search_params)
            response.raise_for_status()

            search_data = response.json()

            if search_data.get('status') != 'OK' or not search_data.get('results'):
                self.logger.debug(f"No results for query: {query}")
                return None

            # Get the first (most relevant) result
            place = search_data['results'][0]
            place_id = place.get('place_id')

            if not place_id:
                return None

            # Step 2: Get detailed place information
            details_url = f"{self.base_url}/details/json"
            details_params = {
                'place_id': place_id,
                'fields': 'place_id,name,formatted_address,geometry,rating,user_ratings_total,price_level,photos,opening_hours,formatted_phone_number,website,url',
                'key': self.api_key
            }

            # Rate limiting - be respectful to Google's API
            time.sleep(0.1)

            details_response = requests.get(details_url, params=details_params)
            details_response.raise_for_status()

            details_data = details_response.json()

            if details_data.get('status') == 'OK':
                return details_data['result']
            else:
                self.logger.warning(f"Google Places Details API error: {details_data.get('status')}")
                return None

        except requests.RequestException as e:
            self.logger.error(f"Error calling legacy Google Places API: {str(e)}")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error in legacy restaurant search: {str(e)}")
            return None

    def _merge_google_data(self, original_data: Dict, google_data: Dict) -> Dict:
        """
        Merge Google Places data with original restaurant data
        
        Args:
            original_data: Original restaurant data
            google_data: Google Places API response data
            
        Returns:
            Merged restaurant data
        """
        enhanced_data = original_data.copy()
        
        # Add Google Places specific data
        google_name = google_data.get('name', '')
        original_hebrew = original_data.get('name_hebrew', '')
        original_english = original_data.get('name_english', '')

        similarity_en = self._name_similarity_score(original_english, google_name)
        similarity_he = self._name_similarity_score(original_hebrew, google_name)
        best_similarity = max(similarity_en, similarity_he)

        enhanced_data['google_places'] = {
            'place_id': google_data.get('place_id'),
            'google_name': google_name,
            'google_url': google_data.get('url'),
            'enriched_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'name_match_confidence': round(best_similarity, 2),
            'potential_wrong_match': best_similarity < 0.15,
        }
        
        # Enhance location data
        if 'geometry' in google_data and 'location' in google_data['geometry']:
            location = google_data['geometry']['location']
            enhanced_data['location']['coordinates'] = {
                'latitude': location.get('lat'),
                'longitude': location.get('lng')
            }
        
        # Add full address if available
        if google_data.get('formatted_address'):
            enhanced_data['location']['full_address'] = google_data['formatted_address']
        
        # Add rating information
        if google_data.get('rating'):
            enhanced_data['rating'] = {
                'google_rating': google_data.get('rating'),
                'total_reviews': google_data.get('user_ratings_total', 0),
                'price_level': google_data.get('price_level')  # 0-4 scale
            }
        
        # Add contact information
        if google_data.get('formatted_phone_number'):
            enhanced_data['contact_info']['phone'] = google_data['formatted_phone_number']
            
        if google_data.get('website'):
            enhanced_data['contact_info']['website'] = google_data['website']
        
        # Add photos (supports both legacy photo_reference and new API name format)
        if google_data.get('photos'):
            enhanced_data['photos'] = []
            for photo in google_data['photos'][:3]:  # Limit to 3 photos
                photo_reference = photo.get('photo_reference')
                is_new_api = photo.get('_new_api', False)
                if photo_reference:
                    photo_entry = {
                        'photo_reference': photo_reference,
                        'width': photo.get('width'),
                        'height': photo.get('height')
                    }
                    if is_new_api:
                        photo_entry['_new_api'] = True
                    enhanced_data['photos'].append(photo_entry)
                    # Set image_url to first reference for database storage
                    if not enhanced_data.get('image_url') and photo_reference:
                        enhanced_data['image_url'] = photo_reference
        
        # Add opening hours
        if google_data.get('opening_hours'):
            enhanced_data['business_hours'] = {
                'open_now': google_data['opening_hours'].get('open_now'),
                'weekday_text': google_data['opening_hours'].get('weekday_text', [])
            }
        
        # Mark as successfully enriched
        enhanced_data['google_places_enriched'] = True
        enhanced_data['google_places_attempted'] = True
        
        return enhanced_data

    @staticmethod
    def _name_similarity_score(name1: str, name2: str) -> float:
        """Calculate simple similarity between two restaurant names.

        Uses character overlap ratio. Returns 0.0-1.0.
        Works with same-script names; cross-script (Hebrew vs English) returns low scores by design.
        """
        if not name1 or not name2:
            return 0.0

        n1 = name1.lower().strip()
        n2 = name2.lower().strip()

        # Direct containment check
        if n1 in n2 or n2 in n1:
            return 0.8

        # Character set overlap (Jaccard similarity)
        set1 = set(n1.replace(' ', ''))
        set2 = set(n2.replace(' ', ''))

        if not set1 or not set2:
            return 0.0

        intersection = set1 & set2
        union = set1 | set2
        return len(intersection) / len(union)

    def enrich_restaurant_file(self, file_path: str, output_path: Optional[str] = None) -> str:
        """
        Enrich a restaurant JSON file with Google Places data
        
        Args:
            file_path: Path to restaurant JSON file
            output_path: Output path (if None, overwrites original)
            
        Returns:
            Path to enriched file
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                restaurant_data = json.load(f)
            
            # Skip if already enriched
            if restaurant_data.get('google_places_enriched'):
                self.logger.info(f"⏭️  Skipping {file_path} - already enriched")
                return file_path
            
            enriched_data = self.enrich_restaurant(restaurant_data)
            
            # Save enriched data
            save_path = output_path or file_path
            with open(save_path, 'w', encoding='utf-8') as f:
                json.dump(enriched_data, f, ensure_ascii=False, indent=2)
            
            return save_path
            
        except Exception as e:
            self.logger.error(f"Error enriching file {file_path}: {str(e)}")
            raise

    def enrich_all_restaurants(self, restaurants_dir: str) -> Dict[str, int]:
        """
        Enrich all restaurant files in a directory
        
        Args:
            restaurants_dir: Directory containing restaurant JSON files
            
        Returns:
            Dictionary with enrichment statistics
        """
        import glob
        
        restaurant_files = glob.glob(os.path.join(restaurants_dir, "*.json"))
        
        stats = {
            'total_files': len(restaurant_files),
            'enriched': 0,
            'skipped': 0,
            'failed': 0
        }
        
        self.logger.info(f"🚀 Starting enrichment of {stats['total_files']} restaurant files")
        
        for file_path in restaurant_files:
            try:
                filename = os.path.basename(file_path)
                self.logger.info(f"Processing {filename}...")
                
                # Load and check if already enriched
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if data.get('google_places_enriched'):
                    stats['skipped'] += 1
                    self.logger.info(f"⏭️  Skipping {filename} - already enriched")
                    continue
                
                # Enrich the restaurant
                self.enrich_restaurant_file(file_path)
                stats['enriched'] += 1
                
                # Rate limiting between requests
                time.sleep(0.2)
                
            except Exception as e:
                stats['failed'] += 1
                self.logger.error(f"❌ Failed to enrich {filename}: {str(e)}")
        
        self.logger.info(f"✅ Enrichment complete! Enriched: {stats['enriched']}, Skipped: {stats['skipped']}, Failed: {stats['failed']}")
        return stats

def main():
    """Example usage"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python google_places_enricher.py <restaurants_directory>")
        print("Set GOOGLE_PLACES_API_KEY environment variable first")
        sys.exit(1)
    
    restaurants_dir = sys.argv[1]
    
    try:
        enricher = GooglePlacesEnricher()
        stats = enricher.enrich_all_restaurants(restaurants_dir)
        print(f"Enrichment completed: {stats}")
    except ValueError as e:
        print(f"Error: {e}")
        print("Please set GOOGLE_PLACES_API_KEY environment variable")
        sys.exit(1)

if __name__ == "__main__":
    main()
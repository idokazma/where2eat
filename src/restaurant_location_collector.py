"""
Restaurant Location Collector
Collects precise location data, coordinates, and Google Business information for restaurants.
Prepares data for map integration and Google Business cards.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class RestaurantLocation:
    """Data structure for restaurant location and Google Business information"""
    restaurant_name: str
    hebrew_name: Optional[str] = None
    
    # Address information
    street_address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "Israel"
    full_address: Optional[str] = None
    
    # Coordinates for map plotting
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Google Business information
    google_place_id: Optional[str] = None
    google_business_url: Optional[str] = None
    google_maps_url: Optional[str] = None
    google_rating: Optional[float] = None
    google_review_count: Optional[int] = None
    google_phone: Optional[str] = None
    google_website: Optional[str] = None
    google_hours: Optional[Dict] = None
    
    # Additional location details
    neighborhood: Optional[str] = None
    landmarks_nearby: List[str] = field(default_factory=list)
    parking_info: Optional[str] = None
    public_transport: Optional[str] = None
    
    # Metadata
    search_timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    data_sources: List[str] = field(default_factory=list)


class RestaurantLocationCollector:
    """Agent to collect precise restaurant location data and Google Business information"""
    
    def __init__(self, output_dir: str = "restaurant_locations"):
        """Initialize the location collector
        
        Args:
            output_dir: Directory to save location search requests and results
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        (self.output_dir / "search_requests").mkdir(exist_ok=True)
        (self.output_dir / "results").mkdir(exist_ok=True)
        (self.output_dir / "map_data").mkdir(exist_ok=True)
        
        self.logger = self._setup_logger()
        self.logger.info(f"RestaurantLocationCollector initialized with output_dir: {self.output_dir}")
    
    def _setup_logger(self) -> logging.Logger:
        """Set up logging for the collector"""
        logger = logging.getLogger(self.__class__.__name__)
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def collect_restaurant_location(
        self, 
        restaurant_name: str, 
        city: Optional[str] = None,
        hebrew_name: Optional[str] = None,
        approximate_location: Optional[str] = None
    ) -> RestaurantLocation:
        """Collect comprehensive location data for a restaurant
        
        Args:
            restaurant_name: Name of the restaurant
            city: City where the restaurant is located
            hebrew_name: Hebrew name if applicable
            approximate_location: Any known approximate location info
            
        Returns:
            RestaurantLocation object with search request prepared
        """
        self.logger.info(f"🗺️ Collecting location data for: {restaurant_name}")
        if city:
            self.logger.info(f"📍 City: {city}")
        if hebrew_name:
            self.logger.info(f"🔤 Hebrew name: {hebrew_name}")
        if approximate_location:
            self.logger.info(f"📌 Approximate location: {approximate_location}")
        
        # Create comprehensive location search request
        search_request = self._create_location_search_request(
            restaurant_name, city, hebrew_name, approximate_location
        )
        
        # Save the search request
        request_file = self._save_search_request(restaurant_name, search_request)
        self.logger.info(f"✅ Location search request saved: {request_file}")
        
        # Create result structure (to be filled by agent execution)
        result = RestaurantLocation(
            restaurant_name=restaurant_name,
            hebrew_name=hebrew_name,
            city=city
        )
        
        print(f"\n🤖 Location search request prepared for: {restaurant_name}")
        print(f"📁 Request file: {request_file}")
        print("💡 Use Claude Code's Task agent with 'general-purpose' subagent_type")
        print("🗺️ The agent will find precise coordinates, Google Business info, and address details")
        
        return result
    
    def _create_location_search_request(
        self, 
        restaurant_name: str, 
        city: Optional[str] = None,
        hebrew_name: Optional[str] = None,
        approximate_location: Optional[str] = None
    ) -> str:
        """Create comprehensive location search request for the agent"""
        
        location_context = f" in {city}" if city else ""
        hebrew_context = f" ({hebrew_name})" if hebrew_name else ""
        approx_context = f"\nApproximate location hint: {approximate_location}" if approximate_location else ""
        
        search_request = f"""
TASK: Find precise location data and Google Business information for "{restaurant_name}"{location_context}{hebrew_context}

RESTAURANT DETAILS:
- Name: {restaurant_name}
- City: {city or "Not specified - please determine from search"}
- Hebrew Name: {hebrew_name or "Not specified"}
- Country: Israel{approx_context}

LOCATION DATA TO COLLECT:

1. **PRECISE ADDRESS INFORMATION**
   Search for:
   - Complete street address with building number
   - City/municipality name
   - Postal/ZIP code
   - Neighborhood or district name
   
   Sources to check:
   - Google Maps/Google My Business
   - Restaurant's official website
   - Israeli Yellow Pages (דפי זהב)
   - Waze location data
   - Social media location tags

2. **COORDINATES FOR MAP INTEGRATION**
   Find exact:
   - Latitude (decimal degrees)
   - Longitude (decimal degrees)
   
   Verification: Coordinates should be in Israel (approximately 29°-33°N, 34°-36°E)

3. **GOOGLE BUSINESS INFORMATION**
   If the restaurant has a Google Business listing, collect:
   - Google Place ID (unique identifier)
   - Google Business profile URL
   - Google Maps shareable link
   - Average Google rating (out of 5 stars)
   - Number of Google reviews
   - Business phone number from Google
   - Website URL from Google listing
   - Business hours (opening/closing times for each day)
   - Business category/type from Google
   
4. **ADDITIONAL LOCATION CONTEXT**
   Research and include:
   - Neighborhood or area name
   - Nearby landmarks (shopping centers, hotels, major streets)
   - Parking availability and options
   - Public transportation access (bus stops, train stations)
   - Walking directions from major landmarks if available

SEARCH STRATEGY:

1. **Primary Search Queries:**
   - "{restaurant_name}" address{location_context} Israel
   - "{restaurant_name}"{hebrew_context} Google Maps
   - "{hebrew_name}" מיקום כתובת (if Hebrew name provided)
   - "{restaurant_name}" location coordinates{location_context}

2. **Google Business Search:**
   - Search specifically in Google Maps for the restaurant
   - Look for the official business listing
   - Extract all available business information
   - Verify it's the correct location by cross-referencing details

3. **Address Verification:**
   - Cross-check address information from multiple sources
   - Verify coordinates match the address
   - Ensure all information is current and accurate

4. **Hebrew Language Considerations:**
   - If Hebrew name provided, search using Hebrew terms
   - Check Hebrew business directories
   - Look for Hebrew social media location tags
   - Israeli restaurant review sites

ISRAELI LOCATION CONTEXT:
- Major cities: Tel Aviv, Jerusalem, Haifa, Beer Sheva, Eilat, Netanya, etc.
- Common areas: Tel Aviv areas (Rothschild, Dizengoff, Jaffa, etc.)
- Jerusalem areas (German Colony, Mahane Yehuda, etc.)
- Coastal cities: Herzliya, Caesarea, Netanya, Haifa
- Format addresses in Israeli style: Street Number, Street Name, City, Postal Code

OUTPUT FORMAT:

Please structure your findings as follows:

**RESTAURANT IDENTIFICATION:**
- Name: [Restaurant name]
- Hebrew Name: [Hebrew name if found]
- Verified Location: [City, Israel]

**PRECISE ADDRESS:**
- Street Address: [Number Street Name]
- City: [City name]
- Postal Code: [Postal code if available]
- Neighborhood: [Area/neighborhood name]
- Full Address: [Complete formatted address]

**COORDINATES:**
- Latitude: [Decimal degrees]
- Longitude: [Decimal degrees]
- Coordinate Source: [Where coordinates were obtained]

**GOOGLE BUSINESS INFORMATION:**
- Google Place ID: [Unique Place ID]
- Google Business URL: [Direct link to Google Business listing]
- Google Maps URL: [Shareable Google Maps link]
- Google Rating: [X.X out of 5 stars]
- Google Review Count: [Number of reviews]
- Business Phone: [Phone number from Google]
- Business Website: [Website from Google listing]
- Business Hours: [Operating hours for each day]
- Business Category: [Google's business category]

**LOCATION CONTEXT:**
- Nearby Landmarks: [List of nearby notable locations]
- Parking Information: [Available parking options]
- Public Transport: [Nearest bus/train stations]
- Additional Notes: [Any other relevant location information]

**DATA VERIFICATION:**
- Sources Used: [List all sources consulted]
- Confidence Level: [High/Medium/Low based on source reliability]
- Last Updated: [When the information was last verified]

IMPORTANT NOTES:
- Provide exact coordinates (not approximate)
- Ensure Google Place ID is the actual unique identifier from Google
- Verify all information is current and accurate
- If multiple locations found, focus on the main/primary location
- Include source URLs for verification
- Note any discrepancies found between sources

Begin the comprehensive location search for "{restaurant_name}".
"""
        
        return search_request
    
    def _save_search_request(self, restaurant_name: str, request: str) -> Path:
        """Save the location search request to a file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._sanitize_filename(restaurant_name)
        
        filename = self.output_dir / "search_requests" / f"{safe_name}_{timestamp}_location_search.txt"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"Restaurant Location Search Request\n")
            f.write(f"=================================\n\n")
            f.write(f"Restaurant: {restaurant_name}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("AGENT LOCATION SEARCH REQUEST:\n")
            f.write("-" * 50 + "\n\n")
            f.write(request)
        
        return filename
    
    def _sanitize_filename(self, name: str) -> str:
        """Sanitize string for filename"""
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
        return safe_name.replace(' ', '_')[:50]
    
    def save_location_results(self, location_data: RestaurantLocation) -> Tuple[Path, Path]:
        """Save location search results to JSON and map-ready format
        
        Returns:
            Tuple of (JSON results file path, map data file path)
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._sanitize_filename(location_data.restaurant_name)
        
        # Save detailed JSON results
        json_filename = self.output_dir / "results" / f"{safe_name}_{timestamp}_location.json"
        
        results_data = {
            "restaurant_name": location_data.restaurant_name,
            "hebrew_name": location_data.hebrew_name,
            "search_timestamp": location_data.search_timestamp,
            "address": {
                "street_address": location_data.street_address,
                "city": location_data.city,
                "postal_code": location_data.postal_code,
                "country": location_data.country,
                "full_address": location_data.full_address,
                "neighborhood": location_data.neighborhood
            },
            "coordinates": {
                "latitude": location_data.latitude,
                "longitude": location_data.longitude
            },
            "google_business": {
                "place_id": location_data.google_place_id,
                "business_url": location_data.google_business_url,
                "maps_url": location_data.google_maps_url,
                "rating": location_data.google_rating,
                "review_count": location_data.google_review_count,
                "phone": location_data.google_phone,
                "website": location_data.google_website,
                "hours": location_data.google_hours
            },
            "location_context": {
                "landmarks_nearby": location_data.landmarks_nearby,
                "parking_info": location_data.parking_info,
                "public_transport": location_data.public_transport
            },
            "metadata": {
                "data_sources": location_data.data_sources
            }
        }
        
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, ensure_ascii=False, indent=2)
        
        # Save map-ready format (simplified for map integration)
        map_filename = self.output_dir / "map_data" / f"{safe_name}_{timestamp}_map.json"
        
        map_data = {
            "name": location_data.restaurant_name,
            "hebrew_name": location_data.hebrew_name,
            "coordinates": [location_data.longitude, location_data.latitude] if location_data.latitude and location_data.longitude else None,
            "address": location_data.full_address,
            "city": location_data.city,
            "google_place_id": location_data.google_place_id,
            "google_maps_url": location_data.google_maps_url,
            "rating": location_data.google_rating,
            "phone": location_data.google_phone,
            "website": location_data.google_website
        }
        
        with open(map_filename, 'w', encoding='utf-8') as f:
            json.dump(map_data, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"Location results saved - Details: {json_filename}, Map: {map_filename}")
        return json_filename, map_filename
    
    def collect_locations_from_restaurant_data(self, restaurant_data_dir: Path) -> Dict[str, RestaurantLocation]:
        """Collect location data for all restaurants in a directory
        
        Args:
            restaurant_data_dir: Directory containing restaurant JSON files
            
        Returns:
            Dictionary mapping restaurant file names to location data
        """
        self.logger.info(f"Starting batch location collection from: {restaurant_data_dir}")
        
        json_files = list(restaurant_data_dir.glob("*.json"))
        results = {}
        
        for i, json_file in enumerate(json_files, 1):
            self.logger.info(f"[{i}/{len(json_files)}] Processing: {json_file.name}")
            
            try:
                # Load restaurant data
                with open(json_file, 'r', encoding='utf-8') as f:
                    restaurant_data = json.load(f)
                
                restaurant_name = restaurant_data.get('name_english', restaurant_data.get('name_hebrew', ''))
                city = restaurant_data.get('location', '')
                hebrew_name = restaurant_data.get('name_hebrew', '')
                
                # Skip if no valid name found
                if not restaurant_name:
                    self.logger.warning(f"No valid restaurant name found in {json_file.name}")
                    results[json_file.stem] = None
                    continue
                
                location_data = self.collect_restaurant_location(
                    restaurant_name, city, hebrew_name
                )
                results[json_file.stem] = location_data
                self.logger.info(f"✅ Location search prepared for: {json_file.stem}")
                
            except Exception as e:
                self.logger.error(f"❌ Error processing {json_file.name}: {e}")
                results[json_file.stem] = None
        
        # Save batch summary
        self._save_batch_summary(results, restaurant_data_dir)
        
        return results
    
    def _save_batch_summary(
        self, 
        results: Dict[str, RestaurantLocation], 
        source_dir: Path
    ) -> None:
        """Save batch location collection summary"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = self.output_dir / f"batch_location_collection_{timestamp}.txt"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"Batch Restaurant Location Collection Summary\n")
            f.write(f"===========================================\n\n")
            f.write(f"Source Directory: {source_dir}\n")
            f.write(f"Collection Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total Restaurants: {len(results)}\n\n")
            
            successful = sum(1 for r in results.values() if r is not None)
            f.write(f"SUCCESS RATE: {successful}/{len(results)} ({successful/len(results)*100:.1f}%)\n\n")
            
            f.write("RESULTS:\n")
            f.write("-" * 40 + "\n")
            
            for name, location_data in results.items():
                if location_data:
                    f.write(f"✅ {name} - {location_data.restaurant_name}\n")
                else:
                    f.write(f"❌ {name} - Failed to process\n")
        
        self.logger.info(f"Batch summary saved: {filename}")
        print(f"📊 Batch location collection summary: {filename}")
    
    def create_master_map_file(self, map_data_dir: Optional[Path] = None) -> Path:
        """Create a master map file combining all restaurant locations
        
        Args:
            map_data_dir: Directory containing map JSON files (defaults to self.output_dir/map_data)
            
        Returns:
            Path to the master map file
        """
        if map_data_dir is None:
            map_data_dir = self.output_dir / "map_data"
        
        self.logger.info(f"Creating master map file from: {map_data_dir}")
        
        map_files = list(map_data_dir.glob("*_map.json"))
        all_restaurants = []
        
        for map_file in map_files:
            try:
                with open(map_file, 'r', encoding='utf-8') as f:
                    restaurant_data = json.load(f)
                    if restaurant_data.get('coordinates'):  # Only include restaurants with coordinates
                        all_restaurants.append(restaurant_data)
            except Exception as e:
                self.logger.error(f"Error reading {map_file}: {e}")
        
        # Create master map data structure
        master_map_data = {
            "type": "FeatureCollection",
            "metadata": {
                "title": "Restaurant Map Data",
                "description": "Restaurant locations from Hebrew food podcast analysis",
                "generated": datetime.now().isoformat(),
                "total_restaurants": len(all_restaurants),
                "coordinate_system": "WGS84"
            },
            "features": []
        }
        
        # Convert to GeoJSON format for easy map integration
        for restaurant in all_restaurants:
            if restaurant.get('coordinates'):
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": restaurant['coordinates']  # [longitude, latitude]
                    },
                    "properties": {
                        "name": restaurant['name'],
                        "hebrew_name": restaurant.get('hebrew_name'),
                        "address": restaurant.get('address'),
                        "city": restaurant.get('city'),
                        "google_place_id": restaurant.get('google_place_id'),
                        "google_maps_url": restaurant.get('google_maps_url'),
                        "rating": restaurant.get('rating'),
                        "phone": restaurant.get('phone'),
                        "website": restaurant.get('website')
                    }
                }
                master_map_data["features"].append(feature)
        
        # Save master map file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        master_file = self.output_dir / f"master_restaurant_map_{timestamp}.json"
        
        with open(master_file, 'w', encoding='utf-8') as f:
            json.dump(master_map_data, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"Master map file created: {master_file}")
        print(f"🗺️ Master map file with {len(all_restaurants)} restaurants: {master_file}")
        
        return master_file


def main():
    """Main function for testing location collection"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python restaurant_location_collector.py <restaurant_name> [city] [hebrew_name]")
        print("Or: python restaurant_location_collector.py --batch <restaurant_data_directory>")
        print("Or: python restaurant_location_collector.py --create-map [map_data_directory]")
        print("")
        print("Examples:")
        print("  python restaurant_location_collector.py 'Mary Posa' 'Caesarea' 'מרי פוסה'")
        print("  python restaurant_location_collector.py --batch restaurant_data/")
        print("  python restaurant_location_collector.py --create-map")
        return
    
    collector = RestaurantLocationCollector()
    
    if sys.argv[1] == "--batch" and len(sys.argv) > 2:
        # Batch processing
        data_dir = Path(sys.argv[2])
        if not data_dir.exists():
            print(f"❌ Directory not found: {data_dir}")
            return
        
        print(f"🚀 Starting batch location collection from: {data_dir}")
        results = collector.collect_locations_from_restaurant_data(data_dir)
        
        successful = sum(1 for r in results.values() if r is not None)
        print(f"\n📊 Batch Results: {successful}/{len(results)} successful")
        
    elif sys.argv[1] == "--create-map":
        # Create master map file
        map_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else None
        master_file = collector.create_master_map_file(map_dir)
        print(f"✅ Master map file created: {master_file}")
        
    else:
        # Single restaurant
        restaurant_name = sys.argv[1]
        city = sys.argv[2] if len(sys.argv) > 2 else None
        hebrew_name = sys.argv[3] if len(sys.argv) > 3 else None
        
        print(f"🚀 Collecting location data for: {restaurant_name}")
        result = collector.collect_restaurant_location(restaurant_name, city, hebrew_name)
        print(f"✅ Location search request prepared for: {result.restaurant_name}")


if __name__ == "__main__":
    main()
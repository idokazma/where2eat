"""
Restaurant Image Collector
Collects high-quality images of restaurant logos and iconic dishes using web search.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, field


@dataclass
class RestaurantImageSearch:
    """Data structure for restaurant image search results"""
    restaurant_name: str
    location: Optional[str] = None
    logo_images: List[str] = field(default_factory=list)
    signature_dish_images: List[str] = field(default_factory=list)
    storefront_images: List[str] = field(default_factory=list)
    interior_images: List[str] = field(default_factory=list)
    menu_images: List[str] = field(default_factory=list)
    all_images: List[str] = field(default_factory=list)
    search_timestamp: str = field(default_factory=lambda: datetime.now().isoformat())


class RestaurantImageCollector:
    """Agent to collect restaurant images from multiple web sources"""
    
    def __init__(self, output_dir: str = "restaurant_images"):
        """Initialize the image collector
        
        Args:
            output_dir: Directory to save image search requests and results
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        (self.output_dir / "search_requests").mkdir(exist_ok=True)
        (self.output_dir / "results").mkdir(exist_ok=True)
        
        self.logger = self._setup_logger()
        self.logger.info(f"RestaurantImageCollector initialized with output_dir: {self.output_dir}")
    
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
    
    def collect_restaurant_images(
        self, 
        restaurant_name: str, 
        location: Optional[str] = None,
        hebrew_name: Optional[str] = None
    ) -> RestaurantImageSearch:
        """Collect comprehensive images for a restaurant
        
        Args:
            restaurant_name: Name of the restaurant
            location: Location/city of the restaurant
            hebrew_name: Hebrew name if applicable
            
        Returns:
            RestaurantImageSearch object with search request prepared
        """
        self.logger.info(f"🖼️ Collecting images for: {restaurant_name}")
        if location:
            self.logger.info(f"📍 Location: {location}")
        if hebrew_name:
            self.logger.info(f"🔤 Hebrew name: {hebrew_name}")
        
        # Create comprehensive image search request
        search_request = self._create_image_search_request(
            restaurant_name, location, hebrew_name
        )
        
        # Save the search request
        request_file = self._save_search_request(restaurant_name, search_request)
        self.logger.info(f"✅ Image search request saved: {request_file}")
        
        # Create result structure (to be filled by agent execution)
        result = RestaurantImageSearch(
            restaurant_name=restaurant_name,
            location=location
        )
        
        print(f"\n🤖 Image search request prepared for: {restaurant_name}")
        print(f"📁 Request file: {request_file}")
        print("💡 Use Claude Code's Task agent with 'general-purpose' subagent_type")
        print("🔍 The agent will search for logos, signature dishes, and storefront images")
        
        return result
    
    def _create_image_search_request(
        self, 
        restaurant_name: str, 
        location: Optional[str] = None,
        hebrew_name: Optional[str] = None
    ) -> str:
        """Create comprehensive image search request for the agent"""
        
        location_context = f" {location}" if location else ""
        hebrew_context = f" {hebrew_name}" if hebrew_name else ""
        
        search_request = f"""
TASK: Find high-quality images for "{restaurant_name}"{location_context}

RESTAURANT DETAILS:
- Name: {restaurant_name}
- Location: {location or "Not specified"}
- Hebrew Name: {hebrew_name or "Not specified"}

IMAGE COLLECTION STRATEGY:

1. **LOGO & BRANDING IMAGES**
   Search queries to use:
   - "{restaurant_name}" logo{location_context}
   - "{restaurant_name}" branding{hebrew_context}
   - "{restaurant_name}" official logo
   
   Target sources:
   - Restaurant's official website
   - Facebook/Instagram profile images
   - Google My Business logo
   
   Look for: Official restaurant logos, brand marks, signage

2. **SIGNATURE DISH IMAGES**
   Search queries to use:
   - "{restaurant_name}" signature dish{location_context}
   - "{restaurant_name}" best dishes{location_context}
   - "{restaurant_name}" menu highlights{hebrew_context}
   - "{restaurant_name}" food photos
   
   Target sources:
   - Restaurant's Instagram/social media
   - Food blog reviews
   - Yelp/TripAdvisor photos
   - Menu photos from official website
   
   Look for: High-quality photos of their most iconic/popular dishes

3. **STOREFRONT & EXTERIOR IMAGES**
   Search queries to use:
   - "{restaurant_name}" exterior{location_context}
   - "{restaurant_name}" storefront
   - "{restaurant_name}" restaurant facade{location_context}
   
   Look for: Restaurant exterior, entrance, outdoor seating, signage

4. **INTERIOR & ATMOSPHERE IMAGES**
   Search queries to use:
   - "{restaurant_name}" interior{location_context}
   - "{restaurant_name}" dining room
   - "{restaurant_name}" atmosphere{location_context}
   
   Look for: Dining room, bar area, kitchen views, ambiance shots

5. **MENU & PROMOTIONAL IMAGES**
   Search queries to use:
   - "{restaurant_name}" menu{location_context}
   - "{restaurant_name}" promotional images
   - "{restaurant_name}" special events
   
   Look for: Menu pages, promotional materials, special event photos

SEARCH INSTRUCTIONS:

1. **Priority Order:**
   - First: Official website and social media
   - Second: Google Images and Google My Business
   - Third: Review sites (Yelp, TripAdvisor)
   - Fourth: Food blogs and news articles

2. **Quality Criteria:**
   - High resolution (prefer 1000px+ width)
   - Professional or semi-professional quality
   - Recent images (within last 2 years if possible)
   - Clear, well-lit photographs
   - Avoid blurry, low-quality, or heavily filtered images

3. **Image Verification:**
   - Verify images actually belong to this specific restaurant
   - Check for watermarks or copyright restrictions
   - Prefer images from official sources when possible

4. **Special Considerations for Israeli/Hebrew Restaurants:**
   - Search using Hebrew text if provided
   - Look for Hebrew menu items and signage
   - Check Israeli food review sites and blogs
   - Consider cultural context for dish names

OUTPUT FORMAT:

Please structure your findings as follows:

**LOGO & BRANDING IMAGES:**
- [URL 1] - Description and source
- [URL 2] - Description and source

**SIGNATURE DISH IMAGES:**
- [URL 1] - Dish name and description, source
- [URL 2] - Dish name and description, source

**STOREFRONT IMAGES:**
- [URL 1] - Description and source
- [URL 2] - Description and source

**INTERIOR IMAGES:**
- [URL 1] - Description and source
- [URL 2] - Description and source

**MENU IMAGES:**
- [URL 1] - Description and source

**SEARCH SUMMARY:**
- Total images found: X
- Best sources discovered: [list]
- Image quality assessment: [notes]
- Recommendations for further searches: [if any]

IMPORTANT NOTES:
- Provide direct URLs to images, not search result pages
- Include source attribution for each image
- Note any copyright or usage restrictions discovered
- If Hebrew name is provided, search using both English and Hebrew terms
- Prioritize images that would be useful for a restaurant guide or review

Begin the comprehensive image search for "{restaurant_name}".
"""
        
        return search_request
    
    def _save_search_request(self, restaurant_name: str, request: str) -> Path:
        """Save the image search request to a file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._sanitize_filename(restaurant_name)
        
        filename = self.output_dir / "search_requests" / f"{safe_name}_{timestamp}_image_search.txt"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"Restaurant Image Search Request\n")
            f.write(f"==============================\n\n")
            f.write(f"Restaurant: {restaurant_name}\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("AGENT IMAGE SEARCH REQUEST:\n")
            f.write("-" * 50 + "\n\n")
            f.write(request)
        
        return filename
    
    def _sanitize_filename(self, name: str) -> str:
        """Sanitize string for filename"""
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
        return safe_name.replace(' ', '_')[:50]
    
    def save_image_results(self, image_search: RestaurantImageSearch) -> Path:
        """Save image search results to JSON file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._sanitize_filename(image_search.restaurant_name)
        
        filename = self.output_dir / "results" / f"{safe_name}_{timestamp}_images.json"
        
        # Convert to dictionary for JSON serialization
        results_data = {
            "restaurant_name": image_search.restaurant_name,
            "location": image_search.location,
            "search_timestamp": image_search.search_timestamp,
            "images": {
                "logo_images": image_search.logo_images,
                "signature_dish_images": image_search.signature_dish_images,
                "storefront_images": image_search.storefront_images,
                "interior_images": image_search.interior_images,
                "menu_images": image_search.menu_images,
                "all_images": image_search.all_images
            },
            "summary": {
                "total_images": len(image_search.all_images),
                "logo_count": len(image_search.logo_images),
                "signature_dish_count": len(image_search.signature_dish_images),
                "storefront_count": len(image_search.storefront_images),
                "interior_count": len(image_search.interior_images),
                "menu_count": len(image_search.menu_images)
            }
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(results_data, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"Image results saved: {filename}")
        return filename
    
    def collect_images_from_json_data(self, restaurant_json_file: Path) -> RestaurantImageSearch:
        """Collect images for a restaurant from existing JSON data
        
        Args:
            restaurant_json_file: Path to restaurant JSON file
            
        Returns:
            RestaurantImageSearch with search request prepared
        """
        # Load restaurant data
        with open(restaurant_json_file, 'r', encoding='utf-8') as f:
            restaurant_data = json.load(f)
        
        restaurant_name = restaurant_data.get('name_english', restaurant_data.get('name_hebrew', ''))
        location = restaurant_data.get('location', '')
        hebrew_name = restaurant_data.get('name_hebrew', '')
        
        self.logger.info(f"Loading restaurant data from: {restaurant_json_file}")
        
        return self.collect_restaurant_images(restaurant_name, location, hebrew_name)
    
    def batch_collect_from_directory(self, restaurant_data_dir: Path) -> Dict[str, RestaurantImageSearch]:
        """Collect images for all restaurants in a directory
        
        Args:
            restaurant_data_dir: Directory containing restaurant JSON files
            
        Returns:
            Dictionary mapping restaurant names to image search results
        """
        self.logger.info(f"Starting batch image collection from: {restaurant_data_dir}")
        
        json_files = list(restaurant_data_dir.glob("*.json"))
        results = {}
        
        for i, json_file in enumerate(json_files, 1):
            self.logger.info(f"[{i}/{len(json_files)}] Processing: {json_file.name}")
            
            try:
                image_search = self.collect_images_from_json_data(json_file)
                results[json_file.stem] = image_search
                self.logger.info(f"✅ Image search prepared for: {json_file.stem}")
            except Exception as e:
                self.logger.error(f"❌ Error processing {json_file.name}: {e}")
                results[json_file.stem] = None
        
        # Save batch summary
        self._save_batch_summary(results, restaurant_data_dir)
        
        return results
    
    def _save_batch_summary(
        self, 
        results: Dict[str, RestaurantImageSearch], 
        source_dir: Path
    ) -> None:
        """Save batch image collection summary"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = self.output_dir / f"batch_image_collection_{timestamp}.txt"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(f"Batch Restaurant Image Collection Summary\n")
            f.write(f"========================================\n\n")
            f.write(f"Source Directory: {source_dir}\n")
            f.write(f"Collection Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Total Restaurants: {len(results)}\n\n")
            
            successful = sum(1 for r in results.values() if r is not None)
            f.write(f"SUCCESS RATE: {successful}/{len(results)} ({successful/len(results)*100:.1f}%)\n\n")
            
            f.write("RESULTS:\n")
            f.write("-" * 40 + "\n")
            
            for name, search_result in results.items():
                if search_result:
                    f.write(f"✅ {name} - {search_result.restaurant_name}\n")
                else:
                    f.write(f"❌ {name} - Failed to process\n")
        
        self.logger.info(f"Batch summary saved: {filename}")
        print(f"📊 Batch image collection summary: {filename}")


def main():
    """Main function for testing image collection"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python restaurant_image_collector.py <restaurant_name> [location] [hebrew_name]")
        print("Or: python restaurant_image_collector.py --batch <restaurant_data_directory>")
        print("")
        print("Examples:")
        print("  python restaurant_image_collector.py 'Mary Posa' 'Caesarea' 'מרי פוסה'")
        print("  python restaurant_image_collector.py --batch restaurant_data/")
        return
    
    collector = RestaurantImageCollector()
    
    if sys.argv[1] == "--batch" and len(sys.argv) > 2:
        # Batch processing
        data_dir = Path(sys.argv[2])
        if not data_dir.exists():
            print(f"❌ Directory not found: {data_dir}")
            return
        
        print(f"🚀 Starting batch image collection from: {data_dir}")
        results = collector.batch_collect_from_directory(data_dir)
        
        successful = sum(1 for r in results.values() if r is not None)
        print(f"\n📊 Batch Results: {successful}/{len(results)} successful")
        
    else:
        # Single restaurant
        restaurant_name = sys.argv[1]
        location = sys.argv[2] if len(sys.argv) > 2 else None
        hebrew_name = sys.argv[3] if len(sys.argv) > 3 else None
        
        print(f"🚀 Collecting images for: {restaurant_name}")
        result = collector.collect_restaurant_images(restaurant_name, location, hebrew_name)
        print(f"✅ Image search request prepared for: {result.restaurant_name}")


if __name__ == "__main__":
    main()
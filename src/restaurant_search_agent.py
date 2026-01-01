"""Restaurant Search Agent

Uses Claude Code's Task agent to search the internet for comprehensive
restaurant information including location, images, and descriptions.

Example:
    agent = RestaurantSearchAgent()
    info = agent.search_restaurant("Ramen Heaven", "Austin")
    agent.save_results(info)
"""

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from dataclasses import dataclass, field


@dataclass
class RestaurantInfo:
    """Data structure for restaurant information.
    
    Attributes:
        name: Restaurant name
        location: City or general location
        address: Full street address
        cuisine_type: Type of cuisine (e.g., "Italian", "Asian Fusion")
        description: Restaurant description
        phone: Phone number
        website: Official website URL
        hours: Operating hours
        price_range: Price range (e.g., "$$", "$$$")
        images: List of image URLs
        rating: Average rating
        reviews_summary: Summary of customer reviews
    """
    name: str
    location: Optional[str] = None
    address: Optional[str] = None
    cuisine_type: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    hours: Optional[str] = None
    price_range: Optional[str] = None
    images: List[str] = field(default_factory=list)
    rating: Optional[str] = None
    reviews_summary: Optional[str] = None


class RestaurantSearchAgent:
    """Agent to search for comprehensive restaurant information.
    
    This class prepares detailed search requests that can be executed
    by Claude Code's Task agent to find restaurant information from
    multiple internet sources.
    
    Attributes:
        results_dir: Directory to save search results
        logger: Logger instance for this class
    """

    def __init__(self, results_dir: str = "restaurant_searches"):
        """Initialize the restaurant search agent.
        
        Args:
            results_dir: Directory to save search results
        """
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(exist_ok=True)
        
        self.logger = self._setup_logger()
        self.logger.info(f"RestaurantSearchAgent initialized with results_dir: {self.results_dir}")

    def _setup_logger(self) -> logging.Logger:
        """Set up logging for the agent."""
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

    def search_restaurant(self, restaurant_name: str, city: Optional[str] = None) -> RestaurantInfo:
        """Search for comprehensive restaurant information.
        
        Prepares a detailed search request for Claude Code's Task agent
        to find restaurant location, images, description, and other details.
        
        Args:
            restaurant_name: Name of the restaurant to search for
            city: Optional city to narrow the search scope
            
        Returns:
            RestaurantInfo object with basic structure (actual data filled by agent)
            
        Raises:
            ValueError: If restaurant_name is empty or invalid
        """
        if not restaurant_name or not restaurant_name.strip():
            raise ValueError("Restaurant name cannot be empty")
        
        restaurant_name = restaurant_name.strip()
        city = city.strip() if city else None
        
        self.logger.info(f"Searching for restaurant: {restaurant_name}")
        if city:
            self.logger.info(f"Location filter: {city}")

        try:
            # Prepare the comprehensive search request for the agent
            agent_request = self._create_search_request(restaurant_name, city)
            
            # Save the request for reference
            request_file = self._save_search_request(restaurant_name, agent_request)
            self.logger.info(f"Search request saved: {request_file}")
            
            # Create placeholder result (actual agent execution would happen here)
            result = RestaurantInfo(name=restaurant_name)
            
            self.logger.info("Search request prepared successfully")
            print("\n🤖 Search request prepared for Claude Code Task agent")
            print(f"📁 Request file: {request_file}")
            print("💡 Use the Task agent with 'general-purpose' subagent_type")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error preparing search for {restaurant_name}: {e}")
            raise

    def _create_search_request(self, restaurant_name: str, city: Optional[str] = None) -> str:
        """Create a comprehensive search request for the agent.
        
        Args:
            restaurant_name: Name of the restaurant
            city: Optional city filter
            
        Returns:
            Formatted search request string for the agent
        """
        location_context = f" in {city}" if city else ""
        
        search_request = f"""
Please search the internet for comprehensive information about "{restaurant_name}"{location_context}.

TASK: Find and compile detailed restaurant information from multiple sources.

SEARCH STRATEGY:
1. Use web search to find the restaurant's official website
2. Search for the restaurant on review platforms (Google, Yelp, TripAdvisor)
3. Look for social media presence (Instagram, Facebook)
4. Find food blog reviews and mentions
5. Search for any news articles or press coverage

INFORMATION TO EXTRACT:
1. **Basic Information**:
   - Full restaurant name
   - Complete address with zip code
   - Phone number
   - Website URL
   - Hours of operation

2. **Location Details**:
   - Neighborhood/area
   - Nearby landmarks
   - Parking information
   - Public transportation access

3. **Restaurant Details**:
   - Type of cuisine (e.g., Italian, Asian Fusion, etc.)
   - Price range ($ to $$$$)
   - Dining style (casual, fine dining, fast casual, etc.)
   - Special features (outdoor seating, bar, live music, etc.)

4. **Description & Atmosphere**:
   - Restaurant's own description/about section
   - Atmosphere and ambiance description
   - Notable menu items or specialties
   - Chef information if notable

5. **Reviews & Ratings**:
   - Average rating from multiple sources
   - Summary of what reviewers commonly praise
   - Common criticisms or complaints
   - Recent review trends

6. **Visual Content**:
   - URLs to high-quality food photos
   - Interior/exterior photos
   - Menu photos if available
   - Logo or branding images

7. **Additional Information**:
   - Reservation requirements
   - Delivery/takeout options
   - Special dietary accommodations
   - Recent news or awards
   - Sister restaurants or chef's other venues

SEARCH QUERIES TO USE:
- "{restaurant_name}"{location_context} official website
- "{restaurant_name}"{location_context} reviews
- "{restaurant_name}"{location_context} menu
- "{restaurant_name}"{location_context} photos
- "{restaurant_name}"{location_context} address hours
- "{restaurant_name}"{location_context} Yelp Google reviews

OUTPUT FORMAT:
Structure the findings as a comprehensive restaurant profile with clear sections for each type of information found. Include source URLs for verification.

IMPORTANT NOTES:
- Verify the restaurant name and location to ensure you're finding the correct establishment
- If multiple restaurants have similar names, focus on the one in the specified location
- Include confidence level for each piece of information found
- Note if any information appears to be outdated or conflicting between sources
- Prioritize official sources (restaurant website) over user-generated content

Begin the search and compile a detailed restaurant profile.
"""
        
        return search_request

    def _save_search_request(self, restaurant_name: str, request: str) -> Path:
        """Save the search request to a file for reference.
        
        Args:
            restaurant_name: Name of the restaurant
            request: The formatted search request
            
        Returns:
            Path to the saved request file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = self._sanitize_filename(restaurant_name)
        
        filename = self.results_dir / f"{safe_name}_{timestamp}_search_request.txt"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(f"Restaurant Search Request\n")
                f.write(f"========================\n\n")
                f.write(f"Restaurant: {restaurant_name}\n")
                f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                f.write("AGENT SEARCH REQUEST:\n")
                f.write("-" * 40 + "\n\n")
                f.write(request)
            
            self.logger.debug(f"Search request saved to {filename}")
            return filename
            
        except OSError as e:
            self.logger.error(f"Failed to save search request: {e}")
            raise

    def _sanitize_filename(self, name: str) -> str:
        """Sanitize a string for use as a filename.
        
        Args:
            name: String to sanitize
            
        Returns:
            Sanitized filename string
        """
        safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
        return safe_name.replace(' ', '_')[:50]  # Limit length

    def save_restaurant_results(
        self, 
        restaurant_info: RestaurantInfo, 
        source_data: Optional[Dict] = None
    ) -> Path:
        """Save restaurant search results to files.
        
        Saves results in both JSON and human-readable text formats.
        
        Args:
            restaurant_info: RestaurantInfo object with search results
            source_data: Optional raw source data from the search
            
        Returns:
            Path to the JSON results file
            
        Raises:
            OSError: If file writing fails
        """
        if not restaurant_info.name:
            raise ValueError("Restaurant info must have a name")
        
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_name = self._sanitize_filename(restaurant_info.name)
            
            # Save as JSON
            json_filename = self.results_dir / f"{safe_name}_{timestamp}_results.json"
            
            results_data = {
                "restaurant_name": restaurant_info.name,
                "search_timestamp": datetime.now().isoformat(),
                "basic_info": {
                    "name": restaurant_info.name,
                    "location": restaurant_info.location,
                    "address": restaurant_info.address,
                    "phone": restaurant_info.phone,
                    "website": restaurant_info.website,
                    "hours": restaurant_info.hours
                },
                "details": {
                    "cuisine_type": restaurant_info.cuisine_type,
                    "description": restaurant_info.description,
                    "price_range": restaurant_info.price_range,
                    "rating": restaurant_info.rating
                },
                "content": {
                    "images": restaurant_info.images,
                    "reviews_summary": restaurant_info.reviews_summary
                },
                "source_data": source_data or {}
            }
            
            with open(json_filename, 'w', encoding='utf-8') as f:
                json.dump(results_data, f, ensure_ascii=False, indent=2)
            
            # Save human-readable summary
            txt_filename = self.results_dir / f"{safe_name}_{timestamp}_summary.txt"
            
            with open(txt_filename, 'w', encoding='utf-8') as f:
                f.write(f"Restaurant Search Results\n")
                f.write(f"========================\n\n")
                f.write(f"Restaurant: {restaurant_info.name}\n")
                f.write(f"Search Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                
                f.write(f"BASIC INFORMATION\n")
                f.write(f"-----------------\n")
                f.write(f"Name: {restaurant_info.name}\n")
                if restaurant_info.location:
                    f.write(f"Location: {restaurant_info.location}\n")
                if restaurant_info.address:
                    f.write(f"Address: {restaurant_info.address}\n")
                if restaurant_info.phone:
                    f.write(f"Phone: {restaurant_info.phone}\n")
                if restaurant_info.website:
                    f.write(f"Website: {restaurant_info.website}\n")
                if restaurant_info.hours:
                    f.write(f"Hours: {restaurant_info.hours}\n")
                
                f.write(f"\nRESTAURANT DETAILS\n")
                f.write(f"------------------\n")
                if restaurant_info.cuisine_type:
                    f.write(f"Cuisine: {restaurant_info.cuisine_type}\n")
                if restaurant_info.price_range:
                    f.write(f"Price Range: {restaurant_info.price_range}\n")
                if restaurant_info.rating:
                    f.write(f"Rating: {restaurant_info.rating}\n")
                
                if restaurant_info.description:
                    f.write(f"\nDESCRIPTION\n")
                    f.write(f"-----------\n")
                    f.write(f"{restaurant_info.description}\n")
                
                if restaurant_info.reviews_summary:
                    f.write(f"\nREVIEWS SUMMARY\n")
                    f.write(f"---------------\n")
                    f.write(f"{restaurant_info.reviews_summary}\n")
                
                if restaurant_info.images:
                    f.write(f"\nIMAGES FOUND\n")
                    f.write(f"------------\n")
                    for i, image_url in enumerate(restaurant_info.images, 1):
                        f.write(f"{i}. {image_url}\n")
            
            self.logger.info(f"Results saved - JSON: {json_filename}, Summary: {txt_filename}")
            print(f"✅ Results saved:")
            print(f"   JSON: {json_filename}")
            print(f"   Summary: {txt_filename}")
            
            return json_filename
            
        except OSError as e:
            self.logger.error(f"Failed to save results: {e}")
            raise

    def search_multiple_restaurants(
        self, 
        restaurant_list: List[str], 
        city: Optional[str] = None
    ) -> Dict[str, Optional[RestaurantInfo]]:
        """Search for multiple restaurants.
        
        Args:
            restaurant_list: List of restaurant names to search
            city: Optional city filter for all searches
            
        Returns:
            Dictionary mapping restaurant names to RestaurantInfo objects
            (None for failed searches)
        """
        if not restaurant_list:
            raise ValueError("Restaurant list cannot be empty")
        
        self.logger.info(f"Starting batch search for {len(restaurant_list)} restaurants")
        if city:
            self.logger.info(f"Location filter: {city}")

        results = {}
        
        for i, restaurant_name in enumerate(restaurant_list, 1):
            self.logger.info(f"[{i}/{len(restaurant_list)}] Processing: {restaurant_name}")
            try:
                restaurant_info = self.search_restaurant(restaurant_name, city)
                results[restaurant_name] = restaurant_info
                self.logger.info(f"Completed search request for {restaurant_name}")
            except Exception as e:
                self.logger.error(f"Error searching {restaurant_name}: {e}")
                results[restaurant_name] = None
        
        # Save batch results
        try:
            self._save_batch_results(results, city)
        except Exception as e:
            self.logger.error(f"Failed to save batch results: {e}")
        
        return results

    def _save_batch_results(
        self, 
        results: Dict[str, Optional[RestaurantInfo]], 
        city: Optional[str] = None
    ) -> None:
        """Save batch search results summary.
        
        Args:
            results: Dictionary of search results
            city: Optional city filter that was used
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        city_suffix = f"_{self._sanitize_filename(city)}" if city else ""
        filename = self.results_dir / f"batch_search{city_suffix}_{timestamp}_summary.txt"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(f"Batch Restaurant Search Results\n")
                f.write(f"==============================\n\n")
                f.write(f"Search Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Total Restaurants: {len(results)}\n")
                if city:
                    f.write(f"Location: {city}\n")
                f.write(f"\nRESULTS SUMMARY\n")
                f.write(f"---------------\n")
                
                successful = 0
                for name, info in results.items():
                    if info:
                        f.write(f"✅ {name}\n")
                        successful += 1
                    else:
                        f.write(f"❌ {name} (search failed)\n")
                
                f.write(f"\nSUCCESS RATE: {successful}/{len(results)} ({successful/len(results)*100:.1f}%)\n")
            
            self.logger.info(f"Batch summary saved: {filename}")
            print(f"\n📊 Batch results summary saved: {filename}")
            
        except OSError as e:
            self.logger.error(f"Failed to save batch summary: {e}")
            raise


def run_restaurant_search(restaurant_name: str, city: Optional[str] = None) -> Dict:
    """Run restaurant search for a single restaurant.
    
    Args:
        restaurant_name: Name of restaurant to search
        city: Optional city to filter search
        
    Returns:
        Dictionary with search results and metadata
        
    Raises:
        ValueError: If restaurant_name is invalid
    """
    if not restaurant_name or not restaurant_name.strip():
        raise ValueError("Restaurant name is required")

    print("🚀 Starting Restaurant Information Search")
    print("=" * 50)
    
    try:
        agent = RestaurantSearchAgent()
        
        # Search for the restaurant
        restaurant_info = agent.search_restaurant(restaurant_name, city)
        
        # For demonstration, create a basic result structure
        # In practice, this would be populated by the agent's findings
        complete_info = RestaurantInfo(
            name=restaurant_name,
            location=city
        )
        
        # Save the search template
        results_file = agent.save_restaurant_results(complete_info)
        
        results = {
            "success": True,
            "restaurant_name": restaurant_name,
            "city": city,
            "search_request_prepared": True,
            "results_file": str(results_file),
            "timestamp": datetime.now().isoformat()
        }
        
        print("\n✅ Restaurant search preparation completed!")
        print(f"📁 Search files saved in: {agent.results_dir}")
        print("\n🤖 Ready for agent execution:")
        print("💡 Use Claude Code's Task agent with the prepared search request")
        print("💡 The agent will find location, images, and description information")
        
        return results
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return {
            "success": False,
            "error": str(e),
            "restaurant_name": restaurant_name,
            "timestamp": datetime.now().isoformat()
        }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python restaurant_search_agent.py <restaurant_name> [city]")
        print("Example: python restaurant_search_agent.py 'Ramen Heaven' 'Austin'")
        print("Example: python restaurant_search_agent.py 'Joe Allen Restaurant'")
        sys.exit(1)
    
    restaurant_name = sys.argv[1]
    city = sys.argv[2] if len(sys.argv) > 2 else None
    
    results = run_restaurant_search(restaurant_name, city)
    
    if results["success"]:
        print("\n" + "=" * 50)
        print("📊 SEARCH PREPARATION RESULTS")
        print("=" * 50)
        print(f"✅ Restaurant: {results['restaurant_name']}")
        if results['city']:
            print(f"✅ City: {results['city']}")
        print(f"✅ Search request prepared and ready for agent")
        print(f"✅ Timestamp: {results['timestamp']}")
    else:
        print(f"\n❌ Search preparation failed: {results.get('error', 'Unknown error')}")
        sys.exit(1)
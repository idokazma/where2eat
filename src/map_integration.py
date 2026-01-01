"""
Map Integration Module
Creates map-ready data structures and integration files for restaurant visualization.
Supports multiple map providers and formats (Google Maps, Leaflet, etc.)
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


@dataclass
class MapConfig:
    """Configuration for map integration"""
    provider: str = "google"  # google, leaflet, mapbox
    center_lat: float = 31.7767  # Israel center
    center_lng: float = 35.2345
    default_zoom: int = 8
    cluster_markers: bool = True
    show_info_windows: bool = True
    custom_marker_icon: Optional[str] = None


class MapIntegration:
    """Creates map-ready data and integration files for restaurants"""
    
    def __init__(self, output_dir: str = "map_integration"):
        """Initialize the map integration module
        
        Args:
            output_dir: Directory to save map integration files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Create subdirectories for different map formats
        (self.output_dir / "geojson").mkdir(exist_ok=True)
        (self.output_dir / "google_maps").mkdir(exist_ok=True)
        (self.output_dir / "leaflet").mkdir(exist_ok=True)
        (self.output_dir / "html_demos").mkdir(exist_ok=True)
        
        self.logger = self._setup_logger()
        self.logger.info(f"MapIntegration initialized with output_dir: {self.output_dir}")
    
    def _setup_logger(self) -> logging.Logger:
        """Set up logging for the integration module"""
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
    
    def create_geojson_from_restaurant_data(
        self, 
        restaurant_data_dir: Path,
        location_data_dir: Path
    ) -> Path:
        """Create GeoJSON file from restaurant and location data
        
        Args:
            restaurant_data_dir: Directory with restaurant JSON files
            location_data_dir: Directory with location JSON files
            
        Returns:
            Path to the created GeoJSON file
        """
        self.logger.info("Creating GeoJSON from restaurant and location data")
        
        # Load restaurant data
        restaurant_files = list(restaurant_data_dir.glob("*.json"))
        location_files = list(location_data_dir.glob("*_location.json"))
        
        # Create mapping of restaurant names to location data
        location_map = {}
        for loc_file in location_files:
            try:
                with open(loc_file, 'r', encoding='utf-8') as f:
                    loc_data = json.load(f)
                    name = loc_data.get('restaurant_name', '')
                    if name:
                        location_map[name] = loc_data
            except Exception as e:
                self.logger.warning(f"Error reading location file {loc_file}: {e}")
        
        # Build GeoJSON feature collection
        features = []
        
        for rest_file in restaurant_files:
            try:
                with open(rest_file, 'r', encoding='utf-8') as f:
                    rest_data = json.load(f)
                
                restaurant_name = rest_data.get('name_english', rest_data.get('name_hebrew', ''))
                if not restaurant_name:
                    continue
                
                # Find corresponding location data
                loc_data = location_map.get(restaurant_name)
                if not loc_data or not loc_data.get('coordinates', {}).get('latitude'):
                    self.logger.debug(f"No location data found for {restaurant_name}")
                    continue
                
                # Create GeoJSON feature
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [
                            loc_data['coordinates']['longitude'],
                            loc_data['coordinates']['latitude']
                        ]
                    },
                    "properties": {
                        # Restaurant information
                        "name": restaurant_name,
                        "hebrew_name": rest_data.get('name_hebrew'),
                        "cuisine_type": rest_data.get('cuisine_type'),
                        "description": rest_data.get('description'),
                        "hosts_opinions": rest_data.get('hosts_opinions'),
                        "dishes_mentioned": rest_data.get('dishes_mentioned', []),
                        "chef": rest_data.get('chef'),
                        "special_features": rest_data.get('special_features', []),
                        
                        # Location information
                        "address": loc_data['address']['full_address'],
                        "city": loc_data['address']['city'],
                        "neighborhood": loc_data['address']['neighborhood'],
                        
                        # Google Business information
                        "google_place_id": loc_data['google_business']['place_id'],
                        "google_maps_url": loc_data['google_business']['maps_url'],
                        "google_rating": loc_data['google_business']['rating'],
                        "google_review_count": loc_data['google_business']['review_count'],
                        "phone": loc_data['google_business']['phone'],
                        "website": loc_data['google_business']['website'],
                        
                        # Additional context
                        "landmarks_nearby": loc_data['location_context']['landmarks_nearby'],
                        "parking_info": loc_data['location_context']['parking_info'],
                        "public_transport": loc_data['location_context']['public_transport'],
                        
                        # Source metadata
                        "source": rest_data.get('source'),
                        "transcript_timestamp": rest_data.get('transcript_timestamp')
                    }
                }
                
                features.append(feature)
                
            except Exception as e:
                self.logger.error(f"Error processing restaurant file {rest_file}: {e}")
        
        # Create GeoJSON FeatureCollection
        geojson_data = {
            "type": "FeatureCollection",
            "metadata": {
                "title": "Hebrew Podcast Restaurant Map",
                "description": "Restaurants mentioned in Hebrew food podcasts with precise locations",
                "generated": datetime.now().isoformat(),
                "total_restaurants": len(features),
                "coordinate_system": "WGS84",
                "bounds": self._calculate_bounds(features) if features else None
            },
            "features": features
        }
        
        # Save GeoJSON file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        geojson_file = self.output_dir / "geojson" / f"restaurants_{timestamp}.geojson"
        
        with open(geojson_file, 'w', encoding='utf-8') as f:
            json.dump(geojson_data, f, ensure_ascii=False, indent=2)
        
        self.logger.info(f"Created GeoJSON with {len(features)} restaurants: {geojson_file}")
        return geojson_file
    
    def _calculate_bounds(self, features: List[Dict]) -> Dict:
        """Calculate bounding box for all restaurant locations"""
        if not features:
            return None
        
        lats = [f['geometry']['coordinates'][1] for f in features]
        lngs = [f['geometry']['coordinates'][0] for f in features]
        
        return {
            "southwest": {"lat": min(lats), "lng": min(lngs)},
            "northeast": {"lat": max(lats), "lng": max(lngs)}
        }
    
    def create_google_maps_integration(
        self, 
        geojson_file: Path, 
        config: Optional[MapConfig] = None
    ) -> Path:
        """Create Google Maps integration files
        
        Args:
            geojson_file: Path to GeoJSON file with restaurant data
            config: Map configuration options
            
        Returns:
            Path to the Google Maps HTML demo file
        """
        if config is None:
            config = MapConfig()
        
        self.logger.info("Creating Google Maps integration")
        
        # Load GeoJSON data
        with open(geojson_file, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        # Create JavaScript data file
        js_data_file = self.output_dir / "google_maps" / "restaurants_data.js"
        
        # Convert GeoJSON to Google Maps format
        markers_data = []
        for feature in geojson_data['features']:
            props = feature['properties']
            coords = feature['geometry']['coordinates']
            
            marker = {
                "position": {"lat": coords[1], "lng": coords[0]},
                "title": props['name'],
                "hebrew_name": props.get('hebrew_name'),
                "cuisine_type": props.get('cuisine_type'),
                "description": props.get('description'),
                "address": props.get('address'),
                "city": props.get('city'),
                "google_rating": props.get('google_rating'),
                "google_maps_url": props.get('google_maps_url'),
                "phone": props.get('phone'),
                "website": props.get('website'),
                "dishes": props.get('dishes_mentioned', []),
                "special_features": props.get('special_features', [])
            }
            markers_data.append(marker)
        
        # Save JavaScript data file
        with open(js_data_file, 'w', encoding='utf-8') as f:
            f.write(f"const restaurantData = {json.dumps(markers_data, ensure_ascii=False, indent=2)};\n")
            f.write(f"const mapConfig = {json.dumps(config.__dict__, indent=2)};\n")
        
        # Create HTML demo file
        html_file = self._create_google_maps_html(markers_data, config)
        
        self.logger.info(f"Created Google Maps integration: {html_file}")
        return html_file
    
    def _create_google_maps_html(self, markers_data: List[Dict], config: MapConfig) -> Path:
        """Create Google Maps HTML demo file"""
        
        html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hebrew Podcast Restaurant Map</title>
    <style>
        body {{
            margin: 0;
            font-family: Arial, sans-serif;
        }}
        #map {{
            height: 100vh;
            width: 100%;
        }}
        .info-window {{
            max-width: 300px;
            font-size: 14px;
        }}
        .restaurant-name {{
            font-size: 18px;
            font-weight: bold;
            color: #1976d2;
            margin-bottom: 5px;
        }}
        .hebrew-name {{
            font-size: 16px;
            color: #666;
            direction: rtl;
            margin-bottom: 8px;
        }}
        .cuisine-type {{
            background: #e3f2fd;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #1976d2;
            display: inline-block;
            margin-bottom: 8px;
        }}
        .rating {{
            color: #ff9800;
            font-weight: bold;
        }}
        .address {{
            color: #666;
            margin: 5px 0;
        }}
        .dishes {{
            margin: 8px 0;
        }}
        .dish-item {{
            background: #f5f5f5;
            padding: 2px 6px;
            margin: 2px;
            border-radius: 3px;
            font-size: 11px;
            display: inline-block;
        }}
        .links {{
            margin-top: 8px;
        }}
        .link {{
            color: #1976d2;
            text-decoration: none;
            margin-right: 10px;
            font-size: 12px;
        }}
        .link:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div id="map"></div>

    <script>
        const restaurantData = {json.dumps(markers_data, ensure_ascii=False, indent=8)};

        function initMap() {{
            // Create map
            const map = new google.maps.Map(document.getElementById("map"), {{
                zoom: {config.default_zoom},
                center: {{ lat: {config.center_lat}, lng: {config.center_lng} }},
                mapTypeId: 'roadmap'
            }});

            // Create info window
            const infoWindow = new google.maps.InfoWindow();

            // Add markers for each restaurant
            restaurantData.forEach((restaurant, index) => {{
                const marker = new google.maps.Marker({{
                    position: restaurant.position,
                    map: map,
                    title: restaurant.title,
                    icon: {{
                        url: 'data:image/svg+xml;base64,' + btoa(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
                                <path fill="#1976d2" d="M12 0C5.373 0 0 5.373 0 12s12 24 12 24 12-17.627 12-24S18.627 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z"/>
                                <circle fill="white" cx="12" cy="12" r="4"/>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(24, 36)
                    }}
                }});

                // Create info window content
                const dishesHtml = restaurant.dishes && restaurant.dishes.length > 0 
                    ? `<div class="dishes">
                         <strong>Dishes mentioned:</strong><br>
                         ${{restaurant.dishes.map(dish => `<span class="dish-item">${{dish}}</span>`).join('')}}
                       </div>`
                    : '';

                const featuresHtml = restaurant.special_features && restaurant.special_features.length > 0
                    ? `<div class="features">
                         <strong>Features:</strong> ${{restaurant.special_features.join(', ')}}
                       </div>`
                    : '';

                const ratingHtml = restaurant.google_rating 
                    ? `<div class="rating">★ ${{restaurant.google_rating}}/5 on Google</div>`
                    : '';

                const linksHtml = `
                    <div class="links">
                        ${{restaurant.google_maps_url ? `<a href="${{restaurant.google_maps_url}}" target="_blank" class="link">Google Maps</a>` : ''}}
                        ${{restaurant.website ? `<a href="${{restaurant.website}}" target="_blank" class="link">Website</a>` : ''}}
                        ${{restaurant.phone ? `<a href="tel:${{restaurant.phone}}" class="link">Call</a>` : ''}}
                    </div>
                `;

                const contentString = `
                    <div class="info-window">
                        <div class="restaurant-name">${{restaurant.title}}</div>
                        ${{restaurant.hebrew_name ? `<div class="hebrew-name">${{restaurant.hebrew_name}}</div>` : ''}}
                        ${{restaurant.cuisine_type ? `<div class="cuisine-type">${{restaurant.cuisine_type}}</div>` : ''}}
                        <div class="address">${{restaurant.address || restaurant.city || 'Address not available'}}</div>
                        ${{ratingHtml}}
                        ${{restaurant.description ? `<div style="margin: 8px 0; font-size: 13px;">${{restaurant.description.substring(0, 150)}}...</div>` : ''}}
                        ${{dishesHtml}}
                        ${{featuresHtml}}
                        ${{linksHtml}}
                    </div>
                `;

                // Add click listener to marker
                marker.addListener("click", () => {{
                    infoWindow.setContent(contentString);
                    infoWindow.open(map, marker);
                }});
            }});

            // Fit map to show all markers
            if (restaurantData.length > 0) {{
                const bounds = new google.maps.LatLngBounds();
                restaurantData.forEach(restaurant => {{
                    bounds.extend(restaurant.position);
                }});
                map.fitBounds(bounds);
                
                // Don't zoom in too much for single restaurant
                const listener = google.maps.event.addListener(map, "idle", function() {{
                    if (map.getZoom() > 16) map.setZoom(16);
                    google.maps.event.removeListener(listener);
                }});
            }}
        }}

        // Initialize map when page loads
        window.onload = initMap;
    </script>
    
    <!-- Replace YOUR_API_KEY with your actual Google Maps API key -->
    <script async defer 
        src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap">
    </script>
</body>
</html>'''
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        html_file = self.output_dir / "html_demos" / f"google_maps_demo_{timestamp}.html"
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return html_file
    
    def create_leaflet_integration(self, geojson_file: Path, config: Optional[MapConfig] = None) -> Path:
        """Create Leaflet.js integration files"""
        if config is None:
            config = MapConfig(provider="leaflet")
        
        self.logger.info("Creating Leaflet integration")
        
        # Load GeoJSON data
        with open(geojson_file, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        # Create Leaflet HTML demo
        html_content = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hebrew Podcast Restaurant Map - Leaflet</title>
    
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    
    <style>
        body {{
            margin: 0;
            font-family: Arial, sans-serif;
        }}
        #map {{
            height: 100vh;
            width: 100%;
        }}
        .restaurant-popup {{
            max-width: 300px;
            font-size: 14px;
        }}
        .restaurant-name {{
            font-size: 16px;
            font-weight: bold;
            color: #2c5aa0;
            margin-bottom: 5px;
        }}
        .hebrew-name {{
            font-size: 14px;
            color: #666;
            direction: rtl;
            margin-bottom: 8px;
        }}
        .cuisine-type {{
            background: #e3f2fd;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #2c5aa0;
            display: inline-block;
            margin-bottom: 8px;
        }}
    </style>
</head>
<body>
    <div id="map"></div>

    <!-- Leaflet JavaScript -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    
    <script>
        // Initialize the map
        const map = L.map('map').setView([{config.center_lat}, {config.center_lng}], {config.default_zoom});

        // Add OpenStreetMap tiles
        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }}).addTo(map);

        // GeoJSON data
        const restaurantData = {json.dumps(geojson_data, ensure_ascii=False, indent=8)};

        // Custom restaurant icon
        const restaurantIcon = L.divIcon({{
            html: `<div style="
                background: #2c5aa0;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 12px;
            ">🍽</div>`,
            className: 'custom-restaurant-icon',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        }});

        // Add GeoJSON layer
        L.geoJSON(restaurantData, {{
            pointToLayer: function (feature, latlng) {{
                return L.marker(latlng, {{ icon: restaurantIcon }});
            }},
            onEachFeature: function (feature, layer) {{
                const props = feature.properties;
                
                const dishesHtml = props.dishes_mentioned && props.dishes_mentioned.length > 0 
                    ? `<div><strong>Dishes:</strong> ${{props.dishes_mentioned.join(', ')}}</div>`
                    : '';
                
                const ratingHtml = props.google_rating 
                    ? `<div style="color: #ff9800; font-weight: bold;">★ ${{props.google_rating}}/5</div>`
                    : '';

                const popupContent = `
                    <div class="restaurant-popup">
                        <div class="restaurant-name">${{props.name}}</div>
                        ${{props.hebrew_name ? `<div class="hebrew-name">${{props.hebrew_name}}</div>` : ''}}
                        ${{props.cuisine_type ? `<div class="cuisine-type">${{props.cuisine_type}}</div>` : ''}}
                        <div style="margin: 5px 0; color: #666;">${{props.address || 'Address not available'}}</div>
                        ${{ratingHtml}}
                        ${{props.description ? `<div style="margin: 8px 0; font-size: 12px;">${{props.description.substring(0, 120)}}...</div>` : ''}}
                        ${{dishesHtml}}
                        ${{props.google_maps_url ? `<div style="margin-top: 8px;"><a href="${{props.google_maps_url}}" target="_blank">View on Google Maps</a></div>` : ''}}
                    </div>
                `;
                
                layer.bindPopup(popupContent);
            }}
        }}).addTo(map);

        // Fit map to show all restaurants
        if (restaurantData.features.length > 0) {{
            const group = new L.featureGroup(Object.values(map._layers).filter(layer => layer instanceof L.Marker));
            map.fitBounds(group.getBounds().pad(0.1));
        }}
    </script>
</body>
</html>'''
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        html_file = self.output_dir / "html_demos" / f"leaflet_demo_{timestamp}.html"
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        self.logger.info(f"Created Leaflet integration: {html_file}")
        return html_file
    
    def create_complete_integration_package(
        self, 
        restaurant_data_dir: Path, 
        location_data_dir: Path
    ) -> Dict[str, Path]:
        """Create complete map integration package with all formats
        
        Args:
            restaurant_data_dir: Directory with restaurant JSON files
            location_data_dir: Directory with location JSON files
            
        Returns:
            Dictionary with paths to all created files
        """
        self.logger.info("Creating complete map integration package")
        
        results = {}
        
        # Create GeoJSON
        geojson_file = self.create_geojson_from_restaurant_data(restaurant_data_dir, location_data_dir)
        results['geojson'] = geojson_file
        
        # Create Google Maps integration
        google_html = self.create_google_maps_integration(geojson_file)
        results['google_maps_demo'] = google_html
        
        # Create Leaflet integration
        leaflet_html = self.create_leaflet_integration(geojson_file)
        results['leaflet_demo'] = leaflet_html
        
        # Create summary file
        summary_file = self._create_integration_summary(results)
        results['summary'] = summary_file
        
        self.logger.info("Complete map integration package created")
        return results
    
    def _create_integration_summary(self, results: Dict[str, Path]) -> Path:
        """Create integration summary file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        summary_file = self.output_dir / f"integration_summary_{timestamp}.md"
        
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write("# Restaurant Map Integration Package\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            f.write("## Files Created\n\n")
            
            for file_type, file_path in results.items():
                f.write(f"### {file_type.replace('_', ' ').title()}\n")
                f.write(f"- **File:** `{file_path.name}`\n")
                f.write(f"- **Path:** `{file_path}`\n")
                
                if file_type == 'geojson':
                    f.write("- **Purpose:** Standard GeoJSON format for any map library\n")
                    f.write("- **Usage:** Can be loaded into any GIS software or web map\n")
                elif file_type == 'google_maps_demo':
                    f.write("- **Purpose:** Google Maps integration demo\n")
                    f.write("- **Usage:** Replace YOUR_API_KEY with actual Google Maps API key\n")
                elif file_type == 'leaflet_demo':
                    f.write("- **Purpose:** Open-source Leaflet.js map demo\n")
                    f.write("- **Usage:** No API key required, ready to use\n")
                
                f.write("\n")
            
            f.write("## Integration Instructions\n\n")
            f.write("1. **For Google Maps:** Replace `YOUR_API_KEY` in the HTML file with your Google Maps API key\n")
            f.write("2. **For Leaflet:** The HTML file is ready to use without API keys\n")
            f.write("3. **For Custom Integration:** Use the GeoJSON file with any map library\n\n")
            
            f.write("## Features Included\n\n")
            f.write("- Restaurant markers with custom icons\n")
            f.write("- Interactive popups with restaurant information\n")
            f.write("- Hebrew and English name support\n")
            f.write("- Cuisine type, rating, and address display\n")
            f.write("- Links to Google Maps and restaurant websites\n")
            f.write("- Responsive design for mobile and desktop\n\n")
        
        return summary_file


def main():
    """Main function for testing map integration"""
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python map_integration.py <restaurant_data_dir> <location_data_dir>")
        print("Example: python map_integration.py restaurant_data/ restaurant_locations/results/")
        return
    
    restaurant_data_dir = Path(sys.argv[1])
    location_data_dir = Path(sys.argv[2])
    
    if not restaurant_data_dir.exists():
        print(f"❌ Restaurant data directory not found: {restaurant_data_dir}")
        return
    
    if not location_data_dir.exists():
        print(f"❌ Location data directory not found: {location_data_dir}")
        return
    
    print(f"🚀 Creating map integration package...")
    print(f"📊 Restaurant data: {restaurant_data_dir}")
    print(f"🗺️ Location data: {location_data_dir}")
    
    integrator = MapIntegration()
    results = integrator.create_complete_integration_package(restaurant_data_dir, location_data_dir)
    
    print("\n✅ Map integration package created!")
    print("\n📁 Files created:")
    for file_type, file_path in results.items():
        print(f"  {file_type}: {file_path}")


if __name__ == "__main__":
    main()
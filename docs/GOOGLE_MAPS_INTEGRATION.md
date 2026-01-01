# Google Maps Integration Guide

This guide explains how to enrich restaurant data with Google Places API and integrate with Google Maps.

## 🗝️ Setup Google Places API Key

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create or select a project**
3. **Enable APIs**:
   - Google Places API
   - Google Maps JavaScript API (for web maps)
4. **Create credentials**: Create an API key
5. **Set restrictions** (recommended):
   - Restrict to your domain/IP
   - Restrict to specific APIs

## 🔧 Installation & Setup

```bash
# Set your API key
export GOOGLE_PLACES_API_KEY='your-api-key-here'

# Install required packages
pip install requests

# Run enrichment
python scripts/enrich_restaurants.py
```

## 📊 What Gets Enhanced

The enricher adds comprehensive Google Places data to each restaurant:

### Location Data
```json
{
  "location": {
    "coordinates": {
      "latitude": 32.0853,
      "longitude": 34.7818
    },
    "full_address": "123 Dizengoff St, Tel Aviv-Yafo, Israel"
  }
}
```

### Google Places Integration
```json
{
  "google_places": {
    "place_id": "ChIJ...",
    "google_name": "Restaurant Name",
    "google_url": "https://maps.google.com/?cid=...",
    "enriched_at": "2026-01-01 21:20:00"
  }
}
```

### Ratings & Reviews
```json
{
  "rating": {
    "google_rating": 4.5,
    "total_reviews": 127,
    "price_level": 2
  }
}
```

### Photos
```json
{
  "photos": [
    {
      "photo_reference": "CmRa...",
      "photo_url": "https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=...",
      "width": 400,
      "height": 300
    }
  ]
}
```

### Business Information
```json
{
  "contact_info": {
    "phone": "+972-3-123-4567",
    "website": "https://restaurant.com"
  },
  "business_hours": {
    "open_now": true,
    "weekday_text": [
      "Monday: 11:00 AM – 11:00 PM",
      "Tuesday: 11:00 AM – 11:00 PM"
    ]
  }
}
```

## 🗺️ Web Integration Examples

### Basic Map with Markers

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&callback=initMap"></script>
</head>
<body>
    <div id="map" style="height: 400px;"></div>
    <script>
        async function initMap() {
            // Center on Israel
            const map = new google.maps.Map(document.getElementById("map"), {
                zoom: 8,
                center: { lat: 31.7683, lng: 35.2137 }
            });

            // Load restaurant data
            const restaurants = await fetch('/api/restaurants').then(r => r.json());
            
            // Add markers for each restaurant
            restaurants.forEach(restaurant => {
                if (restaurant.location?.coordinates) {
                    const marker = new google.maps.Marker({
                        position: {
                            lat: restaurant.location.coordinates.latitude,
                            lng: restaurant.location.coordinates.longitude
                        },
                        map: map,
                        title: restaurant.name_english
                    });
                    
                    // Info window with restaurant details
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div>
                                <h3>${restaurant.name_english}</h3>
                                <p><strong>Cuisine:</strong> ${restaurant.cuisine_type}</p>
                                <p><strong>Rating:</strong> ${restaurant.rating?.google_rating || 'N/A'}</p>
                                <p><strong>Address:</strong> ${restaurant.location.full_address}</p>
                                ${restaurant.contact_info?.website ? `<a href="${restaurant.contact_info.website}" target="_blank">Website</a>` : ''}
                            </div>
                        `
                    });
                    
                    marker.addListener('click', () => {
                        infoWindow.open(map, marker);
                    });
                }
            });
        }
    </script>
</body>
</html>
```

### React Component with Google Maps

```jsx
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { useState } from 'react';

const RestaurantMap = ({ restaurants }) => {
    const [selectedRestaurant, setSelectedRestaurant] = useState(null);
    
    const mapStyles = {
        height: "400px",
        width: "100%"
    };
    
    const defaultCenter = {
        lat: 31.7683,
        lng: 35.2137
    };

    return (
        <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_KEY}>
            <GoogleMap
                mapContainerStyle={mapStyles}
                zoom={8}
                center={defaultCenter}
            >
                {restaurants.map((restaurant, index) => {
                    if (!restaurant.location?.coordinates) return null;
                    
                    return (
                        <Marker
                            key={index}
                            position={{
                                lat: restaurant.location.coordinates.latitude,
                                lng: restaurant.location.coordinates.longitude
                            }}
                            onClick={() => setSelectedRestaurant(restaurant)}
                        />
                    );
                })}
                
                {selectedRestaurant && (
                    <InfoWindow
                        position={{
                            lat: selectedRestaurant.location.coordinates.latitude,
                            lng: selectedRestaurant.location.coordinates.longitude
                        }}
                        onCloseClick={() => setSelectedRestaurant(null)}
                    >
                        <div>
                            <h3>{selectedRestaurant.name_english}</h3>
                            <p><strong>Cuisine:</strong> {selectedRestaurant.cuisine_type}</p>
                            <p><strong>Host Opinion:</strong> {selectedRestaurant.host_opinion}</p>
                            {selectedRestaurant.rating && (
                                <p><strong>Rating:</strong> {selectedRestaurant.rating.google_rating} ⭐</p>
                            )}
                            {selectedRestaurant.photos?.[0] && (
                                <img 
                                    src={selectedRestaurant.photos[0].photo_url} 
                                    alt={selectedRestaurant.name_english}
                                    style={{maxWidth: '200px', maxHeight: '150px'}}
                                />
                            )}
                        </div>
                    </InfoWindow>
                )}
            </GoogleMap>
        </LoadScript>
    );
};
```

### Restaurant Cards with Google Data

```jsx
const RestaurantCard = ({ restaurant }) => {
    const openInGoogleMaps = () => {
        if (restaurant.google_places?.google_url) {
            window.open(restaurant.google_places.google_url, '_blank');
        }
    };

    return (
        <div className="restaurant-card">
            {restaurant.photos?.[0] && (
                <img 
                    src={restaurant.photos[0].photo_url} 
                    alt={restaurant.name_english}
                    className="restaurant-image"
                />
            )}
            
            <div className="restaurant-info">
                <h3>{restaurant.name_english}</h3>
                <p className="cuisine">{restaurant.cuisine_type}</p>
                
                {restaurant.rating && (
                    <div className="rating">
                        <span className="stars">{'⭐'.repeat(Math.round(restaurant.rating.google_rating))}</span>
                        <span className="rating-text">
                            {restaurant.rating.google_rating} ({restaurant.rating.total_reviews} reviews)
                        </span>
                    </div>
                )}
                
                <p className="address">{restaurant.location.full_address}</p>
                
                <div className="host-opinion">
                    <strong>Host says:</strong> {restaurant.host_comments}
                </div>
                
                <div className="actions">
                    <button onClick={openInGoogleMaps}>View on Google Maps</button>
                    {restaurant.contact_info?.website && (
                        <a href={restaurant.contact_info.website} target="_blank" rel="noopener noreferrer">
                            Website
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};
```

## 📈 Usage Statistics

The enricher provides search strategies:

1. **English name + city** - Most accurate
2. **Hebrew name + city** - For Hebrew-named establishments  
3. **English name + "restaurant" + city** - Broader search
4. **Name only** - Fallback for unique names

## 🛠️ API Costs & Limits

Google Places API pricing (as of 2024):
- **Text Search**: $17 per 1,000 requests
- **Place Details**: $17 per 1,000 requests  
- **Photos**: $7 per 1,000 requests

**Cost per restaurant**: ~$0.051 (Text Search + Details + Photo)

For 11 restaurants: ~$0.56

## 🔒 Security Best Practices

1. **Restrict API key**: Limit to specific domains/IPs
2. **Enable specific APIs only**: Don't enable all Google APIs
3. **Set usage quotas**: Prevent unexpected charges
4. **Use environment variables**: Never commit API keys to code

## 🚀 Next Steps

After enrichment, you can:
1. Build interactive maps with restaurant markers
2. Create restaurant detail pages with Google Photos
3. Add "Get Directions" functionality
4. Display real-time business hours
5. Show Google ratings alongside host opinions
6. Filter restaurants by distance from user location
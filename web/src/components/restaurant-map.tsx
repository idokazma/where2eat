"use client"

import { useEffect, useRef, useState } from "react"
import { Restaurant } from "@/types/restaurant"
import { MapPin, Navigation, Star } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { endpoints } from "@/lib/config"
import { useLanguage } from "@/contexts/LanguageContext"

interface RestaurantMapProps {
  restaurants: Restaurant[]
  selectedRestaurant?: Restaurant | null
  onRestaurantSelect?: (restaurant: Restaurant) => void
}

// Google Maps types
declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

interface PlaceDetails {
  place_id: string
  name: string
  formatted_address: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  rating?: number
  price_level?: number
  photos?: any[]
  formatted_phone_number?: string
  website?: string
  opening_hours?: {
    open_now: boolean
    weekday_text: string[]
  }
}

export function RestaurantMap({ restaurants, selectedRestaurant, onRestaurantSelect }: RestaurantMapProps) {
  const { t } = useLanguage()
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [markers, setMarkers] = useState<any[]>([])
  const [placesService, setPlacesService] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrichedRestaurants, setEnrichedRestaurants] = useState<(Restaurant & { placeDetails?: PlaceDetails })[]>([])

  // Initialize Google Maps
  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google) {
        initializeMap()
        return
      }

      // Create script element
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&language=he`
      script.async = true
      script.defer = true
      
      script.onload = () => {
        initializeMap()
      }
      
      script.onerror = () => {
        setError('Failed to load Google Maps')
        setIsLoading(false)
      }

      document.head.appendChild(script)
    }

    const initializeMap = () => {
      if (!mapRef.current) return

      try {
        // Initialize map centered on Israel
        const mapInstance = new window.google.maps.Map(mapRef.current, {
          zoom: 8,
          center: { lat: 31.7683, lng: 35.2137 }, // Jerusalem
          mapTypeId: 'roadmap',
          styles: [
            // Custom map styling for food theme
            {
              featureType: 'poi.business',
              elementType: 'labels.icon',
              stylers: [{ color: '#ff6b35' }]
            },
            {
              featureType: 'poi.attraction',
              elementType: 'labels.icon',
              stylers: [{ color: '#ff9500' }]
            }
          ]
        })

        const placesServiceInstance = new window.google.maps.places.PlacesService(mapInstance)
        
        setMap(mapInstance)
        setPlacesService(placesServiceInstance)
        setIsLoading(false)
      } catch (err) {
        setError('Failed to initialize map')
        setIsLoading(false)
      }
    }

    loadGoogleMaps()
  }, [])

  // Search for restaurants and add markers
  useEffect(() => {
    if (!map || !placesService || restaurants.length === 0) return

    const searchAndMarkRestaurants = async () => {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null))
      setMarkers([])

      const newMarkers: any[] = []
      const enriched: (Restaurant & { placeDetails?: PlaceDetails })[] = []

      for (const restaurant of restaurants) {
        try {
          const placeDetails = await searchRestaurantPlace(restaurant)
          enriched.push({ ...restaurant, placeDetails: placeDetails || undefined })

          if (placeDetails) {
            const marker = new window.google.maps.Marker({
              position: {
                lat: placeDetails.geometry.location.lat,
                lng: placeDetails.geometry.location.lng
              },
              map: map,
              title: restaurant.name_hebrew,
              icon: {
                url: getMarkerIcon(restaurant.host_opinion),
                scaledSize: new window.google.maps.Size(40, 40)
              }
            })

            // Create info window
            const infoWindow = new window.google.maps.InfoWindow({
              content: createInfoWindowContent(restaurant, placeDetails)
            })

            marker.addListener('click', () => {
              // Close all other info windows
              markers.forEach(m => m.infoWindow?.close())
              
              infoWindow.open(map, marker)
              onRestaurantSelect?.(restaurant)
            })

            marker.infoWindow = infoWindow
            newMarkers.push(marker)
          }
        } catch (error) {
          console.error(`Error searching for ${restaurant.name_hebrew}:`, error)
          // Add restaurant without place details
          enriched.push({ ...restaurant })
        }
      }

      setMarkers(newMarkers)
      setEnrichedRestaurants(enriched)

      // Fit map to show all markers
      if (newMarkers.length > 0) {
        const bounds = new window.google.maps.LatLngBounds()
        newMarkers.forEach(marker => bounds.extend(marker.getPosition()))
        map.fitBounds(bounds)
        
        // Don't zoom too close if there's only one marker
        if (newMarkers.length === 1) {
          map.setZoom(15)
        }
      }
    }

    searchAndMarkRestaurants()
  }, [map, placesService, restaurants])

  const searchRestaurantPlace = async (restaurant: Restaurant): Promise<PlaceDetails | null> => {
    try {
      // First try with Hebrew name
      const query = `${restaurant.name_hebrew} ${restaurant.location.city} restaurant`
      const response = await fetch(endpoints.places.search(query))

      if (response.ok) {
        const data = await response.json()
        if (data.places && data.places.length > 0) {
          return data.places[0] as PlaceDetails
        }
      }

      // Try with English name if available
      if (restaurant.name_english) {
        const altQuery = `${restaurant.name_english} ${restaurant.location.city} restaurant`
        const altResponse = await fetch(endpoints.places.search(altQuery))

        if (altResponse.ok) {
          const altData = await altResponse.json()
          if (altData.places && altData.places.length > 0) {
            return altData.places[0] as PlaceDetails
          }
        }
      }

      return null
    } catch (error) {
      console.error('Error searching for restaurant:', error)
      return null
    }
  }

  const getMarkerIcon = (opinion: Restaurant['host_opinion']) => {
    const baseUrl = "data:image/svg+xml;charset=UTF-8,"
    const colors = {
      positive: '%234ade80', // green
      mixed: '%23f59e0b',    // amber
      neutral: '%236b7280',  // gray
      negative: '%23ef4444'  // red
    }
    
    const color = colors[opinion] || colors.neutral
    
    return baseUrl + encodeURIComponent(`
      <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="3"/>
        <text x="20" y="26" font-family="Arial" font-size="16" text-anchor="middle" fill="white">🍽️</text>
      </svg>
    `)
  }

  const createInfoWindowContent = (restaurant: Restaurant, placeDetails: PlaceDetails) => {
    return `
      <div style="max-width: 300px; direction: rtl; font-family: Arial, sans-serif;">
        <h3 style="margin: 0 0 8px 0; color: #ea580c; font-size: 18px;">${restaurant.name_hebrew}</h3>
        ${restaurant.name_english ? `<p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">${restaurant.name_english}</p>` : ''}
        
        <div style="margin: 8px 0;">
          <span style="background: ${getOpinionColor(restaurant.host_opinion)}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">
            ${getOpinionText(restaurant.host_opinion)}
          </span>
          <span style="margin-right: 8px; color: #f59e0b; font-size: 14px;">
            ${getPriceDisplay(restaurant.price_range)}
          </span>
        </div>
        
        <p style="margin: 8px 0; color: #4b5563; font-size: 14px;">
          📍 ${placeDetails.formatted_address || restaurant.location.city}
        </p>
        
        ${placeDetails.rating ? `
          <p style="margin: 8px 0; color: #4b5563; font-size: 14px;">
            ⭐ ${placeDetails.rating}/5
          </p>
        ` : ''}
        
        ${restaurant.host_comments ? `
          <p style="margin: 8px 0; color: #6b7280; font-size: 13px; font-style: italic;">
            "${restaurant.host_comments.substring(0, 100)}${restaurant.host_comments.length > 100 ? '...' : ''}"
          </p>
        ` : ''}
        
        <button onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeDetails.formatted_address || restaurant.name_hebrew)}')"
                style="background: #ea580c; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px;">
          ${t('map.openInGoogleMaps')}
        </button>
      </div>
    `
  }

  const getOpinionColor = (opinion: Restaurant['host_opinion']) => {
    const colors = {
      positive: '#22c55e',
      mixed: '#f59e0b', 
      neutral: '#6b7280',
      negative: '#ef4444'
    }
    return colors[opinion] || colors.neutral
  }

  const getOpinionText = (opinion: Restaurant['host_opinion']) => {
    const texts = {
      positive: t('map.recommended'),
      mixed: t('map.mixed'),
      neutral: t('map.neutral'),
      negative: t('map.notRecommended')
    }
    return texts[opinion] || t('map.neutral')
  }

  const getPriceDisplay = (priceRange: Restaurant['price_range']) => {
    const displays = {
      budget: '₪',
      'mid-range': '₪₪',
      expensive: '₪₪₪',
      not_mentioned: '-'
    }
    return displays[priceRange] || '-'
  }

  const centerOnRestaurant = (restaurant: Restaurant & { placeDetails?: PlaceDetails }) => {
    if (!map || !restaurant.placeDetails) return
    
    const location = {
      lat: restaurant.placeDetails.geometry.location.lat,
      lng: restaurant.placeDetails.geometry.location.lng
    }
    
    map.setCenter(location)
    map.setZoom(16)
    
    // Find and click the marker
    const marker = markers.find(m => m.getTitle() === restaurant.name_hebrew)
    if (marker) {
      window.google.maps.event.trigger(marker, 'click')
    }
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">🗺️</div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">{t('errors.loadingMap')}</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-orange-500" />
            {t('map.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">{t('map.loadingMap')}</p>
                </div>
              </div>
            )}
            <div
              ref={mapRef}
              className="w-full h-96 rounded-lg border border-gray-200"
              style={{ minHeight: '400px' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Restaurant List with Map Actions */}
      {enrichedRestaurants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="size-5 text-blue-500" />
              {t('map.restaurantsOnMap')} ({enrichedRestaurants.filter(r => r.placeDetails).length} {t('timeline.of')} {enrichedRestaurants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {enrichedRestaurants.map((restaurant, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-right">{restaurant.name_hebrew}</h4>
                    {restaurant.name_english && (
                      <p className="text-sm text-gray-600">{restaurant.name_english}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {restaurant.location.city}
                      </Badge>
                      {restaurant.placeDetails?.rating && (
                        <span className="text-xs text-gray-500">
                          ⭐ {restaurant.placeDetails.rating}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {restaurant.placeDetails ? (
                      <Button
                        size="sm"
                        onClick={() => centerOnRestaurant(restaurant)}
                        className="bg-orange-500 hover:bg-orange-600"
                      >
                        <MapPin className="size-4 ml-1" />
                        {t('map.showOnMap')}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-xs text-red-600">
                        {t('map.notFoundOnMap')}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
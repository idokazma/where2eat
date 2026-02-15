import { Restaurant } from '@/types/restaurant';
import { config } from '@/lib/config';

/**
 * Get the best available photo URL for a restaurant.
 * Prefers proxy URL (hides API key), falls back to direct URL.
 */
export function getRestaurantImage(restaurant: Restaurant): string | null {
  // Try photos array first (from Google Places enrichment)
  if (restaurant.photos && restaurant.photos.length > 0) {
    const photo = restaurant.photos[0];
    if (photo.photo_reference) {
      return getPhotoProxyUrl(photo.photo_reference);
    }
    if (photo.photo_url) {
      return photo.photo_url;
    }
  }

  // Fall back to image_url field
  if (restaurant.image_url) {
    // If image_url looks like a photo reference (not a URL), build proxy URL
    if (!restaurant.image_url.startsWith('http')) {
      return getPhotoProxyUrl(restaurant.image_url);
    }
    return restaurant.image_url;
  }

  return null;
}

/**
 * Get all available photo URLs for a restaurant.
 */
export function getRestaurantImages(restaurant: Restaurant): string[] {
  if (!restaurant.photos || restaurant.photos.length === 0) {
    const single = restaurant.image_url;
    return single ? [single] : [];
  }

  return restaurant.photos
    .map((photo) => {
      if (photo.photo_reference) {
        return getPhotoProxyUrl(photo.photo_reference);
      }
      return photo.photo_url;
    })
    .filter(Boolean);
}

/**
 * Build a proxy URL for a Google Places photo reference.
 * This keeps the API key server-side.
 */
export function getPhotoProxyUrl(
  photoReference: string,
  maxWidth: number = 800
): string {
  const base = config.apiUrl || '';
  return `${base}/api/photos/${encodeURIComponent(photoReference)}?maxwidth=${maxWidth}`;
}

/**
 * Cuisine to gradient class mapping.
 */
const cuisineGradientMap: Record<string, string> = {
  'הומוס': 'gradient-hummus',
  'hummus': 'gradient-hummus',
  'שווארמה': 'gradient-shawarma',
  'shawarma': 'gradient-shawarma',
  'אסייתי': 'gradient-asian',
  'asian': 'gradient-asian',
  'סיני': 'gradient-asian',
  'יפני': 'gradient-asian',
  'תאילנדי': 'gradient-asian',
  'איטלקי': 'gradient-italian',
  'italian': 'gradient-italian',
  'פיצה': 'gradient-italian',
  'דגים': 'gradient-fish',
  'fish': 'gradient-fish',
  'פירות ים': 'gradient-fish',
  'בשרים': 'gradient-meat',
  'meat': 'gradient-meat',
  'סטייק': 'gradient-meat',
  'המבורגר': 'gradient-meat',
  'קינוחים': 'gradient-dessert',
  'dessert': 'gradient-dessert',
  'מאפים': 'gradient-dessert',
  'קפה': 'gradient-dessert',
};

/**
 * Get the CSS gradient class for a cuisine type.
 */
export function getCuisineGradient(cuisine: string | null | undefined): string {
  if (!cuisine) return 'gradient-default';
  const lower = cuisine.toLowerCase();
  for (const [key, value] of Object.entries(cuisineGradientMap)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  return 'gradient-default';
}

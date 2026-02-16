import { Restaurant } from '@/types/restaurant';
import { config } from '@/lib/config';

/**
 * Get the best available photo URL for a restaurant.
 * Priority: owner photo > og:image > first Google photo > image_url fallback.
 */
export function getRestaurantImage(restaurant: Restaurant): string | null {
  // Priority 1: Owner-attributed Google Places photo (highest quality)
  if (restaurant.photos && restaurant.photos.length > 0) {
    const ownerPhoto = restaurant.photos.find((p) => p.is_owner_photo);
    if (ownerPhoto?.photo_reference) {
      return getPhotoProxyUrl(ownerPhoto.photo_reference);
    }
  }

  // Priority 2: og:image from restaurant website (curated hero image)
  if (restaurant.og_image_url) {
    return restaurant.og_image_url;
  }

  // Priority 3: First Google Places photo (any)
  if (restaurant.photos && restaurant.photos.length > 0) {
    const photo = restaurant.photos[0];
    if (photo.photo_reference) {
      return getPhotoProxyUrl(photo.photo_reference);
    }
    if (photo.photo_url) {
      return photo.photo_url;
    }
  }

  // Priority 4: image_url fallback
  if (restaurant.image_url) {
    if (!restaurant.image_url.startsWith('http')) {
      return getPhotoProxyUrl(restaurant.image_url);
    }
    return restaurant.image_url;
  }

  return null;
}

/**
 * Get all available photo URLs for a restaurant.
 * Includes og:image in the gallery when available.
 */
export function getRestaurantImages(restaurant: Restaurant): string[] {
  const images: string[] = [];

  // Add Google Places photos
  if (restaurant.photos && restaurant.photos.length > 0) {
    for (const photo of restaurant.photos) {
      if (photo.photo_reference) {
        images.push(getPhotoProxyUrl(photo.photo_reference));
      } else if (photo.photo_url) {
        images.push(photo.photo_url);
      }
    }
  }

  // Add og:image if not already represented
  if (restaurant.og_image_url) {
    images.push(restaurant.og_image_url);
  }

  // Fallback to image_url if nothing else
  if (images.length === 0 && restaurant.image_url) {
    images.push(restaurant.image_url);
  }

  return images;
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

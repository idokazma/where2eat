import { Restaurant } from '@/types/restaurant';
import { config } from '@/lib/config';

/**
 * A new-API Google photo reference embeds its place id: "places/<place_id>/photos/<ref>".
 * When the restaurant's google_place_id is known and the photo belongs to a
 * different place, it comes from a stale place match - skip it.
 */
function photoBelongsToRestaurant(photoReference: string, restaurant: Restaurant): boolean {
  const m = photoReference.match(/^places\/([^/]+)\//);
  if (!m) return true; // legacy reference carries no place id - cannot verify
  const pid = restaurant.google_place_id || restaurant.google_places?.place_id;
  if (!pid) return true;
  return m[1] === pid;
}

/** Photos that belong to the restaurant's current place match. */
function validPhotos(restaurant: Restaurant) {
  return (restaurant.photos || []).filter(
    (p) => !p.photo_reference || photoBelongsToRestaurant(p.photo_reference, restaurant)
  );
}

/**
 * Get the best available photo URL for a restaurant.
 * Priority: owner photo > og:image > first Google photo > image_url fallback.
 */
export function getRestaurantImage(restaurant: Restaurant): string | null {
  const photos = validPhotos(restaurant);

  // Priority 1: Owner-attributed Google Places photo (highest quality)
  if (photos.length > 0) {
    const ownerPhoto = photos.find((p) => p.is_owner_photo);
    if (ownerPhoto?.photo_reference) {
      return getPhotoProxyUrl(ownerPhoto.photo_reference);
    }
  }

  // Priority 2: First Google Places photo (any)
  if (photos.length > 0) {
    const photo = photos[0];
    if (photo.photo_reference) {
      return getPhotoProxyUrl(photo.photo_reference);
    }
    if (photo.photo_url) {
      return photo.photo_url;
    }
  }

  // Priority 3: image_url fallback
  if (restaurant.image_url) {
    if (!restaurant.image_url.startsWith('http')) {
      return getPhotoProxyUrl(restaurant.image_url);
    }
    return restaurant.image_url;
  }

  // Priority 4: og:image fallback (can be unreliable)
  if (restaurant.og_image_url) {
    return restaurant.og_image_url;
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
  const photos = validPhotos(restaurant);
  if (photos.length > 0) {
    for (const photo of photos) {
      if (photo.photo_reference) {
        images.push(getPhotoProxyUrl(photo.photo_reference));
      } else if (photo.photo_url) {
        images.push(photo.photo_url);
      }
    }
  }

  // Fallback: og:image or image_url when no Google Places photos
  if (images.length === 0) {
    if (restaurant.og_image_url) {
      images.push(restaurant.og_image_url);
    } else if (restaurant.image_url) {
      images.push(restaurant.image_url);
    }
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
  return `${base}/api/photos/${photoReference}?maxwidth=${maxWidth}`;
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

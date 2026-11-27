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

/**
 * A site's logo, icon or favicon: not a photo of the place, so never preferred over
 * a real photo. Judged by the file name only: folders lie (Ontopo keeps venue cover
 * photos under /organization/icons/<hash>), and so does the host.
 */
export function looksLikeLogo(url: string): boolean {
  try {
    const file = decodeURIComponent(new URL(url).pathname).split('/').pop() ?? '';
    return /(logo|favicon|icon|sprite|placeholder)/i.test(file);
  } catch {
    return false;
  }
}

function isGoogleCdnUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'lh3.googleusercontent.com';
  } catch {
    return false;
  }
}

/**
 * A photo we host ourselves (uploaded venue image): free per view and already
 * checked, so it wins over a Google proxy photo, which can be paused or cost money.
 */
export function ownVenueImageUrl(restaurant: Restaurant): string | null {
  const url = restaurant.image_url;
  if (!url) return null;
  try {
    const path = new URL(url, 'http://local.invalid').pathname;
    return path.startsWith('/api/venue-images/') ? url : null;
  } catch {
    return null;
  }
}

/** Photos that belong to the restaurant's current place match. */
export function validPhotos(restaurant: Restaurant) {
  return (restaurant.photos || []).filter(
    (p) => !p.photo_reference || photoBelongsToRestaurant(p.photo_reference, restaurant)
  );
}

/**
 * Get the best available photo URL for a restaurant.
 * Priority: owner photo > og:image > first Google photo > image_url fallback.
 */
export function getRestaurantImage(restaurant: Restaurant): string | null {
  // Priority 0: our own stored copies (free per view)
  const stored = getStoredPhotoUrls(restaurant);
  if (stored.length > 0) return stored[0];

  // Priority 0.5: our own uploaded venue image, before any paid Google proxy photo
  const own = ownVenueImageUrl(restaurant);
  if (own) return own;

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

  // Priority 3: image_url fallback. Signed lh3 Google CDN links expire, so a
  // working og:image wins over them (no runtime fallback if both are dead).
  if (restaurant.image_url && isGoogleCdnUrl(restaurant.image_url)) {
    const og = restaurant.og_image_url;
    if (og && !isGoogleCdnUrl(og) && !looksLikeLogo(og)) return og;
  }
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
  // Our own stored copies replace the paid Google photos entirely.
  const stored = getStoredPhotoUrls(restaurant);
  if (stored.length > 0) return stored;

  const images: string[] = [];

  // Our own uploaded venue image leads the gallery; the Google photos stay after it.
  const own = ownVenueImageUrl(restaurant);
  if (own) images.push(own);

  // Direct photo URLs only. A Google photo reference goes through the paid
  // /api/photos proxy, and a gallery would fire one paid request per thumbnail on
  // every uncached view, so references never enter the gallery (the hero image
  // still may use one, a single request).
  const photos = validPhotos(restaurant);
  for (const photo of photos) {
    if (!photo.photo_reference && photo.photo_url) {
      images.push(photo.photo_url);
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

/** URLs of the place's photos stored on our own server (free per view). */
export function getStoredPhotoUrls(restaurant: Restaurant): string[] {
  const base = config.apiUrl || '';
  return (restaurant.stored_photos || []).filter((p) => p?.path).map((p) => `${base}${p.path}`);
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

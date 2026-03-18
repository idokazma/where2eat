/**
 * Geo distance and sorting utilities.
 */

export interface GeoCoords {
  lat: number;
  lng: number;
}

export interface WithDistance<T> {
  item: T;
  distance: number; // km
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(a: GeoCoords, b: GeoCoords): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const h =
    sinDlat * sinDlat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinDlng * sinDlng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Sort items by distance from a reference point.
 * `getCoords` extracts {lat, lng} from each item (return null to exclude).
 */
export function sortByDistance<T>(
  items: T[],
  userCoords: GeoCoords,
  getCoords: (item: T) => GeoCoords | null
): WithDistance<T>[] {
  return items
    .map((item) => {
      const coords = getCoords(item);
      if (!coords) return null;
      return { item, distance: haversineDistance(userCoords, coords) };
    })
    .filter((entry): entry is WithDistance<T> => entry !== null)
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Return the N closest items to userCoords.
 */
export function getNClosest<T>(
  items: T[],
  userCoords: GeoCoords,
  getCoords: (item: T) => GeoCoords | null,
  n: number
): WithDistance<T>[] {
  return sortByDistance(items, userCoords, getCoords).slice(0, n);
}

/**
 * Compute a bounding box that contains all points.
 * Returns [southWest, northEast] as [[lat,lng],[lat,lng]].
 */
export function getBoundsForPoints(
  points: GeoCoords[]
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/**
 * Format distance for display in Hebrew UI.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} מ׳`;
  }
  return `${km.toFixed(1)} ק״מ`;
}

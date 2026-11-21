import type { Restaurant } from "@/types/restaurant";
import { getCoordinates } from "@/types/restaurant";

export const mapId = (r: Restaurant) =>
  r.google_places?.place_id || r.id || r.name_hebrew;
// Match the rest of the app, while recognizing older place-id favorites.
export const favoriteKey = (r: Restaurant) =>
  r.id || r.google_places?.place_id || r.name_hebrew;
export const isSaved = (r: Restaurant, favorites: string[]) =>
  favorites.includes(favoriteKey(r)) ||
  favorites.includes(r.google_places?.place_id || r.name_hebrew);

/** Every source a restaurant appears in: its main episode and any extra mentions. */
export function restaurantSources(r: Restaurant): string[] {
  const names = new Set<string>();
  const main = r.episode_info?.channel_name?.trim();
  if (main) names.add(main);
  for (const m of r.mentions ?? []) {
    const cn = m.channel_name?.trim();
    if (cn) names.add(cn);
  }
  return [...names];
}

export function filterMapRestaurants(
  restaurants: Restaurant[],
  query: string,
  source: string,
  cuisine: string,
  savedOnly: boolean,
  favorites: string[],
) {
  const text = query.trim().toLocaleLowerCase();
  return restaurants.filter(
    (r) =>
      getCoordinates(r.location) &&
      (!text ||
        [r.name_hebrew, r.name_english, r.cuisine_type, r.location?.city].some(
          (v) => v?.toLocaleLowerCase().includes(text),
        )) &&
      (!source || restaurantSources(r).includes(source)) &&
      (!cuisine || r.cuisine_type === cuisine) &&
      (!savedOnly || isSaved(r, favorites)),
  );
}

export interface MapGroup {
  items: Restaurant[];
  lat: number;
  lng: number;
}
/** Greedy screen-space clustering. Selected pins remain individually reachable.
 * At maximum zoom, coincident points stay grouped and are listed for selection. */
export function groupMapPoints(
  restaurants: Restaurant[],
  project: (lat: number, lng: number) => { x: number; y: number },
  selectedId?: string | null,
): MapGroup[] {
  const groups: (MapGroup & { x: number; y: number })[] = [];
  for (const r of restaurants) {
    const c = getCoordinates(r.location);
    if (!c) continue;
    const p = project(c.latitude, c.longitude);
    const group =
      mapId(r) === selectedId
        ? undefined
        : groups.find(
            (g) =>
              !g.items.some((i) => mapId(i) === selectedId) &&
              Math.hypot(g.x - p.x, g.y - p.y) < 48,
          );
    if (group) {
      const n = group.items.length;
      group.lat = (group.lat * n + c.latitude) / (n + 1);
      group.lng = (group.lng * n + c.longitude) / (n + 1);
      group.x = (group.x * n + p.x) / (n + 1);
      group.y = (group.y * n + p.y) / (n + 1);
      group.items.push(r);
    } else groups.push({ items: [r], lat: c.latitude, lng: c.longitude, ...p });
  }
  return groups;
}

/** Map previews use already stored direct images only. Do not resolve Places
 * references or call the paid photo proxy just to browse a pin. */
export function getMapPreviewImage(r: Restaurant): string | null {
  for (const value of [r.image_url, r.og_image_url]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (
        url.pathname.includes("/api/photos/") ||
        url.hostname === "places.googleapis.com" ||
        url.hostname === "maps.googleapis.com"
      )
        continue;
      return value;
    } catch {
      /* A Places reference is not a direct image URL. */
    }
  }
  return null;
}

/** Only the restaurant's stored Instagram profile, never an episode/creator link.
 * This validates the URL shape, not ownership, and does not discover accounts. */
export function getRestaurantInstagramUrl(r: Restaurant): string | null {
  if (!r.instagram_url?.trim()) return null;
  try {
    const url = new URL(r.instagram_url.trim());
    const profile = url.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/)?.[1];
    const reserved = new Set([
      "p",
      "reel",
      "reels",
      "tv",
      "stories",
      "explore",
      "accounts",
      "direct",
      "about",
      "developer",
      "legal",
      "privacy",
      "terms",
      "web",
    ]);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port ||
      !profile ||
      reserved.has(profile.toLowerCase())
    )
      return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

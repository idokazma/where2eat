/**
 * Location-ordered stories (design: docs/plans/location-stories-design.md, stage A).
 * Pure helpers: everything is computed in the browser from data the site already
 * loads. No new API. A story's first photo is always stored or a direct link
 * (free); further photos of the place go through the paid Google photo proxy and
 * are loaded only when the viewer moves to them (see the page's limit).
 */
import type { EpisodeDetail, EpisodeMention, Restaurant } from "@/types/restaurant";
import { getCoordinates } from "@/types/restaurant";
import { isListed } from "@/lib/restaurant-visibility";
import { getMapPreviewImage } from "@/lib/map-discovery";
import { haversineDistance, type GeoCoords } from "@/lib/geo-utils";
import { getPhotoProxyUrl, getStoredPhotoUrls, looksLikeLogo, validPhotos } from "@/lib/images";
import { config } from "@/lib/config";

export interface StorySlide {
  /** The restaurant record this mention belongs to (a merged duplicate may differ). */
  restaurantId: string;
  videoId: string;
  seconds: number | null;
  tasted: boolean;
  channel: string | null;
  episodeTitle: string | null;
}

export interface Story {
  restaurant: Restaurant;
  image: string;
  /** Other free, direct images of the same place, tried in order when `image` fails to load. */
  alternates: string[];
  /** Straight-line distance from the starting point; null when there is no location. */
  distanceKm: number | null;
  /** Episode upload time (ms since epoch), 0 when unknown. Never the ingestion date. */
  publishedAt: number;
  slides: StorySlide[];
}

export interface StoryPhoto {
  url: string;
  /** Loaded through the paid Google photo proxy. */
  paid: boolean;
}

/** One sideways page of a story: a photo of the place. */
export interface StoryFrame {
  photo: StoryPhoto;
}

export interface StoryFeed {
  near: Story[];
  far: Story[];
}

export interface StoryQuote {
  text: string;
  verified: boolean;
}

/** At most two sentences and `limit` characters. */
export function excerpt(text: string | null | undefined, limit = 200): string | null {
  if (!text || !text.trim()) return null;
  let t = text.split(/\s+/).join(" ").trim().replace(/^["״“”]+|["״“”]+$/g, "");
  t = t.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  if (t.length <= limit) return t;
  const cut = t.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut) + "…";
}

const TASTED = "נטעם";

/** One slide per distinct creator mention (video + second), tasted first. */
export function storySlides(r: Restaurant): StorySlide[] {
  const mainChannel = r.episode_info?.channel_name ?? null;
  const seen = new Set<string>();
  const slides: StorySlide[] = [];
  for (const m of r.mentions ?? []) {
    if (!m.video_id) continue;
    const key = `${m.video_id}@${m.timestamp_seconds ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slides.push({
      restaurantId: r.id!,
      videoId: m.video_id,
      seconds: m.timestamp_seconds ?? null,
      tasted: m.mention_level === TASTED,
      channel: m.channel_name?.trim() || mainChannel,
      episodeTitle: m.episode_title ?? null,
    });
  }
  if (!slides.length && r.episode_info?.video_id) {
    slides.push({
      restaurantId: r.id!,
      videoId: r.episode_info.video_id,
      seconds: r.mention_timestamp_seconds ?? null,
      tasted: r.mention_level === TASTED,
      channel: mainChannel,
      episodeTitle: r.episode_info.title ?? null,
    });
  }
  return slides.sort((a, b) => Number(b.tasted) - Number(a.tasted));
}

/**
 * Upper edges (km) of the distance bands the near feed is sorted in. Inside a band
 * the newest episode comes first; bands themselves go nearest to farthest.
 */
export const DISTANCE_BANDS_KM = [1, 3, 10, 50];

export function distanceBand(km: number, bands: number[] = DISTANCE_BANDS_KM): number {
  const i = bands.findIndex((edge) => km <= edge);
  return i === -1 ? bands.length : i;
}

/** Episode upload time of a record: its own published_at, else its episode's. */
export function publishedAtMs(r: Restaurant): number {
  for (const v of [r.published_at, r.episode_info?.published_at]) {
    const t = v ? Date.parse(v) : NaN;
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

const NOT_A_PHOTO = /(logo|favicon|icon|sprite|placeholder)/i;

function directImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.pathname.includes("/api/photos/") || url.hostname === "places.googleapis.com" || url.hostname === "maps.googleapis.com")
      return null;
    return value;
  } catch {
    return null;
  }
}

/**
 * Free direct images of this place, besides the story's own: stored copies, the
 * og image and free photo links. Logos and icons are not photos of the food.
 * Never the paid Google photo proxy, and never another restaurant's image.
 */
export function storyAlternateImages(r: Restaurant, primary: string): string[] {
  const out: string[] = [];
  const add = (value: string | null | undefined) => {
    const url = directImageUrl(value);
    if (!url || url === primary || out.includes(url)) return;
    let file = url;
    try {
      file = decodeURIComponent(new URL(url).pathname).split("/").pop() ?? "";
    } catch {
      /* directImageUrl already validated it */
    }
    // The file name only: folders mislead (Ontopo keeps venue cover photos under
    // /organization/icons/<hash>).
    if (NOT_A_PHOTO.test(file)) return;
    out.push(url);
  };
  getStoredPhotoUrls(r).forEach(add);
  add(r.image_url);
  add(r.og_image_url);
  for (const p of r.photos ?? []) if (!p.photo_reference) add(p.photo_url);
  return out;
}

/**
 * Stories around `origin`: within `radiusKm` by distance, the rest grouped by city.
 * Without a location (`origin` null) every listed place with a photo, newest episode first.
 */
export function buildStories(
  restaurants: Restaurant[],
  origin: GeoCoords | null,
  { radiusKm = 50, source = "" }: { radiusKm?: number; source?: string } = {},
): StoryFeed {
  // The same place is sometimes stored once per episode, which would show as two
  // identical stories. Merge only records that share a photo AND are the same
  // place: no conflicting Google place IDs and less than 100 m apart. Branches of
  // a chain often share a photo but have their own place IDs and locations.
  const byImage = new Map<string, Story[]>();
  for (const r of restaurants) {
    if (!isListed(r)) continue;
    const c = getCoordinates(r.location);
    const image = getMapPreviewImage(r);
    if (!image || (origin && !c)) continue;
    const slides = storySlides(r).filter((s) => !source || s.channel === source);
    if (!slides.length) continue;
    const story: Story = {
      restaurant: r,
      image,
      alternates: storyAlternateImages(r, image),
      distanceKm: origin && c ? haversineDistance(origin, { lat: c.latitude, lng: c.longitude }) : null,
      publishedAt: publishedAtMs(r),
      slides,
    };
    const group = byImage.get(image) ?? [];
    const twin = group.find((s) => samePlace(s.restaurant, r));
    if (!twin) {
      byImage.set(image, [...group, story]);
      continue;
    }
    const keep = (story.distanceKm ?? 0) < (twin.distanceKm ?? 0) ? story : twin;
    const other = keep === story ? twin : story;
    keep.publishedAt = Math.max(keep.publishedAt, other.publishedAt);
    const seen = new Set(keep.slides.map((s) => `${s.videoId}@${s.seconds ?? ""}`));
    const extra = other.slides.filter((s) => !seen.has(`${s.videoId}@${s.seconds ?? ""}`));
    keep.slides = [...keep.slides, ...extra].sort((a, b) => Number(b.tasted) - Number(a.tasted));
    byImage.set(image, group.map((s) => (s === twin ? keep : s)));
  }
  const stories = [...byImage.values()].flat();
  if (!origin) return { near: stories.sort((a, b) => b.publishedAt - a.publishedAt), far: [] };
  const km = (s: Story) => s.distanceKm ?? 0;
  const near = stories.filter((s) => km(s) <= radiusKm).sort(
    (a, b) => distanceBand(km(a)) - distanceBand(km(b)) || b.publishedAt - a.publishedAt || km(a) - km(b),
  );
  const far = stories
    .filter((s) => km(s) > radiusKm)
    .sort(
      (a, b) =>
        (a.restaurant.location?.city || "").localeCompare(b.restaurant.location?.city || "", "he") ||
        km(a) - km(b),
    );
  return { near, far };
}

const SAME_PLACE_KM = 0.1;

function placeId(r: Restaurant): string | null {
  return r.google_places?.place_id || (r as Restaurant & { google_place_id?: string | null }).google_place_id || null;
}

/** Two records of one place: no conflicting Google place IDs and less than 100 m apart. */
export function samePlace(a: Restaurant, b: Restaurant): boolean {
  const pa = placeId(a);
  const pb = placeId(b);
  if (pa && pb && pa !== pb) return false;
  const ca = getCoordinates(a.location);
  const cb = getCoordinates(b.location);
  if (!ca || !cb) return false;
  return (
    haversineDistance({ lat: ca.latitude, lng: ca.longitude }, { lat: cb.latitude, lng: cb.longitude }) <
    SAME_PLACE_KM
  );
}

const DISCLAIMER_RE = /דיסקליימר|disclaimer/i;

/** The quote the episode page shows for this restaurant: verified first, else the transcript. */
export function quoteFromEpisode(detail: EpisodeDetail, restaurantId: string): StoryQuote | null {
  const groups = detail?.mentions ?? {};
  for (const m of Object.values(groups).flat() as (EpisodeMention & {
    linked_restaurant_id?: string;
    verified_quote?: { text?: string } | null;
  })[]) {
    if ((m.linked_restaurant_id || m.restaurant_id) !== restaurantId) continue;
    const verified = excerpt(m.verified_quote?.text);
    if (verified) return { text: verified, verified: true };
    // Recorded words stay as spoken; a quote that is only a disclaimer is skipped, not rewritten.
    const own = (m.host_quotes ?? []).find((q) => !DISCLAIMER_RE.test(q || ""));
    const transcript = excerpt(own);
    if (transcript) return { text: transcript, verified: false };
  }
  return null;
}

/** Start a few seconds before the mention so the sentence isn't cut. */
export function momentStart(seconds: number | null | undefined): number {
  return Math.max(0, Math.floor(seconds ?? 0) - 3);
}

export function youtubeEmbedUrl(videoId: string, start: number): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?start=${start}&autoplay=1&playsinline=1&rel=0`;
}

export function youtubeMomentUrl(videoId: string, start: number): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}${start ? `&t=${start}s` : ""}`;
}

export function sourceLabel(s: Pick<StorySlide, "channel" | "episodeTitle">): string {
  const title = (s.episodeTitle || "").replace(/\s*\|.*$/, "").trim();
  const numbered = title.match(/מדברים מהבטן,?\s*(?:פרק\s*)?(\d+)/);
  if (numbered) return `מדברים מהבטן ${numbered[1]}`;
  return (s.channel || "מקור לא ידוע").replace(/\s*-\s*הפודיום$/, "");
}

export function formatClock(seconds: number | null): string | null {
  // 0 is how a mention without a recorded moment comes back: show no time, not "0:00".
  if (seconds == null || seconds <= 0) return null;
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STORY_PHOTO_WIDTH = 900;

/** Same bytes in our content-addressed storage, or the exact same external URL.
 * Do not strip arbitrary query strings: different crops/dishes may share a path.
 * This is exact identity deduplication, not a claim of visual similarity.
 */
export function storyPhotoKey(value: string): string {
  try {
    const u = new URL(value, "https://relative.invalid");
    const asset = u.pathname.match(/^\/api\/(?:venue-images|place-photos)\/([a-f0-9]{64})\.jpg$/);
    if (asset) return `sha256:${asset[1]}`;
    const proxy = u.pathname.match(/^\/api\/photos\/(.+)$/);
    if (proxy) return `google:${proxy[1]}`;
  } catch { /* Keep the original string if it cannot be parsed. */ }
  return value;
}

/** A bounded image window. Never speculate a paid request for the next frame. */
export function shouldLoadStoryFrame(
  frames: StoryFrame[], index: number, current: number,
  active: boolean, currentLoaded: boolean, granted: Set<string>,
): boolean {
  const frame = frames[index];
  if (!frame) return false;
  if (frame.photo.paid) return index === current && granted.has(frame.photo.url);
  return index === current || (active && Math.abs(index - current) === 1 &&
    (index < current || currentLoaded));
}

/** The place's photos: the free first photo, then its Google photos (paid, same place only). */
export function storyPhotos(story: Story, { extraPhotos = true }: { extraPhotos?: boolean } = {}): StoryPhoto[] {
  const photos: StoryPhoto[] = [{ url: story.image, paid: false }];
  // Our own stored copies are free per view and replace the paid Google photos.
  const stored = getStoredPhotoUrls(story.restaurant);
  if (stored.length > 0) {
    for (const url of stored) if (!photos.some((p) => p.url === url)) photos.push({ url, paid: false });
    return uniqueStoryPhotos(photos, story.restaurant);
  }
  if (!extraPhotos) return uniqueStoryPhotos(photos, story.restaurant);
  for (const p of validPhotos(story.restaurant)) {
    const photo: StoryPhoto | null = p.photo_reference
      ? { url: getPhotoProxyUrl(p.photo_reference, STORY_PHOTO_WIDTH), paid: true }
      : p.photo_url && directImageUrl(p.photo_url) && !looksLikeLogo(p.photo_url)
        ? { url: p.photo_url, paid: false }
        : null;
    if (photo && !photos.some((x) => x.url === photo.url)) photos.push(photo);
  }
  // No saved photo list yet: ask for the place's photos by position. The API fetches the
  // list once, saves it on the restaurant and caches each photo (owner decision 23.11.2026).
  const placeId = story.restaurant.google_place_id;
  if (placeId && validPhotos(story.restaurant).length === 0) {
    for (let i = 0; i < PLACE_PHOTO_SLOTS; i++) photos.push({ url: placePhotoUrl(placeId, i), paid: true });
  }
  return uniqueStoryPhotos(photos, story.restaurant);
}

/** How many photos to ask for when the place's photo list is not saved yet. */
const PLACE_PHOTO_SLOTS = 5;

function placePhotoUrl(placeId: string, index: number): string {
  return `${config.apiUrl || ""}/api/photos/place/${encodeURIComponent(placeId)}/${index}?maxwidth=${STORY_PHOTO_WIDTH}`;
}

/** Explicit recorded alias identity, including the currently displayed fallback. */
export function storyPhotoIdentity(url: string, restaurant: Restaurant): string {
  const aliases = new Map<string, Set<string>>();
  for (const p of validPhotos(restaurant)) {
    if (!p.photo_reference) continue;
    const key = storyPhotoKey(getPhotoProxyUrl(p.photo_reference, STORY_PHOTO_WIDTH));
    for (const url of [p.resolved_url, p.photo_url]) {
      if (!url) continue;
      const keys = aliases.get(url) ?? new Set<string>();
      keys.add(key);
      aliases.set(url, keys);
    }
  }
  const explicit = aliases.get(url);
  return explicit?.size === 1 ? [...explicit][0] : storyPhotoKey(url);
}

function uniqueStoryPhotos(photos: StoryPhoto[], restaurant: Restaurant): StoryPhoto[] {
  const seen = new Set<string>();
  return photos.filter((p) => {
    const key = storyPhotoIdentity(p.url, restaurant);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Retain original slot IDs, but hide any proxy alias of the current backdrop. */
export function visibleStoryFrameIndices(frames: StoryFrame[], image: string | null, restaurant: Restaurant): number[] {
  const primary = image ? storyPhotoIdentity(image, restaurant) : null;
  return frames.flatMap((f, i) => i === 0 || !primary || storyPhotoIdentity(f.photo.url, restaurant) !== primary ? [i] : []);
}

/**
 * Sideways pages of a story: one per distinct photo of the place. Reviews do not
 * add pages; they stay on the story (see StoriesView).
 */
export function storyFrames(story: Story, opts: { extraPhotos?: boolean } = {}): StoryFrame[] {
  return storyPhotos(story, opts).map((photo) => ({ photo }));
}

/**
 * Last resort before the fallback card: the place's first Google photo, through the
 * photo route that saves each Google photo on first load and serves our copy after
 * (and recovers expired references). Paid once per photo, not per view.
 */
export function storyGoogleFallback(story: Story): string[] {
  const ref = validPhotos(story.restaurant).find((p) => p.photo_reference)?.photo_reference;
  return ref ? [getPhotoProxyUrl(ref, STORY_PHOTO_WIDTH)] : [];
}

/** Link that opens the stories with this place first. */
export function storyShareUrl(origin: string, restaurantId: string): string {
  return `${origin}/?story=${encodeURIComponent(restaurantId)}`;
}

/** Message sent with a shared story: name and city, a short quote, the site name. */
export function storyShareText(r: Restaurant, quote: string | null | undefined): string {
  const title = [r.name_hebrew || r.name_english, r.location?.city].filter(Boolean).join(" · ");
  const short = excerpt(quote, 120);
  return [title, short ? `״${short}״` : null, "מצאתי ב-Where2Eat"].filter(Boolean).join("\n");
}

/**
 * A shared place first (also when it is beyond the near radius, or merged into a
 * twin record), the rest of the feed in its usual order. Unchanged when not found.
 */
export function pinStory(feed: StoryFeed, restaurantId: string): StoryFeed {
  const matches = (s: Story) => s.restaurant.id === restaurantId || s.slides.some((m) => m.restaurantId === restaurantId);
  const inNear = feed.near.find(matches);
  const inFar = inNear ? undefined : feed.far.find(matches);
  const story = inNear ?? inFar;
  if (!story) return feed;
  return {
    near: [story, ...feed.near.filter((s) => s !== story)],
    far: feed.far.filter((s) => s !== story),
  };
}

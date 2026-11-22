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
import { getPhotoProxyUrl, validPhotos } from "@/lib/images";

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
  distanceKm: number;
  slides: StorySlide[];
}

export interface StoryPhoto {
  url: string;
  /** Loaded through the paid Google photo proxy. */
  paid: boolean;
}

/** One sideways page of a story: a photo of the place, with the next creator mention, if any. */
export interface StoryFrame {
  photo: StoryPhoto;
  mention: StorySlide | null;
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

/** Stories around `origin`: within `radiusKm` by distance, the rest grouped by city. */
export function buildStories(
  restaurants: Restaurant[],
  origin: GeoCoords,
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
    if (!c || !image) continue;
    const slides = storySlides(r).filter((s) => !source || s.channel === source);
    if (!slides.length) continue;
    const story: Story = {
      restaurant: r,
      image,
      distanceKm: haversineDistance(origin, { lat: c.latitude, lng: c.longitude }),
      slides,
    };
    const group = byImage.get(image) ?? [];
    const twin = group.find((s) => samePlace(s.restaurant, r));
    if (!twin) {
      byImage.set(image, [...group, story]);
      continue;
    }
    const keep = story.distanceKm < twin.distanceKm ? story : twin;
    const other = keep === story ? twin : story;
    const seen = new Set(keep.slides.map((s) => `${s.videoId}@${s.seconds ?? ""}`));
    const extra = other.slides.filter((s) => !seen.has(`${s.videoId}@${s.seconds ?? ""}`));
    keep.slides = [...keep.slides, ...extra].sort((a, b) => Number(b.tasted) - Number(a.tasted));
    byImage.set(image, group.map((s) => (s === twin ? keep : s)));
  }
  const stories = [...byImage.values()].flat();
  const near = stories.filter((s) => s.distanceKm <= radiusKm).sort((a, b) => a.distanceKm - b.distanceKm);
  const far = stories
    .filter((s) => s.distanceKm > radiusKm)
    .sort(
      (a, b) =>
        (a.restaurant.location?.city || "").localeCompare(b.restaurant.location?.city || "", "he") ||
        a.distanceKm - b.distanceKm,
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
    const transcript = excerpt(m.host_quotes?.[0]);
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
  if (seconds == null) return null;
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const STORY_PHOTO_WIDTH = 900;

/** The place's photos: the free first photo, then its Google photos (paid, same place only). */
export function storyPhotos(story: Story, { extraPhotos = true }: { extraPhotos?: boolean } = {}): StoryPhoto[] {
  const photos: StoryPhoto[] = [{ url: story.image, paid: false }];
  if (!extraPhotos) return photos;
  for (const p of validPhotos(story.restaurant)) {
    const photo: StoryPhoto | null = p.photo_reference
      ? { url: getPhotoProxyUrl(p.photo_reference, STORY_PHOTO_WIDTH), paid: true }
      : p.photo_url && !p.photo_url.includes("/api/photos/")
        ? { url: p.photo_url, paid: false }
        : null;
    if (photo && !photos.some((x) => x.url === photo.url)) photos.push(photo);
  }
  return photos;
}

/**
 * Sideways pages of a story: one per photo, each carrying the next creator
 * mention so different sources are spread across the photos. When there are
 * more mentions than photos, the photos repeat.
 */
export function storyFrames(story: Story, opts: { extraPhotos?: boolean } = {}): StoryFrame[] {
  const photos = storyPhotos(story, opts);
  const count = Math.max(photos.length, story.slides.length);
  return Array.from({ length: count }, (_, i) => ({
    photo: photos[i % photos.length],
    mention: story.slides[i] ?? null,
  }));
}

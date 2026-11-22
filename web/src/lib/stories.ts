/**
 * Location-ordered stories (design: docs/plans/location-stories-design.md, stage A).
 * Pure helpers: everything is computed in the browser from data the site already
 * loads. No new API, no paid calls: photos are stored or direct links only.
 */
import type { EpisodeDetail, EpisodeMention, Restaurant } from "@/types/restaurant";
import { getCoordinates } from "@/types/restaurant";
import { isListed } from "@/lib/restaurant-visibility";
import { getMapPreviewImage } from "@/lib/map-discovery";
import { haversineDistance, type GeoCoords } from "@/lib/geo-utils";

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
  // Keyed by photo: the same restaurant stored twice (one record per episode)
  // shares its photo, and would otherwise show as two identical stories.
  const byImage = new Map<string, Story>();
  for (const r of restaurants) {
    if (!isListed(r)) continue;
    const c = getCoordinates(r.location);
    const image = getMapPreviewImage(r);
    if (!c || !image) continue;
    const slides = storySlides(r).filter((s) => !source || s.channel === source);
    if (!slides.length) continue;
    const story = {
      restaurant: r,
      image,
      distanceKm: haversineDistance(origin, { lat: c.latitude, lng: c.longitude }),
      slides,
    };
    const existing = byImage.get(image);
    if (!existing) {
      byImage.set(image, story);
      continue;
    }
    const keep = story.distanceKm < existing.distanceKm ? story : existing;
    const other = keep === story ? existing : story;
    const seen = new Set(keep.slides.map((s) => `${s.videoId}@${s.seconds ?? ""}`));
    const extra = other.slides.filter((s) => !seen.has(`${s.videoId}@${s.seconds ?? ""}`));
    keep.slides = [...keep.slides, ...extra].sort((a, b) => Number(b.tasted) - Number(a.tasted));
    byImage.set(image, keep);
  }
  const stories = [...byImage.values()];
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

/**
 * Server-side data loader that reads agentic extractor JSON files directly.
 * Replaces the FastAPI backend for simulation mode.
 */

import fs from 'fs';
import path from 'path';
import type {
  Restaurant,
  EpisodeSummary,
  EpisodeDetail,
  EpisodeMention,
  MenuItem,
} from '@/types/restaurant';

// --- Raw extractor types ---

interface RawExtraction {
  episode: {
    video_id: string;
    video_url: string;
    title: string;
    channel_name: string;
    published_at: string;
    hosts?: string[];
    guests?: string[];
    language: string;
    transcript_length: number;
    segment_count?: number;
    episode_id: string;
    summary: string;
  };
  extraction: {
    date: string;
    agent: string;
    total_mentions: number;
    add_to_page: number;
    reference_only: number;
    rejected: number;
  };
  restaurants: RawRestaurant[];
}

interface RawRestaurant {
  verdict: 'add_to_page' | 'reference_only' | 'rejected';
  sub_tag: string;
  name_hebrew: string;
  name_english: string;
  name_in_transcript?: string;
  google_name?: string;
  timestamp: {
    seconds: number;
    display: string;
    youtube_url: string;
  };
  location: {
    city: string | null;
    neighborhood?: string | null;
    address?: string | null;
    region?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  cuisine_type?: string;
  price_range?: string;
  status?: string;
  host_opinion?: string;
  host_quotes?: string[];
  host_comments?: string;
  dishes_mentioned?: string[];
  special_features?: string[];
  mention_context?: string;
  speaker?: string;
  google_places?: {
    place_id?: string;
    google_url?: string;
    rating?: number | null;
    review_count?: number | null;
    price_level?: number | null;
    phone?: string | null;
    website?: string | null;
    photo_url?: string | null;
    instagram_url?: string | null;
    verified?: boolean;
  };
  production_db?: {
    exists: boolean;
    id?: string | null;
  };
}

// --- Cache (dev: refresh every 5s, prod: permanent) ---

const isDev = process.env.NODE_ENV === 'development';
let cachedExtractions: RawExtraction[] | null = null;
let cachedRestaurants: Restaurant[] | null = null;
let cachedEpisodes: EpisodeSummary[] | null = null;
let cacheTimestamp = 0;
function invalidateIfStale() {
  if (isDev) {
    cachedExtractions = null;
    cachedRestaurants = null;
    cachedEpisodes = null;
  }
}

function resolveExtractorDir(): string | null {
  // web/ is cwd when running next dev
  const candidates = [
    path.resolve(process.cwd(), '..', 'agentic_extractor'),
    path.resolve(process.cwd(), 'agentic_extractor'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  // On Vercel/production, directory won't exist — return null
  return null;
}

function loadExtractions(): RawExtraction[] {
  invalidateIfStale();
  if (cachedExtractions) return cachedExtractions;

  const dir = resolveExtractorDir();
  if (!dir) {
    cachedExtractions = [];
    return cachedExtractions;
  }
  const files = fs.readdirSync(dir).filter(f => f.startsWith('episode_') && f.endsWith('_extraction.json'));

  cachedExtractions = files.map(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(content) as RawExtraction;
  });
  cacheTimestamp = Date.now();

  return cachedExtractions;
}

// --- ID generation ---

function generateId(raw: RawRestaurant): string {
  if (raw.production_db?.id) return raw.production_db.id;
  if (raw.google_places?.place_id) return raw.google_places.place_id;
  // Deterministic slug from english name
  const name = raw.name_english || raw.name_hebrew;
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Transform raw → frontend Restaurant ---

function transformRestaurant(raw: RawRestaurant, episode: RawExtraction['episode']): Restaurant {
  const id = generateId(raw);

  const menuItems: MenuItem[] = (raw.dishes_mentioned || []).map(dish => ({
    item_name: dish,
    description: '',
    price: null,
    recommendation_level: 'mentioned' as const,
  }));

  return {
    id,
    name_hebrew: raw.name_hebrew,
    name_english: raw.name_english || null,
    google_name: raw.google_name || null,
    location: {
      city: raw.location?.city || null,
      neighborhood: raw.location?.neighborhood || null,
      address: raw.location?.address || null,
      region: raw.location?.region as 'North' | 'Center' | 'South' | null,
      lat: raw.location?.latitude || undefined,
      lng: raw.location?.longitude || undefined,
    },
    cuisine_type: raw.cuisine_type || null,
    price_range: raw.price_range as Restaurant['price_range'],
    status: raw.status || null,
    host_opinion: raw.host_opinion as Restaurant['host_opinion'],
    host_comments: raw.host_comments || null,
    engaging_quote: raw.host_quotes?.[0] || null,
    host_quotes: raw.host_quotes || [],
    mention_timestamp_seconds: raw.timestamp?.seconds || null,
    menu_items: menuItems.length > 0 ? menuItems : undefined,
    special_features: raw.special_features,
    mention_context: raw.mention_context as Restaurant['mention_context'],
    mention_level: raw.sub_tag as 'נטעם' | 'הוזכר' | null,
    image_url: raw.google_places?.photo_url || null,
    rating: {
      google_rating: raw.google_places?.rating || undefined,
      total_reviews: raw.google_places?.review_count || undefined,
    },
    google_places: raw.google_places?.place_id
      ? {
          place_id: raw.google_places.place_id,
          google_name: raw.google_name || undefined,
          google_url: raw.google_places.google_url || undefined,
        }
      : undefined,
    instagram_url: raw.google_places?.instagram_url || null,
    contact_info: {
      phone: raw.google_places?.phone || null,
      website: raw.google_places?.website || null,
      hours: null,
    },
    published_at: episode.published_at || null,
    episode_info: {
      video_id: episode.video_id,
      video_url: episode.video_url,
      language: episode.language,
      analysis_date: episode.published_at,
      published_at: episode.published_at,
      title: episode.title,
      channel_name: episode.channel_name,
    },
  };
}

// --- Public API ---

export function getAllRestaurants(): Restaurant[] {
  if (cachedRestaurants) return cachedRestaurants;

  const extractions = loadExtractions();
  const byName = new Map<string, Restaurant>();

  for (const ext of extractions) {
    for (const raw of ext.restaurants) {
      if (raw.verdict !== 'add_to_page') continue;

      const restaurant = transformRestaurant(raw, ext.episode);
      const key = raw.name_hebrew;

      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, restaurant);
      } else {
        // Merge: prefer the entry with an image, then longest host_comments
        const existingHasImg = !!existing.image_url;
        const newHasImg = !!restaurant.image_url;
        const existingLen = existing.host_comments?.length || 0;
        const newLen = restaurant.host_comments?.length || 0;
        const shouldReplace = (!existingHasImg && newHasImg) ||
          (existingHasImg === newHasImg && newLen > existingLen);

        if (shouldReplace) {
          const mergedQuotes = [
            ...new Set([...(existing.host_quotes || []), ...(restaurant.host_quotes || [])]),
          ];
          restaurant.host_quotes = mergedQuotes;
          // Carry over image if new entry lacks one
          if (!restaurant.image_url && existing.image_url) {
            restaurant.image_url = existing.image_url;
          }
          if (!restaurant.google_places && existing.google_places) {
            restaurant.google_places = existing.google_places;
          }
          if (!restaurant.rating?.google_rating && existing.rating?.google_rating) {
            restaurant.rating = existing.rating;
          }
          byName.set(key, restaurant);
        } else {
          existing.host_quotes = [
            ...new Set([...(existing.host_quotes || []), ...(restaurant.host_quotes || [])]),
          ];
          // Carry over image/data from new entry if existing lacks it
          if (!existing.image_url && restaurant.image_url) {
            existing.image_url = restaurant.image_url;
          }
          if (!existing.google_places && restaurant.google_places) {
            existing.google_places = restaurant.google_places;
          }
          if (!existing.rating?.google_rating && restaurant.rating?.google_rating) {
            existing.rating = restaurant.rating;
          }
        }
      }
    }
  }

  cachedRestaurants = Array.from(byName.values()).sort((a, b) =>
    (b.published_at || '').localeCompare(a.published_at || '')
  );
  return cachedRestaurants;
}

export function getRestaurantById(id: string): Restaurant | null {
  const all = getAllRestaurants();
  const found =
    all.find(r => r.id === id) ||
    all.find(r => r.google_places?.place_id === id) ||
    all.find(r => {
      const slug = (r.name_english || r.name_hebrew)
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
        .replace(/^-|-$/g, '');
      return slug === id;
    });
  if (found) return found;

  // Also search reference_only entries across all episodes
  const extractions = loadExtractions();
  for (const ext of extractions) {
    for (const raw of ext.restaurants) {
      if (raw.verdict === 'rejected') continue;
      const rid = generateId(raw);
      const placeId = raw.google_places?.place_id;
      const slug = (raw.name_english || raw.name_hebrew)
        .toLowerCase()
        .replace(/[^a-z0-9\u0590-\u05ff]+/g, '-')
        .replace(/^-|-$/g, '');
      if (rid === id || placeId === id || slug === id) {
        return transformRestaurant(raw, ext.episode);
      }
    }
  }
  return null;
}

export function getAllEpisodes(): EpisodeSummary[] {
  if (cachedEpisodes) return cachedEpisodes;

  const extractions = loadExtractions();

  cachedEpisodes = extractions
    .map(ext => {
      const nonRejected = ext.restaurants.filter(r => r.verdict !== 'rejected');
      const addToPage = nonRejected.filter(r => r.verdict === 'add_to_page');
      const referenceOnly = nonRejected.filter(r => r.verdict === 'reference_only');

      return {
        id: ext.episode.episode_id,
        video_id: ext.episode.video_id,
        title: ext.episode.title,
        channel_name: ext.episode.channel_name,
        published_at: ext.episode.published_at,
        episode_summary: ext.episode.summary,
        thumbnail_url: `https://img.youtube.com/vi/${ext.episode.video_id}/hqdefault.jpg`,
        add_to_page_count: addToPage.length,
        reference_only_count: referenceOnly.length,
        tasted_count: addToPage.filter(r => r.sub_tag === 'נטעם').length,
        mentioned_count: addToPage.filter(r => r.sub_tag === 'הוזכר').length,
      };
    })
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

  return cachedEpisodes;
}

function transformMention(raw: RawRestaurant, videoId: string): EpisodeMention {
  return {
    id: generateId(raw),
    restaurant_id: generateId(raw),
    video_id: videoId,
    name_hebrew: raw.name_hebrew,
    name_english: raw.name_english,
    verdict: raw.verdict as 'add_to_page' | 'reference_only',
    mention_level: raw.sub_tag as 'נטעם' | 'הוזכר',
    timestamp_seconds: raw.timestamp?.seconds,
    timestamp_display: raw.timestamp?.display,
    speaker: raw.speaker,
    host_quotes: raw.host_quotes,
    host_comments: raw.host_comments,
    dishes_mentioned: raw.dishes_mentioned,
    mention_context: raw.mention_context,
    city: raw.location?.city || undefined,
    neighborhood: raw.location?.neighborhood || undefined,
    address: raw.location?.address || undefined,
    cuisine_type: raw.cuisine_type,
    price_range: raw.price_range,
    host_opinion: raw.host_opinion,
    image_url: raw.google_places?.photo_url || undefined,
    google_rating: raw.google_places?.rating || undefined,
    google_review_count: raw.google_places?.review_count || undefined,
    google_url: raw.google_places?.google_url || undefined,
    google_place_id: raw.google_places?.place_id || undefined,
    instagram_url: raw.google_places?.instagram_url || undefined,
    website: raw.google_places?.website || undefined,
    phone: raw.google_places?.phone || undefined,
    special_features: raw.special_features,
  };
}

export function getEpisodeDetail(videoId: string): EpisodeDetail | null {
  const extractions = loadExtractions();
  const ext = extractions.find(e => e.episode.video_id === videoId);
  if (!ext) return null;

  const episodes = getAllEpisodes();
  const episode = episodes.find(e => e.video_id === videoId);
  if (!episode) return null;

  const nonRejected = ext.restaurants.filter(r => r.verdict !== 'rejected');

  const tasted = nonRejected
    .filter(r => r.verdict === 'add_to_page' && r.sub_tag === 'נטעם')
    .map(r => transformMention(r, videoId));

  const mentioned = nonRejected
    .filter(r => r.verdict === 'add_to_page' && r.sub_tag === 'הוזכר')
    .map(r => transformMention(r, videoId));

  const reference_only = nonRejected
    .filter(r => r.verdict === 'reference_only')
    .map(r => transformMention(r, videoId));

  return {
    episode,
    mentions: { tasted, mentioned, reference_only },
  };
}

export interface MenuItem {
  item_name: string;
  description: string;
  price: string | null;
  recommendation_level: 'highly_recommended' | 'recommended' | 'mentioned' | 'not_recommended';
}

export interface Location {
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  region: 'North' | 'Center' | 'South' | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  // Railway API returns lat/lng directly on location
  lat?: number;
  lng?: number;
}

/**
 * Extract latitude/longitude from a location object.
 * Handles both formats: { coordinates: { latitude, longitude } } and { lat, lng }
 */
export function getCoordinates(location?: { coordinates?: { latitude: number; longitude: number }; lat?: number; lng?: number } | null): { latitude: number; longitude: number } | null {
  if (!location) return null;
  if (location.coordinates?.latitude && location.coordinates?.longitude) {
    return location.coordinates;
  }
  if (location.lat && location.lng) {
    return { latitude: location.lat, longitude: location.lng };
  }
  return null;
}

export interface ContactInfo {
  hours: string | null;
  phone: string | null;
  website: string | null;
}

export interface RestaurantPhoto {
  /** Direct URL explicitly resolved from this photo reference, when recorded. */
  resolved_url?: string | null;
  photo_reference: string;
  photo_url: string;
  width: number;
  height: number;
  is_owner_photo?: boolean;
}

export interface Restaurant {
  id?: string;
  name_hebrew: string;
  name_english?: string | null;
  google_name?: string | null;
  /** Google Places ID of the matched place, when matched. */
  google_place_id?: string | null;
  location?: Location;
  cuisine_type?: string | null;
  status?: string | null;
  price_range?: 'budget' | 'mid-range' | 'expensive' | 'not_mentioned' | null;
  host_opinion?: 'positive' | 'negative' | 'mixed' | 'neutral' | null;
  host_comments?: string | null;
  engaging_quote?: string | null;
  mention_timestamp_seconds?: number | null;
  menu_items?: MenuItem[];
  special_features?: string[];
  contact_info?: ContactInfo;
  business_news?: string | null;
  is_closing?: boolean;
  is_hidden?: boolean;
  mention_context?: 'new_opening' | 'review' | 'news' | 'recommendation' | 'comparison' | 'business_news' | null;
  episode_info?: EpisodeInfo;
  mention_timestamps?: MentionTimestamp[];
  google_places?: GooglePlacesInfo;
  rating?: Rating;
  food_trends?: string[];
  photos?: RestaurantPhoto[];
  image_url?: string | null;
  og_image_url?: string | null;
  published_at?: string | null;
  instagram_url?: string | null;
  mention_level?: 'נטעם' | 'הוזכר' | null;
  host_quotes?: string[];
  mentions?: RestaurantMention[];
  /** Truthful provenance of the curated hero image, when recorded. */
  image_credit?: string | null;
  /** Who the hero image actually belongs to; never relabelled as venue-owned. */
  image_source?: 'venue_owned' | 'venue_booking_listing' | 'venue_delivery_listing' | 'creator_owned' | 'editorial' | 'directory' | null;
  /** Copies of the place's photos served from our own server (free per view). */
  stored_photos?: StoredPhoto[];
}

export interface StoredPhoto {
  /** Path on the API server, e.g. /api/place-photos/<sha256>.jpg */
  path: string;
  width?: number | null;
  height?: number | null;
  /** Photographer credit from Google. */
  credit?: string | null;
  credit_url?: string | null;
}

export interface RestaurantMention {
  video_id: string;
  verdict?: string | null;
  timestamp_seconds?: number | null;
  timestamp_display?: string | null;
  mention_level?: string | null;
  episode_title?: string | null;
  youtube_url?: string | null;
  channel_name?: string | null;
  speaker?: string | null;
  /** Review content of this mention, kept per creator. */
  host_quotes?: string[] | null;
  host_comments?: string | null;
  /** A quote a reviewer checked against the recording (reviewer identity never served). */
  verified_quote?: { text?: string | null } | null;
  dishes_mentioned?: string[] | null;
  published_at?: string | null;
}

export interface EpisodeInfo {
  video_id: string;
  video_url: string;
  language?: string;
  analysis_date?: string;
  published_at?: string;
  title?: string | null;
  channel_name?: string | null;
  total_restaurants_found?: number;
  processing_method?: string;
}

export interface MentionTimestamp {
  timestamp: string;
  duration?: string;
  context: string;
  mention_type: 'introduction' | 'review' | 'recommendation' | 'comparison' | 'closing';
  key_points?: string[];
}

export interface GooglePlacesInfo {
  place_id?: string;
  google_name?: string;
  google_url?: string;
  enriched_at?: string;
  name_match_confidence?: number;
  potential_wrong_match?: boolean;
}

export interface Rating {
  google_rating?: number;
  total_reviews?: number;
  price_level?: number;
}

export interface PodcastData {
  episode_info: EpisodeInfo;
  restaurants: Restaurant[];
  food_trends: string[];
  episode_summary: string;
}

export interface YouTubeAnalysisRequest {
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: PodcastData;
  error?: string;
}

export interface EpisodeMention {
  id: string;
  restaurant_id?: string;
  video_id?: string;
  name_hebrew: string;
  name_english?: string;
  verdict: 'add_to_page' | 'reference_only';
  mention_level?: 'נטעם' | 'הוזכר';
  timestamp_seconds?: number;
  timestamp_display?: string;
  speaker?: string;
  host_quotes?: string[];
  host_comments?: string;
  dishes_mentioned?: string[];
  mention_context?: string;
  skip_reason?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  cuisine_type?: string;
  price_range?: string;
  host_opinion?: string;
  image_url?: string;
  google_rating?: number;
  google_review_count?: number;
  google_url?: string;
  google_place_id?: string;
  instagram_url?: string;
  website?: string;
  phone?: string;
  special_features?: string[];
  restaurant?: Restaurant;
}

export interface EpisodeSummary {
  id: string;
  video_id: string;
  title?: string;
  channel_name?: string;
  published_at?: string;
  episode_summary?: string;
  thumbnail_url?: string;
  add_to_page_count: number;
  reference_only_count: number;
  tasted_count: number;
  mentioned_count: number;
}

export interface EpisodeDetail {
  episode: EpisodeSummary;
  mentions: {
    tasted: EpisodeMention[];
    mentioned: EpisodeMention[];
    reference_only: EpisodeMention[];
  };
}
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
}

export interface ContactInfo {
  hours: string | null;
  phone: string | null;
  website: string | null;
}

export interface RestaurantPhoto {
  photo_reference: string;
  photo_url: string;
  width: number;
  height: number;
}

export interface Restaurant {
  id?: string;
  name_hebrew: string;
  name_english?: string | null;
  location?: Location;
  cuisine_type?: string | null;
  status?: 'open' | 'closed' | 'new_opening' | 'closing_soon' | 'reopening' | null;
  price_range?: 'budget' | 'mid-range' | 'expensive' | 'not_mentioned' | null;
  host_opinion?: 'positive' | 'negative' | 'mixed' | 'neutral' | null;
  host_comments?: string | null;
  engaging_quote?: string | null;
  mention_timestamp_seconds?: number | null;
  menu_items?: MenuItem[];
  special_features?: string[];
  contact_info?: ContactInfo;
  business_news?: string | null;
  mention_context?: 'new_opening' | 'review' | 'news' | 'recommendation' | 'comparison' | 'business_news' | null;
  episode_info?: EpisodeInfo;
  mention_timestamps?: MentionTimestamp[];
  google_places?: GooglePlacesInfo;
  rating?: Rating;
  food_trends?: string[];
  photos?: RestaurantPhoto[];
  image_url?: string | null;
}

export interface EpisodeInfo {
  video_id: string;
  video_url: string;
  language: string;
  analysis_date: string;
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
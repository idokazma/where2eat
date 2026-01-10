export interface MenuItem {
  item: string;
  recommendation_level: 'must_try' | 'recommended' | 'mentioned';
}

export interface Location {
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  region: 'North' | 'Center' | 'South' | null;
}

export interface ContactInfo {
  hours: string | null;
  phone: string | null;
  website: string | null;
}

export interface EpisodeInfo {
  video_id: string;
  video_url: string;
  title: string;
  channel_name: string;
  analysis_date: string;
}

export interface MentionTimestamp {
  timestamp: number;
  context: string;
}

export interface GooglePlacesInfo {
  place_id: string;
  name: string;
  formatted_address: string;
  rating: number;
  user_ratings_total: number;
  price_level: number;
  photos: string[];
}

export interface Restaurant {
  id?: string;
  name_hebrew: string;
  name_english: string | null;
  location: Location;
  cuisine_type: string;
  status: 'open' | 'closed' | 'new_opening' | 'closing_soon' | 'reopening';
  price_range: 'budget' | 'mid-range' | 'expensive' | 'not_mentioned';
  host_opinion: 'positive' | 'negative' | 'mixed' | 'neutral';
  host_comments: string;
  menu_items: MenuItem[];
  special_features: string[];
  contact_info: ContactInfo;
  business_news: string | null;
  mention_context: 'new_opening' | 'review' | 'news' | 'recommendation' | 'comparison' | 'business_news';
  episode_info?: EpisodeInfo;
  mention_timestamps?: MentionTimestamp[];
  google_places?: GooglePlacesInfo;
  rating?: {
    google_rating: number;
    total_reviews: number;
    price_level: number;
  };
  food_trends?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface RestaurantListResponse {
  restaurants: Restaurant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EditHistory {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  admin_email: string;
  admin_name: string;
  edit_type: 'create' | 'update' | 'delete' | 'approve' | 'reject';
  changes: Record<string, any>;
  timestamp: string;
}

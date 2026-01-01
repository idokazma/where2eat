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
}

export interface ContactInfo {
  hours: string | null;
  phone: string | null;
  website: string | null;
}

export interface Restaurant {
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
}

export interface EpisodeInfo {
  video_id: string;
  video_url: string;
  language: string;
  analysis_date: string;
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
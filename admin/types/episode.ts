import type { Pagination } from './common';

export interface Episode {
  id: string;
  video_id: string;
  video_url: string;
  channel_name: string | null;
  title: string | null;
  language: string;
  analysis_date: string;
  episode_summary: string | null;
  food_trends: string[];
}

export interface EpisodeRestaurant {
  id: string;
  name_hebrew: string;
  name_english: string;
  city: string;
  cuisine_type: string;
  google_rating: number;
}

export interface EpisodePagination {
  episodes: Episode[];
  pagination: Pagination;
}

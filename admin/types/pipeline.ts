import type { PipelineStatus } from './common';

export interface PipelineOverview {
  queued: number;
  processing: number;
  processed_24h: number;
  failed_24h: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
  currently_processing?: {
    id: string;
    video_id: string;
    video_title: string;
    channel_name: string;
    started_at: string;
    step: string;
  };
}

export interface PipelineStats {
  status_counts: Record<string, number>;
  avg_processing_seconds: number;
  completed_last_24h: number;
  completed_last_7d: number;
  failure_rate_percent: number;
  total_items: number;
}

export interface QueueItem {
  id: string;
  video_id: string;
  video_url: string;
  video_title: string;
  channel_name: string;
  status: PipelineStatus;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  scheduled_for: string;
  scheduled_at: string;
  discovered_at: string;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  restaurants_found: number;
  error_message: string | null;
  subscription_id?: string;
}

export interface HistoryItem {
  id: string;
  video_id: string;
  video_title: string;
  channel_name: string;
  status: 'completed' | 'failed';
  completed_at: string;
  error_message?: string;
  results?: {
    restaurants_found: number;
    processing_time_seconds: number;
  };
}

/** Per-step results stored in video_queue.processing_steps */
export interface ProcessingSteps {
  transcript?: {
    success: boolean;
    language?: string;
    length?: number;
    error?: string;
  };
  analysis?: {
    success: boolean;
    restaurants_extracted?: number;
    error?: string;
  };
  hallucination_filter?: {
    success: boolean;
    accepted?: number;
    rejected?: number;
    rejected_names?: string[];
    error?: string;
  };
  enrichment?: {
    success: boolean;
    matched?: number;
    total?: number;
    error?: string;
  };
  database?: {
    success: boolean;
    episode_id?: string;
    restaurants_saved?: number;
    error?: string;
  };
}

export interface VideoItem {
  id: string;
  video_id: string;
  video_url: string;
  video_title: string;
  channel_name: string;
  published_at: string;
  status: string;
  restaurants_found: number;
  processing_started_at: string;
  processing_completed_at: string;
  error_message: string;
  subscription_id?: string;
  processing_steps?: string | ProcessingSteps | null;
}

export interface SubscriptionDetail {
  id: string;
  source_url: string;
  source_name: string;
  source_type: string;
  source_id: string;
  is_active: boolean;
  priority: number;
  last_checked_at: string | null;
  total_videos_found: number;
  total_videos_processed: number;
  total_restaurants_found: number;
}

export interface SubscriptionVideosResponse {
  subscription: SubscriptionDetail;
  videos: VideoItem[];
  status_summary: Record<string, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface VideoDetailQueueItem {
  id: string;
  video_id: string;
  video_url: string;
  video_title: string;
  channel_name: string;
  status: PipelineStatus;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  scheduled_for: string;
  discovered_at: string;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  restaurants_found: number;
  error_message: string | null;
  error_log: Array<{
    message: string;
    timestamp: string;
    attempt: number;
  }> | null;
  episode_id: string | null;
}

export interface VideoDetail {
  queue_item: VideoDetailQueueItem;
  episode: {
    id: string;
    video_id: string;
    video_url: string;
    channel_name: string | null;
    title: string | null;
    language: string;
    analysis_date: string;
    episode_summary: string | null;
    food_trends: string[];
  } | null;
  restaurants: Array<{
    name_hebrew: string;
    name_english?: string;
    city?: string;
    cuisine_type?: string;
    host_opinion?: string;
  }>;
  transcript: string | null;
  transcript_length: number;
}

export interface VideoRestaurant {
  id: string;
  name_hebrew: string;
  name_english: string;
  city: string;
  cuisine_type: string;
  google_rating: number;
}

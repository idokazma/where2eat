/**
 * API client for Where2Eat Admin Dashboard
 */

import type {
  PipelineOverview,
  PipelineStats,
  QueueItem,
  HistoryItem,
  VideoItem,
  VideoDetail,
  VideoRestaurant,
  Pagination,
  SubscriptionDetail,
  SubscriptionVideosResponse,
} from '@/types/admin';
import type { Restaurant, RestaurantListResponse, EditHistory } from '@/types/admin/restaurant';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://where2eat-production.up.railway.app';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'editor' | 'viewer';
  is_active?: boolean;
  created_at: string;
  last_login?: string;
}

export interface LoginResponse {
  token: string;
  user: AdminUser;
}

export interface ApiError {
  error: string;
  errors?: Array<{
    msg: string;
    param: string;
  }>;
}

/**
 * Get stored auth token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

/**
 * Store auth token in localStorage
 */
export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', token);
  }
}

/**
 * Remove auth token from localStorage
 */
export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token');
  }
}

/**
 * Make authenticated API request with optional abort signal
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw data as ApiError;
  }

  return data as T;
}

/**
 * Auth API endpoints
 */
export const authApi = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const data = await apiFetch<LoginResponse>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setAuthToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
    }
  },

  async me(): Promise<AdminUser> {
    return apiFetch<AdminUser>('/api/admin/auth/me');
  },

  async refresh(): Promise<{ token: string }> {
    const data = await apiFetch<{ token: string }>('/api/admin/auth/refresh', {
      method: 'POST',
    });
    setAuthToken(data.token);
    return data;
  },

  async updateProfile(data: { name: string }): Promise<AdminUser> {
    return apiFetch<AdminUser>('/api/admin/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async changePassword(data: { current_password: string; new_password: string }): Promise<{ message: string }> {
    return apiFetch<{ message: string }>('/api/admin/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

/**
 * Users API endpoints (super_admin only)
 */
export const usersApi = {
  async list(): Promise<{ users: AdminUser[] }> {
    return apiFetch<{ users: AdminUser[] }>('/api/admin/auth/users');
  },

  async create(data: { email: string; password: string; name: string; role: string }): Promise<AdminUser> {
    return apiFetch<AdminUser>('/api/admin/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { role?: string; is_active?: boolean; name?: string }): Promise<AdminUser> {
    return apiFetch<AdminUser>(`/api/admin/auth/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

/**
 * Restaurants API endpoints
 */
export const restaurantsApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    filter?: Record<string, string>;
  }): Promise<RestaurantListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sort) queryParams.append('sort', params.sort);
    if (params?.filter) {
      Object.entries(params.filter).forEach(([key, value]) => {
        queryParams.append(`filter[${key}]`, value);
      });
    }
    const query = queryParams.toString();
    return apiFetch<RestaurantListResponse>(`/api/admin/restaurants${query ? `?${query}` : ''}`);
  },

  async get(id: string): Promise<Restaurant> {
    return apiFetch<Restaurant>(`/api/admin/restaurants/${id}`);
  },

  async create(data: Partial<Restaurant>): Promise<Restaurant> {
    return apiFetch<Restaurant>('/api/admin/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Restaurant>): Promise<Restaurant> {
    return apiFetch<Restaurant>(`/api/admin/restaurants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/restaurants/${id}`, { method: 'DELETE' });
  },

  async toggleVisibility(id: string, is_hidden: boolean): Promise<Restaurant> {
    return apiFetch<Restaurant>(`/api/admin/restaurants/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ is_hidden }),
    });
  },
};

/**
 * Analytics API endpoints
 */
export const analyticsApi = {
  async getOverview(): Promise<any> {
    return apiFetch('/api/admin/analytics/overview');
  },

  async getRestaurants(params?: { period?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    const query = queryParams.toString();
    return apiFetch(`/api/admin/analytics/restaurants${query ? `?${query}` : ''}`);
  },

  async getActivities(params?: { limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return apiFetch(`/api/admin/analytics/activities${query ? `?${query}` : ''}`);
  },

  async getSystemHealth(): Promise<any> {
    return apiFetch('/api/admin/analytics/system');
  },
};

/**
 * Videos API endpoints
 */
export const videosApi = {
  async list(): Promise<any> {
    return apiFetch('/api/admin/videos');
  },

  async process(videoUrl: string): Promise<any> {
    return apiFetch('/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({ video_url: videoUrl }),
    });
  },

  async get(id: string): Promise<any> {
    return apiFetch(`/api/admin/videos/${id}`);
  },

  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/videos/${id}`, { method: 'DELETE' });
  },
};

/**
 * Verification API types
 */
export interface VerificationResult {
  is_hallucination: boolean;
  confidence: number;
  recommendation: 'accept' | 'reject' | 'review';
  reasons: string[];
}

export interface RestaurantVerification {
  id: string;
  name_hebrew: string;
  name_english: string;
  google_name: string;
  city: string;
  cuisine_type: string;
  verification: VerificationResult;
  episode_info: {
    video_id: string;
    video_url: string;
    analysis_date: string;
  };
  mention_context: string;
  host_comments: string;
  data_completeness: {
    has_location: boolean;
    has_cuisine: boolean;
    has_google_data: boolean;
    has_photos: boolean;
    has_rating: boolean;
  };
}

export interface VerificationReport {
  generated_at: string;
  total: number;
  summary: {
    accepted: number;
    rejected: number;
    needs_review: number;
  };
  restaurants: RestaurantVerification[];
}

/**
 * Verification API endpoints
 */
export const verificationApi = {
  async getReport(): Promise<VerificationReport> {
    return apiFetch<VerificationReport>('/api/admin/verification/report');
  },

  async revalidate(): Promise<{
    message: string;
    results: {
      total: number;
      accepted: number;
      rejected: number;
      needs_review: number;
    };
    rejected_names: string[];
  }> {
    return apiFetch('/api/admin/verification/revalidate', { method: 'POST' });
  },

  async getRestaurant(id: string): Promise<{
    restaurant: {
      name_hebrew: string;
      name_english: string;
      google_name: string;
      city: string;
    };
    verification: VerificationResult;
    details: {
      mention_context: string;
      host_comments: string;
      episode_video_id: string;
      analysis_date: string;
    };
  }> {
    return apiFetch(`/api/admin/verification/restaurant/${id}`);
  },
};

/**
 * Articles API endpoints
 */
export const articlesApi = {
  async list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    author_id?: string;
    search?: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.status) queryParams.append('status', params.status);
    if (params?.author_id) queryParams.append('author_id', params.author_id);
    if (params?.search) queryParams.append('search', params.search);
    const query = queryParams.toString();
    return apiFetch(`/api/admin/articles${query ? `?${query}` : ''}`);
  },

  async get(id: string): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}`);
  },

  async create(data: any): Promise<any> {
    return apiFetch('/api/admin/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
  },

  async publish(id: string): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}/publish`, { method: 'POST' });
  },

  async unpublish(id: string): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}/unpublish`, { method: 'POST' });
  },
};

/**
 * Bulk operations API endpoints
 */
export const bulkApi = {
  async deleteRestaurants(ids: string[]): Promise<any> {
    return apiFetch('/api/admin/bulk/restaurants/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  async updateRestaurants(ids: string[], updates: any): Promise<any> {
    return apiFetch('/api/admin/bulk/restaurants/update', {
      method: 'POST',
      body: JSON.stringify({ ids, updates }),
    });
  },

  async exportRestaurants(format: 'json' | 'csv' = 'json', ids?: string[]): Promise<Blob> {
    const params = new URLSearchParams({ format });
    if (ids && ids.length > 0) {
      ids.forEach(id => params.append('ids', id));
    }
    const response = await fetch(`${API_URL}/api/admin/bulk/restaurants/export?${params}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },

  async importRestaurants(restaurants: any[]): Promise<any> {
    return apiFetch('/api/admin/bulk/restaurants/import', {
      method: 'POST',
      body: JSON.stringify({ restaurants }),
    });
  },

  async exportArticles(ids?: string[]): Promise<Blob> {
    const params = new URLSearchParams();
    if (ids && ids.length > 0) {
      ids.forEach(id => params.append('ids', id));
    }
    const response = await fetch(`${API_URL}/api/admin/bulk/articles/export?${params}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },

  async getEditHistory(filters?: { restaurant_id?: string; admin_user_id?: string; limit?: number }): Promise<{ history: EditHistory[] }> {
    const params = new URLSearchParams();
    if (filters?.restaurant_id) params.append('restaurant_id', filters.restaurant_id);
    if (filters?.admin_user_id) params.append('admin_user_id', filters.admin_user_id);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    return apiFetch<{ history: EditHistory[] }>(`/api/admin/audit/history?${params}`);
  },
};

/**
 * Subscriptions API endpoints
 */
export const subscriptionsApi = {
  async list(): Promise<any> {
    return apiFetch('/api/admin/subscriptions');
  },
  async get(id: string): Promise<any> {
    return apiFetch(`/api/admin/subscriptions/${id}`);
  },
  async add(data: { source_url: string; source_name?: string; priority?: number; check_interval_hours?: number }): Promise<any> {
    return apiFetch('/api/admin/subscriptions', { method: 'POST', body: JSON.stringify(data) });
  },
  async update(id: string, data: any): Promise<any> {
    return apiFetch(`/api/admin/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/subscriptions/${id}`, { method: 'DELETE' });
  },
  async pause(id: string): Promise<any> {
    return apiFetch(`/api/admin/subscriptions/${id}/pause`, { method: 'POST' });
  },
  async resume(id: string): Promise<any> {
    return apiFetch(`/api/admin/subscriptions/${id}/resume`, { method: 'POST' });
  },
  async check(id: string): Promise<any> {
    return apiFetch(`/api/admin/subscriptions/${id}/check`, { method: 'POST' });
  },
};

/**
 * Episodes API endpoints
 */
export const episodesApi = {
  async list(params?: { search?: string; page?: number; limit?: number }): Promise<any> {
    const qp = new URLSearchParams();
    if (params?.search) qp.append('search', params.search);
    if (params?.page) qp.append('page', params.page.toString());
    if (params?.limit) qp.append('limit', params.limit.toString());
    return apiFetch(`/api/admin/episodes?${qp}`);
  },

  async getRestaurants(episodeId: string): Promise<{ restaurants: VideoRestaurant[] }> {
    return apiFetch<{ restaurants: VideoRestaurant[] }>(`/api/admin/episodes/${episodeId}/restaurants`);
  },
};

/**
 * Pipeline API endpoints
 */
export const pipelineApi = {
  async getOverview(): Promise<{ overview: PipelineOverview }> {
    return apiFetch<{ overview: PipelineOverview }>('/api/admin/pipeline');
  },
  async getQueue(page = 1, limit = 20): Promise<{ items: QueueItem[]; queue: QueueItem[]; total: number; total_pages: number }> {
    return apiFetch(`/api/admin/pipeline/queue?page=${page}&limit=${limit}`);
  },
  async getHistory(page = 1, limit = 20): Promise<{ items: HistoryItem[]; history: HistoryItem[]; total: number; total_pages: number }> {
    return apiFetch(`/api/admin/pipeline/history?page=${page}&limit=${limit}`);
  },
  async getLogs(params?: { level?: string; event_type?: string; page?: number; limit?: number }): Promise<any> {
    const qp = new URLSearchParams();
    if (params?.level) qp.append('level', params.level);
    if (params?.event_type) qp.append('event_type', params.event_type);
    if (params?.page) qp.append('page', params.page.toString());
    if (params?.limit) qp.append('limit', params.limit.toString());
    return apiFetch(`/api/admin/pipeline/logs?${qp}`);
  },
  async getStats(): Promise<{ stats: PipelineStats }> {
    return apiFetch<{ stats: PipelineStats }>('/api/admin/pipeline/stats');
  },
  async getAllVideos(params?: { page?: number; limit?: number; status?: string; search?: string; subscription_id?: string }): Promise<{
    videos: VideoItem[];
    pagination: Pagination;
    status_summary: Record<string, number>;
  }> {
    const qp = new URLSearchParams();
    if (params?.page) qp.append('page', params.page.toString());
    if (params?.limit) qp.append('limit', (params.limit || 20).toString());
    if (params?.status && params.status !== 'all') qp.append('status', params.status);
    if (params?.search) qp.append('search', params.search);
    if (params?.subscription_id) qp.append('subscription_id', params.subscription_id);
    return apiFetch(`/api/admin/pipeline/all-videos?${qp}`);
  },
  async getSubscriptionVideos(subscriptionId: string, page = 1, limit = 20, status?: string): Promise<SubscriptionVideosResponse> {
    const qp = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status && status !== 'all') qp.append('status', status);
    return apiFetch<SubscriptionVideosResponse>(`/api/admin/pipeline/subscription/${subscriptionId}/videos?${qp}`);
  },
  async retry(id: string): Promise<any> {
    return apiFetch(`/api/admin/pipeline/${id}/retry`, { method: 'POST' });
  },
  async skip(id: string): Promise<any> {
    return apiFetch(`/api/admin/pipeline/${id}/skip`, { method: 'POST' });
  },
  async prioritize(id: string): Promise<any> {
    return apiFetch(`/api/admin/pipeline/${id}/prioritize`, { method: 'POST' });
  },
  async remove(id: string): Promise<void> {
    return apiFetch(`/api/admin/pipeline/${id}`, { method: 'DELETE' });
  },
  async retryAllFailed(): Promise<{ success: boolean; message: string; count: number }> {
    return apiFetch('/api/admin/pipeline/retry-all-failed', { method: 'POST' });
  },
  async getVideoDetail(queueId: string): Promise<VideoDetail> {
    return apiFetch<VideoDetail>(`/api/admin/pipeline/${queueId}/detail`);
  },
  async analyzeVideo(url: string): Promise<any> {
    return apiFetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  },
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    pipeline: {
      running: boolean;
      scheduler_enabled: boolean;
      next_poll_at: string | null;
      next_process_at: string | null;
      queue_depth: number;
      currently_processing: number;
    };
  }> {
    return apiFetch('/health');
  },
  // Scheduler control methods
  async schedulerStatus(): Promise<any> {
    return apiFetch('/api/admin/pipeline/scheduler/status');
  },
  async schedulerStart(): Promise<any> {
    return apiFetch('/api/admin/pipeline/scheduler/start', { method: 'POST' });
  },
  async schedulerStop(): Promise<any> {
    return apiFetch('/api/admin/pipeline/scheduler/stop', { method: 'POST' });
  },
  async schedulerPollNow(): Promise<any> {
    return apiFetch('/api/admin/pipeline/poll', { method: 'POST' });
  },
  async schedulerProcessNow(): Promise<any> {
    return apiFetch('/api/admin/pipeline/scheduler/process-now', { method: 'POST' });
  },
};

/**
 * Deep Dive API endpoints
 */
export const deepDiveApi = {
  async listEpisodes(params?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const qp = new URLSearchParams();
    if (params?.search) qp.append('search', params.search);
    if (params?.status) qp.append('status', params.status);
    if (params?.page) qp.append('page', params.page.toString());
    if (params?.limit) qp.append('limit', params.limit.toString());
    return apiFetch(`/api/admin/deepdive?${qp}`);
  },

  async getEpisodeDetail(videoId: string): Promise<any> {
    return apiFetch(`/api/admin/deepdive/${videoId}`);
  },

  async getRestaurantDetail(id: string): Promise<any> {
    return apiFetch(`/api/admin/deepdive/restaurants/${id}`);
  },

  async reprocessEpisode(videoId: string): Promise<any> {
    return apiFetch(`/api/admin/deepdive/${videoId}/reprocess`, { method: 'POST' });
  },
};

/**
 * Connection status types
 */
export type ConnectionStatus = 'healthy' | 'degraded' | 'error' | 'unavailable' | 'timeout';

export interface ConnectionTestResult {
  service: string;
  status: ConnectionStatus;
  response_time_ms: number;
  details: Record<string, any>;
}

export interface AllConnectionsResult {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, ConnectionTestResult>;
  summary: {
    total_services: number;
    healthy: number;
    degraded: number;
    error: number;
    unavailable: number;
  };
  total_time_ms: number;
  timestamp: string;
}

export interface ErrorLog {
  id: string;
  error_id: string;
  level: 'critical' | 'warning' | 'info' | 'debug';
  service: string;
  message: string;
  stack_trace?: string;
  context?: Record<string, any>;
  job_id?: string;
  video_id?: string;
  first_occurred: string;
  last_occurred: string;
  occurrence_count: number;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolved_by_name?: string;
  resolution_notes?: string;
}

export interface ErrorSummary {
  period_hours: number;
  total_errors: number;
  total_occurrences: number;
  unresolved: number;
  by_level: Record<string, { count: number; occurrences: number }>;
  by_service: Record<string, { count: number; occurrences: number }>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  backend: {
    status: string;
    checks: Record<string, boolean>;
    timestamp: string;
  };
  server: {
    uptime_seconds: number;
    uptime_formatted: string;
    memory_usage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    node_version: string;
    platform: string;
  };
  timestamp: string;
}

export interface SystemStats {
  database: {
    restaurants: number;
    episodes: number;
    active_jobs: number;
    unique_cities: number;
    unique_cuisines: number;
  };
  system: {
    memory: {
      rss_bytes: number;
      rss_mb: number;
      vms_bytes: number;
      vms_mb: number;
      percent: number;
    };
    database: {
      size_bytes: number;
      size_mb: number;
      path: string;
    };
    counts: Record<string, number>;
    timestamp: string;
  };
  timestamp: string;
}

/**
 * System API endpoints
 */
export const systemApi = {
  /**
   * Get all connection statuses
   */
  async getConnectionStatus(): Promise<AllConnectionsResult> {
    return apiFetch('/api/admin/system/connections/status');
  },

  /**
   * Test a specific service connection
   */
  async testConnection(service: string): Promise<ConnectionTestResult> {
    return apiFetch('/api/admin/system/connections/test', {
      method: 'POST',
      body: JSON.stringify({ service }),
    });
  },

  /**
   * Get connection test history
   */
  async getConnectionHistory(params?: { service?: string; limit?: number; hours?: number }): Promise<{ history: any[] }> {
    const queryParams = new URLSearchParams();
    if (params?.service) queryParams.append('service', params.service);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.hours) queryParams.append('hours', params.hours.toString());
    const query = queryParams.toString();
    return apiFetch(`/api/admin/system/connections/history${query ? `?${query}` : ''}`);
  },

  /**
   * Get API key status (super_admin only)
   */
  async getApiKeyStatus(): Promise<{ api_keys: Record<string, { configured: boolean; masked_key: string | null; env_var: string }>; timestamp: string }> {
    return apiFetch('/api/admin/system/api-keys/status');
  },

  /**
   * Get system health
   */
  async getHealth(): Promise<SystemHealth> {
    return apiFetch('/api/admin/system/health');
  },

  /**
   * Get system statistics
   */
  async getStats(): Promise<SystemStats> {
    return apiFetch('/api/admin/system/stats');
  },

  /**
   * Get system metrics history
   */
  async getMetrics(params?: { type?: string; name?: string; hours?: number; limit?: number }): Promise<{ metrics: any[] }> {
    const queryParams = new URLSearchParams();
    if (params?.type) queryParams.append('type', params.type);
    if (params?.name) queryParams.append('name', params.name);
    if (params?.hours) queryParams.append('hours', params.hours.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return apiFetch(`/api/admin/system/metrics${query ? `?${query}` : ''}`);
  },

  /**
   * Run database vacuum (super_admin only)
   */
  async runVacuum(): Promise<{ success: boolean; message: string; timestamp: string }> {
    return apiFetch('/api/admin/system/maintenance/vacuum', { method: 'POST' });
  },

  /**
   * Clear resolved errors (super_admin only)
   */
  async clearResolvedErrors(olderThanDays: number = 30): Promise<{ success: boolean; deleted: number; message: string }> {
    return apiFetch('/api/admin/system/maintenance/clear-errors', {
      method: 'POST',
      body: JSON.stringify({ olderThanDays }),
    });
  },
};

/**
 * Errors API endpoints
 */
export const errorsApi = {
  /**
   * Get error logs with filters
   */
  async list(params?: { level?: string; service?: string; resolved?: boolean; limit?: number; offset?: number }): Promise<{ errors: ErrorLog[]; total: number; limit: number; offset: number; total_pages: number }> {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append('level', params.level);
    if (params?.service) queryParams.append('service', params.service);
    if (params?.resolved !== undefined) queryParams.append('resolved', params.resolved.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    const query = queryParams.toString();
    return apiFetch(`/api/admin/system/errors${query ? `?${query}` : ''}`);
  },

  /**
   * Get error summary statistics
   */
  async getSummary(hours: number = 24): Promise<ErrorSummary> {
    return apiFetch(`/api/admin/system/errors/summary?hours=${hours}`);
  },

  /**
   * Resolve an error
   */
  async resolve(errorId: string, notes?: string): Promise<{ success: boolean; message: string }> {
    return apiFetch(`/api/admin/system/errors/${errorId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },
};

// ==================== Channel Monitoring ====================

export interface MonitoredChannel {
  id: string;
  channel_id: string;
  channel_url: string;
  channel_name: string | null;
  playlist_id: string | null;
  playlist_url: string | null;
  enabled: number;
  poll_interval_minutes: number;
  last_polled_at: string | null;
  last_video_found_at: string | null;
  total_videos_found: number;
  created_at: string;
  updated_at: string;
}

export interface QueueJob {
  id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  channel_url: string | null;
  video_url: string | null;
  progress_videos_completed: number;
  progress_videos_total: number;
  progress_videos_failed: number;
  progress_restaurants_found: number;
  current_step: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

export interface PipelineStatus {
  enabled: boolean;
  is_polling: boolean;
  is_processing: boolean;
  poll_interval_ms: number;
  process_interval_ms: number;
  last_poll_at: string | null;
  last_process_at: string | null;
  next_poll_at: string | null;
  next_process_at: string | null;
  stats: {
    polls_completed: number;
    jobs_processed: number;
    errors: number;
  };
}

export const channelsApi = {
  async list(): Promise<{ channels: MonitoredChannel[] }> {
    return apiFetch('/api/admin/channels');
  },
  async create(data: { channel_url: string; channel_name?: string; poll_interval_minutes?: number }): Promise<any> {
    return apiFetch('/api/admin/channels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async update(id: string, data: Partial<MonitoredChannel>): Promise<any> {
    return apiFetch(`/api/admin/channels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/channels/${id}`, { method: 'DELETE' });
  },
  async poll(id: string): Promise<any> {
    return apiFetch(`/api/admin/channels/${id}/poll`, { method: 'POST' });
  },
  async getVideos(id: string): Promise<any> {
    return apiFetch(`/api/admin/channels/${id}/videos`);
  },
};

export const queueApi = {
  async list(params?: { status?: string; limit?: number; offset?: number }): Promise<{ jobs: QueueJob[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    const query = queryParams.toString();
    return apiFetch(`/api/admin/queue${query ? `?${query}` : ''}`);
  },
  async stats(): Promise<QueueStats> {
    return apiFetch('/api/admin/queue/stats');
  },
  async processNext(): Promise<any> {
    return apiFetch('/api/admin/queue/process', { method: 'POST' });
  },
  async getJob(id: string): Promise<QueueJob> {
    return apiFetch(`/api/admin/queue/${id}`);
  },
  async deleteJob(id: string): Promise<void> {
    return apiFetch(`/api/admin/queue/${id}`, { method: 'DELETE' });
  },
};

// NOTE: pipelineApi is defined above with main's full implementation.
// Scheduler control methods are added here as extensions.
// Use pipelineApi.schedulerStatus(), pipelineApi.schedulerStart(), etc.

export default {
  auth: authApi,
  users: usersApi,
  restaurants: restaurantsApi,
  analytics: analyticsApi,
  articles: articlesApi,
  videos: videosApi,
  bulk: bulkApi,
  system: systemApi,
  errors: errorsApi,
  channels: channelsApi,
  queue: queueApi,
  subscriptions: subscriptionsApi,
  episodes: episodesApi,
  pipeline: pipelineApi,
  deepDive: deepDiveApi,
};

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
} from '@/types';
import type { Restaurant, RestaurantListResponse, EditHistory } from '@/types/restaurant';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  async getAllVideos(params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<{
    videos: VideoItem[];
    pagination: Pagination;
    status_summary: Record<string, number>;
  }> {
    const qp = new URLSearchParams();
    if (params?.page) qp.append('page', params.page.toString());
    if (params?.limit) qp.append('limit', (params.limit || 20).toString());
    if (params?.status && params.status !== 'all') qp.append('status', params.status);
    if (params?.search) qp.append('search', params.search);
    return apiFetch(`/api/admin/pipeline/all-videos?${qp}`);
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
};

export default {
  auth: authApi,
  users: usersApi,
  restaurants: restaurantsApi,
  analytics: analyticsApi,
  articles: articlesApi,
  videos: videosApi,
  bulk: bulkApi,
  subscriptions: subscriptionsApi,
  episodes: episodesApi,
  pipeline: pipelineApi,
};

/**
 * API client for Where2Eat Admin Dashboard
 */

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
 * Make authenticated API request
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    credentials: 'include', // Include cookies for httpOnly cookie
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
  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const data = await apiFetch<LoginResponse>('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    // Store token in localStorage
    setAuthToken(data.token);

    return data;
  },

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      await apiFetch('/api/admin/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Always clear token, even if API call fails
      clearAuthToken();
    }
  },

  /**
   * Get current user info
   */
  async me(): Promise<AdminUser> {
    return apiFetch<AdminUser>('/api/admin/auth/me');
  },

  /**
   * Refresh authentication token
   */
  async refresh(): Promise<{ token: string }> {
    const data = await apiFetch<{ token: string }>('/api/admin/auth/refresh', {
      method: 'POST',
    });

    // Update stored token
    setAuthToken(data.token);

    return data;
  },
};

/**
 * Restaurants API endpoints (to be implemented in Sprint 2)
 */
export const restaurantsApi = {
  /**
   * Get all restaurants with pagination and filters
   */
  async list(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    filter?: Record<string, string>;
  }): Promise<any> {
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
    return apiFetch(`/api/admin/restaurants${query ? `?${query}` : ''}`);
  },

  /**
   * Get restaurant by ID
   */
  async get(id: string): Promise<any> {
    return apiFetch(`/api/admin/restaurants/${id}`);
  },

  /**
   * Create new restaurant
   */
  async create(data: any): Promise<any> {
    return apiFetch('/api/admin/restaurants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update restaurant
   */
  async update(id: string, data: any): Promise<any> {
    return apiFetch(`/api/admin/restaurants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete restaurant
   */
  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/restaurants/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Analytics API endpoints
 */
export const analyticsApi = {
  /**
   * Get overview analytics
   */
  async getOverview(): Promise<any> {
    return apiFetch('/api/admin/analytics/overview');
  },

  /**
   * Get restaurant analytics
   */
  async getRestaurants(params?: { period?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.period) queryParams.append('period', params.period);
    const query = queryParams.toString();
    return apiFetch(`/api/admin/analytics/restaurants${query ? `?${query}` : ''}`);
  },

  /**
   * Get activity feed
   */
  async getActivities(params?: { limit?: number }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return apiFetch(`/api/admin/analytics/activities${query ? `?${query}` : ''}`);
  },

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<any> {
    return apiFetch('/api/admin/analytics/system');
  },
};

/**
 * Videos API endpoints
 */
export const videosApi = {
  /**
   * Get all video processing jobs
   */
  async list(): Promise<any> {
    return apiFetch('/api/admin/videos');
  },

  /**
   * Process a new YouTube video
   */
  async process(videoUrl: string): Promise<any> {
    return apiFetch('/api/admin/videos', {
      method: 'POST',
      body: JSON.stringify({ video_url: videoUrl }),
    });
  },

  /**
   * Get job details
   */
  async get(id: string): Promise<any> {
    return apiFetch(`/api/admin/videos/${id}`);
  },

  /**
   * Delete job
   */
  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/videos/${id}`, {
      method: 'DELETE',
    });
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
  /**
   * Get full verification report
   */
  async getReport(): Promise<VerificationReport> {
    return apiFetch<VerificationReport>('/api/admin/verification/report');
  },

  /**
   * Revalidate all restaurants
   */
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
    return apiFetch('/api/admin/verification/revalidate', {
      method: 'POST',
    });
  },

  /**
   * Get verification for a specific restaurant
   */
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
  /**
   * Get all articles with pagination and filters
   */
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

  /**
   * Get article by ID
   */
  async get(id: string): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}`);
  },

  /**
   * Create new article
   */
  async create(data: any): Promise<any> {
    return apiFetch('/api/admin/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update article
   */
  async update(id: string, data: any): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete article
   */
  async delete(id: string): Promise<void> {
    return apiFetch(`/api/admin/articles/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Publish article
   */
  async publish(id: string): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}/publish`, {
      method: 'POST',
    });
  },

  /**
   * Unpublish article
   */
  async unpublish(id: string): Promise<any> {
    return apiFetch(`/api/admin/articles/${id}/unpublish`, {
      method: 'POST',
    });
  },
};

/**
 * Bulk operations API endpoints
 */
export const bulkApi = {
  /**
   * Bulk delete restaurants
   */
  async deleteRestaurants(ids: string[]): Promise<any> {
    return apiFetch('/api/admin/bulk/restaurants/delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  },

  /**
   * Bulk update restaurants
   */
  async updateRestaurants(ids: string[], updates: any): Promise<any> {
    return apiFetch('/api/admin/bulk/restaurants/update', {
      method: 'POST',
      body: JSON.stringify({ ids, updates }),
    });
  },

  /**
   * Export restaurants
   */
  async exportRestaurants(format: 'json' | 'csv' = 'json', ids?: string[]): Promise<Blob> {
    const params = new URLSearchParams({ format });
    if (ids && ids.length > 0) {
      ids.forEach(id => params.append('ids', id));
    }

    const response = await fetch(`${API_URL}/api/admin/bulk/restaurants/export?${params}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  },

  /**
   * Import restaurants
   */
  async importRestaurants(restaurants: any[]): Promise<any> {
    return apiFetch('/api/admin/bulk/restaurants/import', {
      method: 'POST',
      body: JSON.stringify({ restaurants }),
    });
  },

  /**
   * Export articles
   */
  async exportArticles(ids?: string[]): Promise<Blob> {
    const params = new URLSearchParams();
    if (ids && ids.length > 0) {
      ids.forEach(id => params.append('ids', id));
    }

    const response = await fetch(`${API_URL}/api/admin/bulk/articles/export?${params}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  },

  /**
   * Get audit log / edit history
   */
  async getEditHistory(filters?: { restaurant_id?: string; admin_user_id?: string; limit?: number }): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.restaurant_id) params.append('restaurant_id', filters.restaurant_id);
    if (filters?.admin_user_id) params.append('admin_user_id', filters.admin_user_id);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await apiFetch(`/api/admin/audit/history?${params}`);
    return response;
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
 * Pipeline API endpoints
 */
export const pipelineApi = {
  async getOverview(): Promise<any> {
    return apiFetch('/api/admin/pipeline');
  },
  async getQueue(page = 1, limit = 20): Promise<any> {
    return apiFetch(`/api/admin/pipeline/queue?page=${page}&limit=${limit}`);
  },
  async getHistory(page = 1, limit = 20): Promise<any> {
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
  async getStats(): Promise<any> {
    return apiFetch('/api/admin/pipeline/stats');
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
  async getVideoDetail(queueId: string): Promise<VideoDetail> {
    return apiFetch<VideoDetail>(`/api/admin/pipeline/${queueId}/detail`);
  },
};

export interface VideoDetailQueueItem {
  id: string;
  video_id: string;
  video_url: string;
  video_title: string;
  channel_name: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
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

export default {
  auth: authApi,
  restaurants: restaurantsApi,
  analytics: analyticsApi,
  articles: articlesApi,
  videos: videosApi,
  bulk: bulkApi,
  subscriptions: subscriptionsApi,
  pipeline: pipelineApi,
};

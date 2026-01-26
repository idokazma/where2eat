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

export default {
  auth: authApi,
  restaurants: restaurantsApi,
  analytics: analyticsApi,
  articles: articlesApi,
  videos: videosApi,
  bulk: bulkApi,
  system: systemApi,
  errors: errorsApi,
};

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
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
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

export default {
  auth: authApi,
  restaurants: restaurantsApi,
};

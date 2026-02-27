/**
 * Application configuration
 *
 * API URL can be configured via environment variable NEXT_PUBLIC_API_URL.
 * Defaults to localhost:3001 for development.
 */

export const config = {
  /**
   * Backend API URL
   * In lean mode, uses Next.js API routes (empty string = same origin)
   * Set NEXT_PUBLIC_API_URL in .env.local for external API
   */
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',

  /**
   * Google Places API Key (for map functionality)
   */
  googlePlacesApiKey: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '',
};

/**
 * Get full API endpoint URL
 */
export function getApiUrl(path: string): string {
  const base = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
  const endpoint = path.startsWith('/') ? path : `/${path}`;
  return `${base}${endpoint}`;
}

/**
 * API endpoints
 */
export const endpoints = {
  restaurants: {
    list: () => getApiUrl('/api/restaurants'),
    search: (params: Record<string, string>) => {
      const query = new URLSearchParams(params).toString();
      return getApiUrl(`/api/restaurants/search?${query}`);
    },
    byId: (id: string) => getApiUrl(`/api/restaurants/${id}`),
  },
  episodes: {
    search: (params: Record<string, string>) => {
      const query = new URLSearchParams(params).toString();
      return getApiUrl(`/api/episodes/search?${query}`);
    },
  },
  analytics: {
    timeline: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return getApiUrl(`/api/analytics/timeline${query}`);
    },
    trends: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params).toString()}` : '';
      return getApiUrl(`/api/analytics/trends${query}`);
    },
  },
  places: {
    search: (query: string) => getApiUrl(`/api/places/search?query=${encodeURIComponent(query)}`),
    details: (placeId: string) => getApiUrl(`/api/places/details/${placeId}`),
  },
  analyze: {
    video: () => getApiUrl('/api/analyze'),
    channel: () => getApiUrl('/api/analyze/channel'),
  },
  jobs: {
    list: () => getApiUrl('/api/jobs'),
    status: (jobId: string) => getApiUrl(`/api/jobs/${jobId}/status`),
    results: (jobId: string) => getApiUrl(`/api/jobs/${jobId}/results`),
    cancel: (jobId: string) => getApiUrl(`/api/jobs/${jobId}`),
  },
  admin: {
    pipeline: {
      overview: () => getApiUrl('/api/admin/pipeline'),
      queue: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params).toString()}` : '';
        return getApiUrl(`/api/admin/pipeline/queue${query}`);
      },
      history: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params).toString()}` : '';
        return getApiUrl(`/api/admin/pipeline/history${query}`);
      },
      allVideos: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params).toString()}` : '';
        return getApiUrl(`/api/admin/pipeline/all-videos${query}`);
      },
      stats: () => getApiUrl('/api/admin/pipeline/stats'),
      logs: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params).toString()}` : '';
        return getApiUrl(`/api/admin/pipeline/logs${query}`);
      },
      retry: (id: string) => getApiUrl(`/api/admin/pipeline/${id}/retry`),
      skip: (id: string) => getApiUrl(`/api/admin/pipeline/${id}/skip`),
      prioritize: (id: string) => getApiUrl(`/api/admin/pipeline/${id}/prioritize`),
      remove: (id: string) => getApiUrl(`/api/admin/pipeline/${id}`),
    },
    episodes: {
      list: (params?: Record<string, string>) => {
        const query = params ? `?${new URLSearchParams(params).toString()}` : '';
        return getApiUrl(`/api/admin/episodes${query}`);
      },
      restaurants: (episodeId: string) => getApiUrl(`/api/admin/episodes/${episodeId}/restaurants`),
    },
  },
  health: () => getApiUrl('/health'),
};

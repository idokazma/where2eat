/**
 * Query key factory for TanStack Query
 */
export const queryKeys = {
  pipeline: {
    all: ['pipeline'] as const,
    overview: () => [...queryKeys.pipeline.all, 'overview'] as const,
    queue: (page: number) => [...queryKeys.pipeline.all, 'queue', page] as const,
    history: (page: number) => [...queryKeys.pipeline.all, 'history', page] as const,
    stats: () => [...queryKeys.pipeline.all, 'stats'] as const,
    logs: (params?: Record<string, unknown>) => [...queryKeys.pipeline.all, 'logs', params] as const,
    allVideos: (params?: Record<string, unknown>) => [...queryKeys.pipeline.all, 'all-videos', params] as const,
    detail: (id: string | null) => [...queryKeys.pipeline.all, 'detail', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    overview: () => [...queryKeys.analytics.all, 'overview'] as const,
    restaurants: (period: string) => [...queryKeys.analytics.all, 'restaurants', period] as const,
  },
  restaurants: {
    all: ['restaurants'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.restaurants.all, 'list', params] as const,
  },
  videos: {
    all: ['videos'] as const,
    list: () => [...queryKeys.videos.all, 'list'] as const,
  },
  episodes: {
    all: ['episodes'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.episodes.all, 'list', params] as const,
    restaurants: (id: string) => [...queryKeys.episodes.all, 'restaurants', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
  },
  deepDive: {
    all: ['deepDive'] as const,
    episodes: (params?: Record<string, unknown>) => [...queryKeys.deepDive.all, 'episodes', params] as const,
    episodeDetail: (videoId: string) => [...queryKeys.deepDive.all, 'episode', videoId] as const,
    restaurantDetail: (id: string) => [...queryKeys.deepDive.all, 'restaurant', id] as const,
  },
} as const;

/**
 * Refetch intervals for different data types
 */
export const REFETCH_INTERVALS = {
  pipeline: 10_000, // 10 seconds for active pipeline data
  pipelineHistory: 30_000, // 30 seconds for history
  allVideos: 15_000, // 15 seconds for all videos
  analytics: 30_000, // 30 seconds for analytics
  videos: 10_000, // 10 seconds for video jobs
} as const;

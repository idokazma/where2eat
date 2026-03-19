export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
  error?: string;
}

export type PipelineStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';

export type StatusFilter = 'all' | PipelineStatus;

export const STATUS_OPTIONS: readonly StatusFilter[] = ['all', 'queued', 'processing', 'completed', 'failed', 'skipped'] as const;

export const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
};

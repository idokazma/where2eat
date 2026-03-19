/**
 * Format a date string as relative time (e.g. "5m ago", "2h ago")
 */
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date string as relative scheduled time (future-aware)
 */
export function formatRelativeScheduled(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < -1440) return `${Math.round(Math.abs(diffMins) / 1440)}d ago`;
  if (diffMins < -60) return `${Math.round(Math.abs(diffMins) / 60)}h ago`;
  if (diffMins < 0) return 'overdue';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.round(diffMins / 60)}h`;
  return `${Math.round(diffMins / 1440)}d`;
}

/**
 * Format seconds as a human-readable duration (e.g. "45s", "3m", "1h 30m")
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Format seconds as compact duration (no seconds detail)
 */
export function formatDurationCompact(seconds: number): string {
  if (!seconds || seconds === 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/**
 * Format a date string to locale string
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString();
}

/**
 * Format a date string between two dates as duration
 */
export function formatProcessingDuration(startedAt: string, completedAt: string): string {
  if (!startedAt || !completedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const secs = Math.floor((end - start) / 1000);
  return formatDuration(secs);
}

/**
 * Get CSS class for priority dot color
 */
export function priorityDotClass(priority: number): string {
  if (priority >= 5) return 'bg-red-500';
  if (priority >= 4) return 'bg-orange-500';
  if (priority >= 3) return 'bg-yellow-500';
  if (priority >= 2) return 'bg-blue-400';
  return 'bg-gray-400';
}

/**
 * Get CSS class for priority color (card-style)
 */
export function priorityCardColor(priority: number): string {
  if (priority <= 2) return 'bg-red-500';
  if (priority <= 4) return 'bg-yellow-500';
  return 'bg-blue-500';
}

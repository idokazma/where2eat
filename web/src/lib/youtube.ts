/**
 * Build a YouTube URL with timestamp parameter.
 *
 * @param videoUrl - The base YouTube URL
 * @param timestampSeconds - The timestamp in seconds (optional)
 * @returns YouTube URL with timestamp if provided, otherwise the original URL
 *
 * @example
 * getTimedYouTubeUrl('https://youtube.com/watch?v=abc', 332)
 * // => 'https://youtube.com/watch?v=abc&t=332'
 *
 * getTimedYouTubeUrl('https://youtu.be/abc', 60)
 * // => 'https://youtu.be/abc?t=60'
 */
export function getTimedYouTubeUrl(videoUrl: string, timestampSeconds?: number | null): string {
  if (!timestampSeconds || timestampSeconds <= 0) return videoUrl;
  const separator = videoUrl.includes('?') ? '&' : '?';
  return `${videoUrl}${separator}t=${timestampSeconds}`;
}

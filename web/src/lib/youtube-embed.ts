/**
 * Build a YouTube embed URL from a video URL with optional timestamp.
 */
export function getYouTubeEmbedUrl(videoUrl: string, timestampSeconds?: number | null): string | null {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) return null;

  let url = `https://www.youtube.com/embed/${videoId}`;
  const params: string[] = ['rel=0', 'modestbranding=1'];

  if (timestampSeconds && timestampSeconds > 0) {
    params.push(`start=${Math.floor(timestampSeconds)}`);
  }

  return `${url}?${params.join('&')}`;
}

function extractVideoId(url: string): string | null {
  if (!url) return null;

  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=VIDEO_ID
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return longMatch[1];

  // youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/embed\/([a-zA-Z0-9_-]+)/);
  if (embedMatch) return embedMatch[1];

  return null;
}

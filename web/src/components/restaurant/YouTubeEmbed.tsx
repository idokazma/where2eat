'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

interface YouTubeEmbedProps {
  videoUrl: string;
  timestampSeconds?: number | null;
  title?: string;
  episodeDate?: string | null;
}

/**
 * Extract YouTube video ID from various URL formats.
 */
function extractVideoId(url: string): string | null {
  // https://www.youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];

  // https://youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  // https://www.youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];

  return null;
}

/**
 * Thumbnail-first YouTube embed. Shows a video thumbnail with play button;
 * on tap, replaces it with the actual iframe (autoplay enabled).
 */
export function YouTubeEmbed({ videoUrl, timestampSeconds, title, episodeDate }: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoId = extractVideoId(videoUrl);

  if (!videoId) return null;

  const startParam = timestampSeconds && timestampSeconds > 0 ? `&start=${timestampSeconds}` : '';
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${startParam}`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const timeLabel = timestampSeconds && timestampSeconds > 0
    ? `${Math.floor(timestampSeconds / 60)}:${String(timestampSeconds % 60).padStart(2, '0')}`
    : null;

  const formattedDate = episodeDate
    ? new Date(episodeDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="space-y-2">
      <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
        {isPlaying ? (
          <iframe
            src={embedUrl}
            title={title || 'YouTube video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 w-full h-full group cursor-pointer"
            aria-label="Play video"
          >
            {/* Thumbnail */}
            <img
              src={thumbnailUrl}
              alt={title || 'Video thumbnail'}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Play className="w-7 h-7 text-white fill-white ml-1" />
              </div>
            </div>

            {/* Timestamp badge */}
            {timeLabel && (
              <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                {timeLabel}
              </div>
            )}
          </button>
        )}
      </div>

      {/* Episode info below the player */}
      {(title || formattedDate) && (
        <div className="flex items-center gap-2 px-1 text-xs text-[var(--color-ink-muted)]" dir="rtl">
          {title && <span className="font-medium text-[var(--color-ink)]">{title}</span>}
          {title && formattedDate && <span>·</span>}
          {formattedDate && <span>{formattedDate}</span>}
          {timeLabel && (
            <span className="text-[var(--color-gold)] font-medium">
              מ-{timeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

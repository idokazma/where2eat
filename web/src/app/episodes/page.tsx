'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, UtensilsCrossed, MessageCircle, ChevronLeft } from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { fetchEpisodes } from '@/lib/api/episodes';
import type { EpisodeSummary } from '@/types/restaurant';

function EpisodeCard({ episode }: { episode: EpisodeSummary }) {
  const date = episode.published_at
    ? new Date(episode.published_at).toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <Link href={`/episode/${episode.video_id}`}>
      <div className="bg-[var(--color-surface)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-[var(--color-border)]">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[var(--color-ink-faint)]">
          {episode.thumbnail_url && (
            <Image
              src={episode.thumbnail_url}
              alt={episode.title || 'Episode thumbnail'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          )}
          {/* Mention count overlay */}
          <div className="absolute bottom-2 right-2 flex gap-1.5">
            {episode.tasted_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-600/90 text-white backdrop-blur-sm">
                <UtensilsCrossed className="w-3 h-3" />
                {episode.tasted_count}
              </span>
            )}
            {episode.mentioned_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-sky-600/90 text-white backdrop-blur-sm">
                <MessageCircle className="w-3 h-3" />
                {episode.mentioned_count}
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-bold text-[var(--color-ink)] line-clamp-2 text-sm leading-snug mb-1">
            {episode.title || 'פרק ללא כותרת'}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-ink-muted)]">
              {episode.channel_name}
            </span>
            {date && (
              <span className="text-xs text-[var(--color-ink-muted)]">
                {date}
              </span>
            )}
          </div>
          {/* Summary counts */}
          <div className="mt-2 flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
            <span>{episode.add_to_page_count} מסעדות</span>
            {episode.reference_only_count > 0 && (
              <span>· {episode.reference_only_count} אזכורים</span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="absolute top-1/2 left-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronLeft className="w-5 h-5 text-[var(--color-ink-muted)]" />
        </div>
      </div>
    </Link>
  );
}

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEpisodes()
      .then((data) => {
        setEpisodes(data.episodes);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <PageLayout title="פרקים" showHeader showBottomNav>
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-[var(--color-ink-muted)]">שגיאה בטעינת הפרקים</p>
            <p className="text-sm text-[var(--color-ink-faint)] mt-1">{error}</p>
          </div>
        ) : episodes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[var(--color-ink-muted)]">אין פרקים עדיין</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--color-ink-muted)] mb-4">
              {episodes.length} פרקים
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {episodes.map((episode, index) => (
                <div
                  key={episode.video_id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
                >
                  <EpisodeCard episode={episode} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

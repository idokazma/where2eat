'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  RefreshCw,
  UtensilsCrossed,
  MessageCircle,
  Play,
  ChevronDown,
  ChevronUp,
  MapPin,
  Star,
  ExternalLink,
} from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { MentionLevelBadge } from '@/components/restaurant/MentionLevelBadge';
import { RestaurantCardNew } from '@/components/restaurant/RestaurantCardNew';
import { fetchEpisodeDetail } from '@/lib/api/episodes';
import { getRestaurantImage } from '@/lib/images';
import type { EpisodeDetail, EpisodeMention, Restaurant } from '@/types/restaurant';

function MentionCard({ mention }: { mention: EpisodeMention }) {
  const youtubeUrl = mention.timestamp_seconds
    ? `https://www.youtube.com/watch?v=${mention.video_id || ''}&t=${Math.floor(mention.timestamp_seconds)}s`
    : null;

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Image if available */}
      {mention.image_url && (
        <Link href={`/restaurant/${mention.restaurant_id || mention.id}`}>
          <div className="relative aspect-[16/10] bg-[var(--color-ink-faint)]">
            <Image
              src={mention.image_url}
              alt={mention.name_hebrew}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        </Link>
      )}

      <div className="p-3">
        {/* Name + badge */}
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/restaurant/${mention.restaurant_id || mention.id}`}
            className="font-bold text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors flex-1"
          >
            {mention.name_hebrew}
          </Link>
          {mention.mention_level && (
            <MentionLevelBadge mentionLevel={mention.mention_level} />
          )}
        </div>

        {/* English name */}
        {mention.name_english && (
          <p className="text-xs text-[var(--color-ink-faint)] mb-1">{mention.name_english}</p>
        )}

        {/* Meta line */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)] mb-2 flex-wrap">
          {mention.city && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {mention.city}
            </span>
          )}
          {mention.cuisine_type && <span>· {mention.cuisine_type}</span>}
          {mention.price_range && <span>· {mention.price_range}</span>}
          {mention.google_rating && (
            <span className="flex items-center gap-0.5">
              · <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {mention.google_rating}
              {mention.google_review_count && (
                <span className="text-[var(--color-ink-faint)]">({mention.google_review_count})</span>
              )}
            </span>
          )}
        </div>

        {/* Mention context (useful for reference_only that lack quotes) */}
        {mention.mention_context && !mention.host_quotes?.length && !mention.host_comments && (
          <p className="text-sm text-[var(--color-ink-muted)] mb-2 leading-relaxed">
            {mention.mention_context}
          </p>
        )}

        {/* Host quotes */}
        {mention.host_quotes && mention.host_quotes.length > 0 && (
          <div className="mb-2">
            {mention.host_quotes.slice(0, 2).map((quote, i) => (
              <blockquote
                key={i}
                className="text-sm text-[var(--color-ink-muted)] italic border-r-2 border-[var(--color-accent)] pr-3 py-0.5 mb-1"
              >
                &ldquo;{quote}&rdquo;
              </blockquote>
            ))}
          </div>
        )}

        {/* Host comments */}
        {mention.host_comments && !mention.host_quotes?.length && (
          <p className="text-sm text-[var(--color-ink-muted)] mb-2">
            {mention.host_comments}
          </p>
        )}

        {/* Dishes */}
        {mention.dishes_mentioned && mention.dishes_mentioned.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {mention.dishes_mentioned.map((dish, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
              >
                {dish}
              </span>
            ))}
          </div>
        )}

        {/* Special features */}
        {mention.special_features && mention.special_features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {mention.special_features.map((feat, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-surface-alt,#f0f0f0)] text-[var(--color-ink-muted)]"
              >
                {feat}
              </span>
            ))}
          </div>
        )}

        {/* Links: Instagram, Website, Google Maps */}
        {(mention.instagram_url || mention.website || mention.google_url) && (
          <div className="flex items-center gap-3 mb-2 text-xs">
            {mention.instagram_url && (
              <a href={mention.instagram_url} target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />Instagram
              </a>
            )}
            {mention.website && (
              <a href={mention.website} target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />אתר
              </a>
            )}
            {mention.google_url && (
              <a href={mention.google_url} target="_blank" rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline flex items-center gap-1">
                <MapPin className="w-3 h-3" />מפה
              </a>
            )}
          </div>
        )}

        {/* Footer: speaker + timestamp */}
        <div className="flex items-center justify-between text-xs text-[var(--color-ink-faint)]">
          {mention.speaker && <span>{mention.speaker}</span>}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[var(--color-accent)] hover:underline"
            >
              <Play className="w-3 h-3" />
              {mention.timestamp_display || formatTimestamp(mention.timestamp_seconds)}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferenceItem({ mention }: { mention: EpisodeMention }) {
  const youtubeUrl = mention.timestamp_seconds
    ? `https://www.youtube.com/watch?v=${mention.video_id || ''}&t=${Math.floor(mention.timestamp_seconds)}s`
    : null;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-[var(--color-border)] last:border-b-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-[var(--color-ink)]">
          {mention.name_hebrew}
        </span>
        {mention.skip_reason && (
          <p className="text-xs text-[var(--color-ink-faint)] mt-0.5">
            {mention.skip_reason}
          </p>
        )}
      </div>
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-accent)] shrink-0"
        >
          {mention.timestamp_display || formatTimestamp(mention.timestamp_seconds)}
        </a>
      )}
    </div>
  );
}

function mentionToRestaurant(mention: EpisodeMention, episode: EpisodeDetail['episode']): Restaurant {
  return {
    id: mention.restaurant_id || mention.id,
    name_hebrew: mention.name_hebrew,
    name_english: mention.name_english || null,
    google_name: null,
    location: {
      city: mention.city || null,
      neighborhood: mention.neighborhood || null,
      address: mention.address || null,
      region: null,
    },
    cuisine_type: mention.cuisine_type || null,
    price_range: mention.price_range as Restaurant['price_range'],
    status: null,
    host_opinion: mention.host_opinion as Restaurant['host_opinion'],
    host_comments: mention.host_comments || null,
    engaging_quote: mention.host_quotes?.[0] || null,
    host_quotes: mention.host_quotes || [],
    mention_timestamp_seconds: mention.timestamp_seconds || null,
    mention_context: mention.mention_context as Restaurant['mention_context'],
    mention_level: mention.mention_level || null,
    image_url: mention.image_url || null,
    rating: {
      google_rating: mention.google_rating || undefined,
      total_reviews: mention.google_review_count || undefined,
    },
    google_places: mention.google_place_id
      ? { place_id: mention.google_place_id, google_url: mention.google_url || undefined }
      : undefined,
    instagram_url: mention.instagram_url || null,
    contact_info: {
      phone: mention.phone || null,
      website: mention.website || null,
      hours: null,
    },
    published_at: episode.published_at || null,
    episode_info: {
      video_id: mention.video_id || episode.video_id,
      video_url: `https://www.youtube.com/watch?v=${mention.video_id || episode.video_id}`,
      language: 'he',
      analysis_date: episode.published_at || undefined,
      published_at: episode.published_at || undefined,
      title: episode.title || undefined,
      channel_name: episode.channel_name || undefined,
    },
    menu_items: mention.dishes_mentioned?.map(d => ({
      item_name: d, description: '', price: null, recommendation_level: 'mentioned' as const,
    })),
    special_features: mention.special_features,
  };
}

function formatTimestamp(seconds?: number): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function EpisodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.videoId as string;

  const [data, setData] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    fetchEpisodeDetail(videoId)
      .then((detail) => {
        setData(detail);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [videoId]);

  if (loading) {
    return (
      <PageLayout title="פרק" showHeader showBottomNav>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
        </div>
      </PageLayout>
    );
  }

  if (error || !data) {
    return (
      <PageLayout title="פרק" showHeader showBottomNav>
        <div className="text-center py-20 px-4">
          <p className="text-[var(--color-ink-muted)]">שגיאה בטעינת הפרק</p>
          <p className="text-sm text-[var(--color-ink-faint)] mt-1">{error}</p>
        </div>
      </PageLayout>
    );
  }

  const { episode, mentions } = data;
  const date = episode.published_at
    ? new Date(episode.published_at).toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <PageLayout
      title={episode.title || 'פרק'}
      showHeader
      showBottomNav
         >
      {/* Hero */}
      <div className="relative aspect-video bg-[var(--color-ink-faint)]">
        {episode.thumbnail_url && (
          <Image
            src={episode.thumbnail_url}
            alt={episode.title || 'Episode'}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        )}
        {/* Play overlay */}
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-8 h-8 text-[var(--color-accent)] ml-1" />
          </div>
        </a>
      </div>

      <div className="px-4 py-4">
        {/* Episode info */}
        <h1 className="text-xl font-bold text-[var(--color-ink)] mb-1">
          {episode.title || 'פרק ללא כותרת'}
        </h1>
        <div className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)] mb-3">
          <span>{episode.channel_name}</span>
          {date && <span>· {date}</span>}
        </div>

        {episode.episode_summary && (
          <p className="text-sm text-[var(--color-ink-muted)] mb-4 leading-relaxed">
            {episode.episode_summary}
          </p>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6 text-sm">
          {mentions.tasted.length > 0 && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <UtensilsCrossed className="w-4 h-4" />
              {mentions.tasted.length} נטעמו
            </span>
          )}
          {mentions.mentioned.length > 0 && (
            <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
              <MessageCircle className="w-4 h-4" />
              {mentions.mentioned.length} הוזכרו
            </span>
          )}
          {mentions.reference_only.length > 0 && (
            <span className="text-[var(--color-ink-faint)]">
              {mentions.reference_only.length} אזכורים נוספים
            </span>
          )}
        </div>

        {/* נטעם Section */}
        {mentions.tasted.length > 0 && (
          <section className="mb-6">
            <h2 className="flex items-center gap-2 font-bold text-[var(--color-ink)] mb-3">
              <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
              נטעם בפרק
            </h2>
            <div className="space-y-4">
              {mentions.tasted.map((m) => {
                const rest = mentionToRestaurant(m, episode);
                return (
                  <RestaurantCardNew
                    key={m.id}
                    restaurant={rest}
                    imageUrl={getRestaurantImage(rest) || undefined}
                    onTap={() => router.push(`/restaurant/${m.restaurant_id || m.id}`)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* הוזכר Section */}
        {mentions.mentioned.length > 0 && (
          <section className="mb-6">
            <h2 className="flex items-center gap-2 font-bold text-[var(--color-ink)] mb-3">
              <MessageCircle className="w-5 h-5 text-sky-600" />
              הוזכר בפרק
            </h2>
            <div className="space-y-4">
              {mentions.mentioned.map((m) => {
                const rest = mentionToRestaurant(m, episode);
                return (
                  <RestaurantCardNew
                    key={m.id}
                    restaurant={rest}
                    imageUrl={getRestaurantImage(rest) || undefined}
                    onTap={() => router.push(`/restaurant/${m.restaurant_id || m.id}`)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* Reference only — collapsible */}
        {mentions.reference_only.length > 0 && (
          <section className="mb-6">
            <button
              onClick={() => setRefsOpen(!refsOpen)}
              className="flex items-center gap-2 w-full text-right font-medium text-sm text-[var(--color-ink-muted)] py-2"
            >
              {refsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              גם הוזכרו ({mentions.reference_only.length})
            </button>
            {refsOpen && (
              <div className="space-y-4 animate-fade-up">
                {mentions.reference_only.map((m) => {
                  const rest = mentionToRestaurant(m, episode);
                  return (
                    <RestaurantCardNew
                      key={m.id}
                      restaurant={rest}
                      imageUrl={getRestaurantImage(rest) || undefined}
                      onTap={() => router.push(`/restaurant/${m.restaurant_id || m.id}`)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* YouTube link */}
        <div className="text-center pt-4 border-t border-[var(--color-border)]">
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-accent)] hover:underline"
          >
            <ExternalLink className="w-4 h-4" />
            צפה בפרק המלא ביוטיוב
          </a>
        </div>
      </div>
    </PageLayout>
  );
}

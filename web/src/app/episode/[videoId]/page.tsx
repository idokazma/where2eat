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
import { getCuisineGradient } from '@/lib/images';
import type { EpisodeDetail, EpisodeMention, Restaurant } from '@/types/restaurant';

function ExpandableRestaurantItem({
  mention,
  episode,
  onNavigate,
}: {
  mention: EpisodeMention;
  episode: EpisodeDetail['episode'];
  onNavigate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rest = mentionToRestaurant(mention, episode);
  const imageUrl = getRestaurantImage(rest);
  const gradientClass = getCuisineGradient(mention.cuisine_type);

  const youtubeUrl = mention.timestamp_seconds
    ? `https://www.youtube.com/watch?v=${mention.video_id || episode.video_id}&t=${Math.floor(mention.timestamp_seconds)}s`
    : null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
      {/* Compact row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-right hover:bg-[var(--color-surface-alt,rgba(0,0,0,0.02))] transition-colors"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative bg-[var(--color-ink-faint)]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={mention.name_hebrew}
              fill
              className="object-cover"
              sizes="56px"
            />
          ) : (
            <div className={`w-full h-full ${gradientClass} flex items-center justify-center`}>
              <UtensilsCrossed className="w-5 h-5 text-white/70" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[var(--color-ink)] truncate">
              {mention.name_hebrew}
            </span>
            {mention.mention_level && (
              <MentionLevelBadge mentionLevel={mention.mention_level} />
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)] mt-0.5">
            {mention.city && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {mention.city}
              </span>
            )}
            {mention.cuisine_type && <span>· {mention.cuisine_type}</span>}
            {mention.google_rating && (
              <span className="flex items-center gap-0.5">
                · <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {mention.google_rating}
              </span>
            )}
          </div>
          {/* Short quote preview */}
          {mention.host_quotes?.[0] && !expanded && (
            <p className="text-xs text-[var(--color-ink-faint)] mt-0.5 truncate italic">
              &ldquo;{mention.host_quotes[0]}&rdquo;
            </p>
          )}
        </div>

        {/* Timestamp + chevron */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-[var(--color-ink-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--color-ink-muted)]" />
          )}
          {youtubeUrl && (
            <span className="text-[10px] text-[var(--color-accent)]">
              {mention.timestamp_display || formatTimestamp(mention.timestamp_seconds)}
            </span>
          )}
        </div>
      </button>

      {/* Expanded: full restaurant card */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] animate-fade-up">
          <RestaurantCardNew
            restaurant={rest}
            imageUrl={imageUrl || undefined}
            onTap={() => onNavigate(mention.restaurant_id || mention.id)}
          />
        </div>
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
    image_url: mention.image_url || mention.restaurant?.image_url || null,
    og_image_url: mention.restaurant?.og_image_url || null,
    photos: mention.restaurant?.photos || [],
    rating: {
      google_rating: mention.google_rating || undefined,
      total_reviews: mention.google_review_count || undefined,
    },
    google_places: mention.google_place_id
      ? { place_id: mention.google_place_id, google_url: mention.google_url || undefined }
      : mention.restaurant?.google_places,
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
            <div className="space-y-2">
              {mentions.tasted.map((m) => (
                <ExpandableRestaurantItem
                  key={m.id}
                  mention={m}
                  episode={episode}
                  onNavigate={(id) => router.push(`/restaurant/${id}`)}
                />
              ))}
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
            <div className="space-y-2">
              {mentions.mentioned.map((m) => (
                <ExpandableRestaurantItem
                  key={m.id}
                  mention={m}
                  episode={episode}
                  onNavigate={(id) => router.push(`/restaurant/${id}`)}
                />
              ))}
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
              <div className="space-y-2 animate-fade-up">
                {mentions.reference_only.map((m) => (
                  <ExpandableRestaurantItem
                    key={m.id}
                    mention={m}
                    episode={episode}
                    onNavigate={(id) => router.push(`/restaurant/${id}`)}
                  />
                ))}
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

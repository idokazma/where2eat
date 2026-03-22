'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import {
  RefreshCw,
  Search,
  Star,
  MapPin,
  ExternalLink,
  Play,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Camera,
  Calendar,
  RotateCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/admin/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RestaurantLocation {
  address?: string;
  city?: string;
  neighborhood?: string;
  region?: string;
  lat?: number;
  lng?: number;
}

interface RestaurantRating {
  google_rating?: number;
  total_ratings?: number;
}

interface GooglePlaces {
  place_id?: string;
  google_name?: string;
  google_url?: string;
}

interface EpisodeInfo {
  video_url?: string;
  video_id?: string;
  channel_name?: string;
  published_at?: string;
  analysis_date?: string;
}

interface FeedRestaurant {
  id: string;
  name_hebrew: string;
  name_english?: string;
  google_name?: string;
  cuisine_type?: string;
  price_range?: string;
  status?: string;
  is_closing?: boolean;
  is_hidden?: boolean;
  host_comments?: string;
  host_opinion?: string;
  mention_context?: string;
  location?: RestaurantLocation;
  rating?: RestaurantRating;
  google_places?: GooglePlaces;
  episode_info?: EpisodeInfo;
  photos?: Array<{ photo_reference: string }>;
  image_url?: string;
  published_at?: string;
  created_at?: string;
}

/** Patch specific restaurant fields via admin API */
async function updateRestaurant(
  id: string,
  data: Record<string, unknown>
): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/restaurants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Reprocess restaurant via Google Places enrichment */
async function reprocessRestaurant(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return apiFetch(`/api/restaurants/${id}/reprocess`, {
    method: 'POST',
  });
}

/** Toggle restaurant visibility */
async function toggleVisibility(
  id: string,
  is_hidden: boolean
): Promise<FeedRestaurant> {
  return apiFetch(`/api/admin/restaurants/${id}/visibility`, {
    method: 'PATCH',
    body: JSON.stringify({ is_hidden }),
  });
}

function getImageUrl(r: FeedRestaurant): string | null {
  if (r.image_url) return r.image_url;
  if (r.photos?.length && r.photos[0].photo_reference) {
    const ref = r.photos[0].photo_reference;
    if (ref.startsWith('http')) return ref;
    return `/api/photos/${ref}?maxwidth=400`;
  }
  return null;
}

// Cuisine gradient colors matching the consumer app
const cuisineColors: Record<string, string> = {
  'הומוס': 'bg-amber-100',
  'שווארמה': 'bg-orange-100',
  'אסייתי': 'bg-red-100',
  'איטלקי': 'bg-green-100',
  'דגים': 'bg-blue-100',
  'בשרים': 'bg-rose-100',
  'קינוחים': 'bg-pink-100',
  'קפה': 'bg-yellow-100',
};

function getCuisineColor(cuisine?: string | null): string {
  if (!cuisine) return 'bg-muted';
  for (const [key, value] of Object.entries(cuisineColors)) {
    if (cuisine.includes(key)) return value;
  }
  return 'bg-muted';
}

// How many cards to render initially / per scroll batch
const RENDER_BATCH = 20;

/** Inline editable field */
function EditableField({
  label,
  value,
  onSave,
  className = '',
}: {
  label: string;
  value: string;
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <button
        className={`group flex items-center gap-1 text-left hover:bg-muted rounded px-1 -mx-1 ${className}`}
        onClick={() => setEditing(true)}
        title={`Edit ${label}`}
      >
        <span className={value ? '' : 'text-muted-foreground italic'}>{value || `No ${label}`}</span>
        <Pencil className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-6 text-xs px-1.5 py-0"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onSave(draft); setEditing(false); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
      <button onClick={() => { onSave(draft); setEditing(false); }} className="text-green-600 hover:text-green-700">
        <Check className="size-3.5" />
      </button>
      <button onClick={() => { setDraft(value); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function AdminFeedPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // All restaurants loaded once (like user feed)
  const [allRestaurants, setAllRestaurants] = useState<FeedRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Progressive rendering
  const [renderCount, setRenderCount] = useState(RENDER_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch all restaurants once, sorted by published_at desc (same as user feed)
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        restaurants: FeedRestaurant[];
        pagination: { total: number };
      }>('/api/admin/restaurants?page=1&limit=500&sort=-published_at');
      if (data.restaurants) {
        setAllRestaurants(data.restaurants);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Reset render count when search changes
  useEffect(() => {
    setRenderCount(RENDER_BATCH);
  }, [searchQuery]);

  // Client-side search filter (instant, like user feed)
  const processedRestaurants = useMemo(() => {
    let result = allRestaurants;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.name_hebrew?.toLowerCase().includes(q) ||
          r.name_english?.toLowerCase().includes(q) ||
          r.cuisine_type?.toLowerCase().includes(q) ||
          r.host_comments?.toLowerCase().includes(q) ||
          r.location?.city?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allRestaurants, searchQuery]);

  // Progressive rendering slice
  const visibleRestaurants = useMemo(
    () => processedRestaurants.slice(0, renderCount),
    [processedRestaurants, renderCount]
  );

  const hasMore = renderCount < processedRestaurants.length;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setRenderCount((prev) => Math.min(prev + RENDER_BATCH, processedRestaurants.length));
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, processedRestaurants.length]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FeedRestaurant> }) =>
      updateRestaurant(id, data),
    onSuccess: () => {
      loadAll();
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ id, is_hidden }: { id: string; is_hidden: boolean }) =>
      toggleVisibility(id, is_hidden),
    onSuccess: () => {
      loadAll();
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => reprocessRestaurant(id),
    onSuccess: () => {
      loadAll();
    },
  });

  const handleFieldSave = (restaurantId: string, field: string, value: string) => {
    const data: Record<string, unknown> = {};
    data[field] = value;
    updateMutation.mutate({ id: restaurantId, data: data as Partial<FeedRestaurant> });
  };

  return (
    <div className="space-y-4 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feed Preview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Same restaurants users see (+ hidden) — click any field to edit, toggle visibility to hide from feed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {processedRestaurants.length} restaurants
          </span>
          <Button variant="outline" size="sm" onClick={() => loadAll()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search — instant client-side like user feed */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search restaurants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Cards */}
      {isLoading && allRestaurants.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : processedRestaurants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No restaurants found</div>
      ) : (
        <div className="space-y-3">
          {visibleRestaurants.map((r) => {
            const imageUrl = getImageUrl(r);
            const isExpanded = expandedId === r.id;
            const isHidden = !!r.is_hidden;
            const displayName = (r as any).name_english || r.name_hebrew || r.google_places?.google_name || r.google_name;
            const episodeDate = r.published_at || r.episode_info?.published_at || r.episode_info?.analysis_date;

            return (
              <div
                key={r.id}
                className={`border rounded-xl overflow-hidden transition-all bg-white ${
                  isHidden ? 'opacity-60 border-dashed border-red-300 bg-red-50/30' : ''
                }`}
              >
                {/* Card — mimics consumer layout */}
                <div className="flex gap-0">
                  {/* Image */}
                  <div className="relative w-32 h-32 shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full ${getCuisineColor(r.cuisine_type)} flex items-center justify-center`}>
                        <span className="text-xs text-muted-foreground">{r.cuisine_type || 'Restaurant'}</span>
                      </div>
                    )}
                    {isHidden && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <EyeOff className="size-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Name — editable */}
                        <div className="font-semibold text-sm">
                          <EditableField
                            label="name"
                            value={displayName}
                            onSave={(val) => handleFieldSave(r.id, 'name_hebrew', val)}
                          />
                        </div>

                        {/* Meta line */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <EditableField
                            label="city"
                            value={r.location?.city || ''}
                            onSave={(val) => handleFieldSave(r.id, 'city', val)}
                            className="text-xs"
                          />
                          {r.cuisine_type && (
                            <>
                              <span className="text-muted-foreground/50">·</span>
                              <EditableField
                                label="cuisine"
                                value={r.cuisine_type}
                                onSave={(val) => handleFieldSave(r.id, 'cuisine_type', val)}
                                className="text-xs"
                              />
                            </>
                          )}
                          {r.rating?.google_rating != null && r.rating.google_rating > 0 && (
                            <>
                              <span className="text-muted-foreground/50">·</span>
                              <span className="flex items-center gap-0.5">
                                <Star className="size-3 fill-yellow-400 text-yellow-400" />
                                {r.rating.google_rating.toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Episode date */}
                        {episodeDate && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
                            <Calendar className="size-2.5" />
                            {new Date(episodeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}

                        {/* Quote */}
                        {r.host_comments && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                            &ldquo;{r.host_comments}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => visibilityMutation.mutate({ id: r.id, is_hidden: !isHidden })}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isHidden
                              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                          title={isHidden ? 'Show in feed' : 'Hide from feed'}
                        >
                          {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                          title="Edit details"
                        >
                          {isExpanded ? <ChevronUp className="size-3.5" /> : <Pencil className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Hebrew Name</span>
                        <EditableField label="Hebrew name" value={r.name_hebrew} onSave={(val) => handleFieldSave(r.id, 'name_hebrew', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">English Name</span>
                        <EditableField label="English name" value={r.name_english || ''} onSave={(val) => handleFieldSave(r.id, 'name_english', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">City</span>
                        <EditableField label="city" value={r.location?.city || ''} onSave={(val) => handleFieldSave(r.id, 'city', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Neighborhood</span>
                        <EditableField label="neighborhood" value={r.location?.neighborhood || ''} onSave={(val) => handleFieldSave(r.id, 'neighborhood', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Address</span>
                        <EditableField label="address" value={r.location?.address || ''} onSave={(val) => handleFieldSave(r.id, 'address', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Cuisine</span>
                        <EditableField label="cuisine" value={r.cuisine_type || ''} onSave={(val) => handleFieldSave(r.id, 'cuisine_type', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Price Range</span>
                        <EditableField label="price" value={r.price_range || ''} onSave={(val) => handleFieldSave(r.id, 'price_range', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Google Name</span>
                        <EditableField label="Google name" value={r.google_name || ''} onSave={(val) => handleFieldSave(r.id, 'google_name', val)} />
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Instagram URL</span>
                        <EditableField label="Instagram" value={(r as any).instagram_url || ''} onSave={(val) => handleFieldSave(r.id, 'instagram_url', val)} />
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground block mb-0.5">Host Quote</span>
                        <EditableField label="host comments" value={r.host_comments || ''} onSave={(val) => handleFieldSave(r.id, 'host_comments', val)} />
                      </div>
                    </div>

                    {/* Links & Actions */}
                    <div className="flex items-center gap-3 mt-3 pt-2 border-t">
                      {r.episode_info?.video_url && (
                        <a
                          href={r.episode_info.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Play className="size-3" /> Watch Episode
                        </a>
                      )}
                      {r.google_places?.google_url && (
                        <a
                          href={r.google_places.google_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <MapPin className="size-3" /> Google Maps
                        </a>
                      )}
                      <button
                        onClick={() => reprocessMutation.mutate(r.id)}
                        disabled={reprocessMutation.isPending}
                        className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 hover:underline disabled:opacity-50 ml-auto"
                        title="Re-run Google Places enrichment to refresh images, rating, and location"
                      >
                        <RotateCw className={`size-3 ${reprocessMutation.isPending ? 'animate-spin' : ''}`} />
                        Reprocess
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Sentinel for infinite scroll */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              <RefreshCw className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

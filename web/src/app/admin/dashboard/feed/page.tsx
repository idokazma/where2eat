'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

/** Fetch restaurants from the public API (same as consumer feed) */
async function fetchFeedRestaurants(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ restaurants: FeedRestaurant[]; total_pages: number; total: number }> {
  const qp = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  });
  if (params.search) qp.append('search', params.search);
  return apiFetch(`/api/restaurants/search?${qp}`);
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
  if (!cuisine) return 'bg-gray-100';
  for (const [key, value] of Object.entries(cuisineColors)) {
    if (cuisine.includes(key)) return value;
  }
  return 'bg-gray-100';
}

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
        className={`group flex items-center gap-1 text-left hover:bg-gray-50 rounded px-1 -mx-1 ${className}`}
        onClick={() => setEditing(true)}
        title={`Edit ${label}`}
      >
        <span className={value ? '' : 'text-gray-400 italic'}>{value || `No ${label}`}</span>
        <Pencil className="size-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
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
      <button onClick={() => { setDraft(value); setEditing(false); }} className="text-gray-400 hover:text-gray-600">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function AdminFeedPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-feed', page, search],
    queryFn: () => fetchFeedRestaurants({ page, limit: 20, search: search || undefined }),
  });

  const restaurants = data?.restaurants ?? [];
  const totalPages = data?.total_pages ?? 1;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FeedRestaurant> }) =>
      updateRestaurant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feed'] });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ id, is_hidden }: { id: string; is_hidden: boolean }) =>
      toggleVisibility(id, is_hidden),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feed'] });
    },
  });

  const handleFieldSave = (restaurantId: string, field: string, value: string) => {
    const data: Record<string, unknown> = {};

    // Handle nested fields
    if (field === 'city' || field === 'neighborhood' || field === 'address') {
      data[field] = value;
    } else {
      data[field] = value;
    }

    updateMutation.mutate({ id: restaurantId, data: data as Partial<FeedRestaurant> });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(draftSearch);
  };

  return (
    <div className="space-y-4 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feed Preview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Same restaurants users see — click any field to edit, toggle visibility to hide from feed
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`size-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
          <Input
            placeholder="Search restaurants..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="h-9">Search</Button>
        {search && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setDraftSearch(''); setSearch(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </form>

      {/* Cards */}
      {isLoading && restaurants.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="size-6 animate-spin text-gray-400" />
        </div>
      ) : restaurants.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No restaurants found</div>
      ) : (
        <div className="space-y-3">
          {restaurants.map((r) => {
            const imageUrl = getImageUrl(r);
            const isExpanded = expandedId === r.id;
            const isHidden = !!r.is_hidden;
            const displayName = r.google_places?.google_name || r.google_name || r.name_hebrew;
            const episodeDate = r.published_at || r.episode_info?.published_at || r.episode_info?.analysis_date;

            return (
              <div
                key={r.id}
                className={`border rounded-xl overflow-hidden transition-all ${
                  isHidden ? 'opacity-50 border-dashed' : 'border-gray-200'
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
                        <span className="text-xs text-gray-500">{r.cuisine_type || 'Restaurant'}</span>
                      </div>
                    )}
                    {isHidden && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                        <EyeOff className="size-5 text-gray-500" />
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
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 flex-wrap">
                          <EditableField
                            label="city"
                            value={r.location?.city || ''}
                            onSave={(val) => handleFieldSave(r.id, 'city', val)}
                            className="text-xs"
                          />
                          {r.cuisine_type && (
                            <>
                              <span className="text-gray-300">·</span>
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
                              <span className="text-gray-300">·</span>
                              <span className="flex items-center gap-0.5">
                                <Star className="size-3 fill-yellow-400 text-yellow-400" />
                                {r.rating.google_rating.toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Episode date */}
                        {episodeDate && (
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                            <Calendar className="size-2.5" />
                            {new Date(episodeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        )}

                        {/* Quote */}
                        {r.host_comments && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2 italic">
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
                              ? 'bg-red-50 text-red-500 hover:bg-red-100'
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                          title={isHidden ? 'Show in feed' : 'Hide from feed'}
                        >
                          {isHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
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
                  <div className="border-t bg-gray-50/50 px-4 py-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Hebrew Name</span>
                        <EditableField label="Hebrew name" value={r.name_hebrew} onSave={(val) => handleFieldSave(r.id, 'name_hebrew', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">English Name</span>
                        <EditableField label="English name" value={r.name_english || ''} onSave={(val) => handleFieldSave(r.id, 'name_english', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">City</span>
                        <EditableField label="city" value={r.location?.city || ''} onSave={(val) => handleFieldSave(r.id, 'city', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Neighborhood</span>
                        <EditableField label="neighborhood" value={r.location?.neighborhood || ''} onSave={(val) => handleFieldSave(r.id, 'neighborhood', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Address</span>
                        <EditableField label="address" value={r.location?.address || ''} onSave={(val) => handleFieldSave(r.id, 'address', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Cuisine</span>
                        <EditableField label="cuisine" value={r.cuisine_type || ''} onSave={(val) => handleFieldSave(r.id, 'cuisine_type', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Price Range</span>
                        <EditableField label="price" value={r.price_range || ''} onSave={(val) => handleFieldSave(r.id, 'price_range', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Google Name</span>
                        <EditableField label="Google name" value={r.google_name || ''} onSave={(val) => handleFieldSave(r.id, 'google_name', val)} />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Instagram URL</span>
                        <EditableField label="Instagram" value={(r as any).instagram_url || ''} onSave={(val) => handleFieldSave(r.id, 'instagram_url', val)} />
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block mb-0.5">Host Quote</span>
                        <EditableField label="host comments" value={r.host_comments || ''} onSave={(val) => handleFieldSave(r.id, 'host_comments', val)} />
                      </div>
                    </div>

                    {/* Links */}
                    <div className="flex gap-3 mt-3 pt-2 border-t border-gray-200">
                      {r.episode_info?.video_url && (
                        <a
                          href={r.episode_info.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Play className="size-3" /> Watch Episode
                        </a>
                      )}
                      {r.google_places?.google_url && (
                        <a
                          href={r.google_places.google_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <MapPin className="size-3" /> Google Maps
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
} from 'lucide-react';
import { pipelineApi, episodesApi } from '@/lib/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/constants';
import { formatRelativeTime, formatProcessingDuration } from '@/lib/formatters';
import type { VideoItem, VideoRestaurant, StatusFilter } from '@/types';
import { STATUS_OPTIONS, STATUS_COLORS } from '@/types/common';

export function AllVideosTable() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restaurantCache, setRestaurantCache] = useState<Record<string, VideoRestaurant[]>>({});
  const [loadingRestaurantsFor, setLoadingRestaurantsFor] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.pipeline.allVideos({ page: currentPage, status: statusFilter, search: searchQuery }),
    queryFn: () => pipelineApi.getAllVideos({ page: currentPage, limit: 20, status: statusFilter, search: searchQuery }),
    refetchInterval: REFETCH_INTERVALS.allVideos,
  });

  const items = data?.videos ?? [];
  const pagination = data?.pagination ?? null;
  const statusSummary = data?.status_summary ?? {};
  const totalAll = Object.values(statusSummary).reduce((a, b) => a + b, 0);

  const loadRestaurantsForItem = async (item: VideoItem) => {
    if (restaurantCache[item.id]) return;
    if (!item.video_id) return;

    setLoadingRestaurantsFor(item.id);
    try {
      const episodesData = await episodesApi.list({ search: item.video_id, limit: 5, page: 1 });
      const episode = episodesData.episodes?.find(
        (ep: { video_id: string }) => ep.video_id === item.video_id
      );

      if (episode) {
        const restaurantsData = await episodesApi.getRestaurants(episode.id);
        setRestaurantCache((prev) => ({
          ...prev,
          [item.id]: restaurantsData.restaurants ?? [],
        }));
      } else {
        setRestaurantCache((prev) => ({ ...prev, [item.id]: [] }));
      }
    } catch {
      setRestaurantCache((prev) => ({ ...prev, [item.id]: [] }));
    } finally {
      setLoadingRestaurantsFor(null);
    }
  };

  const toggleExpand = (item: VideoItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
    } else {
      setExpandedId(item.id);
      loadRestaurantsForItem(item);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchQuery(draftSearch);
  };

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          All Videos
          {pagination && (
            <span className="ml-2 text-foreground font-bold">{pagination.total}</span>
          )}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-6 w-6 p-0"
          title="Refresh"
          disabled={isLoading}
        >
          <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search title or channel..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="h-7 px-2 text-xs">
          Search
        </Button>
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setDraftSearch('');
              setSearchQuery('');
              setCurrentPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {STATUS_OPTIONS.map((s) => {
          const count = s === 'all' ? totalAll : (statusSummary[s] ?? 0);
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              <span className={`tabular-nums ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border rounded-md">
          {searchQuery || statusFilter !== 'all'
            ? 'No results for that filter'
            : 'No videos yet'}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                  Title
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden md:table-cell">
                  Channel
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground hidden sm:table-cell w-20">
                  Published
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-20">
                  Status
                </th>
                <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">
                  Rest.
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <Fragment key={item.id}>
                  <tr
                    className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                      idx % 2 === 0 ? '' : 'bg-muted/10'
                    } ${expandedId === item.id ? 'bg-muted/20' : ''}`}
                    onClick={() => toggleExpand(item)}
                  >
                    <td className="px-2 py-1.5 max-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">
                          {item.video_title || item.video_id || 'Untitled'}
                        </span>
                        {item.video_url && (
                          <a
                            href={item.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            title="View on YouTube"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      {item.channel_name || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {formatRelativeTime(item.published_at)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`font-semibold tabular-nums ${
                          item.restaurants_found > 0 ? 'text-green-600' : 'text-muted-foreground'
                        }`}
                      >
                        {item.restaurants_found ?? 0}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {expandedId === item.id ? (
                        <ChevronUp className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === item.id && (
                    <tr className="border-b bg-muted/10">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-2">
                          <div>
                            <span className="text-muted-foreground">Published: </span>
                            <span>
                              {item.published_at
                                ? new Date(item.published_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Analyzed: </span>
                            <span>
                              {item.processing_completed_at
                                ? formatRelativeTime(item.processing_completed_at)
                                : '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Duration: </span>
                            <span>
                              {formatProcessingDuration(item.processing_started_at, item.processing_completed_at)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status: </span>
                            <span
                              className={`font-medium ${STATUS_COLORS[item.status]?.split(' ')[1] ?? ''}`}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {item.error_message && (
                          <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1 mb-2">
                            {item.error_message}
                          </div>
                        )}

                        {item.status === 'completed' && (
                          <>
                            {loadingRestaurantsFor === item.id ? (
                              <div className="flex items-center gap-2 py-2">
                                <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  Loading restaurants...
                                </span>
                              </div>
                            ) : (restaurantCache[item.id]?.length ?? 0) === 0 ? (
                              <p className="text-xs text-muted-foreground py-1">
                                No restaurants found for this video
                              </p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left pb-1 pr-3 font-medium">Name</th>
                                    <th className="text-left pb-1 pr-3 font-medium hidden sm:table-cell">
                                      City
                                    </th>
                                    <th className="text-left pb-1 pr-3 font-medium hidden md:table-cell">
                                      Cuisine
                                    </th>
                                    <th className="text-left pb-1 font-medium w-12">Rating</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {restaurantCache[item.id].map((r) => (
                                    <tr key={r.id} className="border-t border-border/40">
                                      <td className="py-1 pr-3 font-medium">
                                        {r.name_hebrew || r.name_english || '—'}
                                        {r.name_hebrew && r.name_english && (
                                          <span className="text-muted-foreground font-normal ml-1">
                                            ({r.name_english})
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-1 pr-3 text-muted-foreground hidden sm:table-cell">
                                        {r.city || '—'}
                                      </td>
                                      <td className="py-1 pr-3 text-muted-foreground hidden md:table-cell">
                                        {r.cuisine_type || '—'}
                                      </td>
                                      <td className="py-1">
                                        {r.google_rating > 0 ? (
                                          <span className="flex items-center gap-0.5 text-muted-foreground">
                                            <Star className="size-3 fill-yellow-400 text-yellow-400" />
                                            {r.google_rating.toFixed(1)}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between mt-2 pt-2">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={currentPage >= pagination.total_pages || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

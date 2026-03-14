'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deepDiveApi } from '@/lib/api';
import { queryKeys } from '@/lib/constants';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Microscope,
  Search,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EpisodeDetailDialog } from '@/components/deepdive/episode-detail-dialog';
import { STATUS_COLORS } from '@/types/common';
import { formatDate } from '@/lib/formatters';

// ---- Types -----------------------------------------------------------------------

type StatusFilter = 'all' | 'completed' | 'failed' | 'queued' | 'processing' | 'skipped';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'skipped', label: 'Skipped' },
];

// ---- Episodes Table --------------------------------------------------------------

function EpisodesTab() {
  const [draftSearch, setDraftSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.deepDive.episodes({
      page: currentPage,
      status: statusFilter,
      search: searchQuery,
    }),
    queryFn: () =>
      deepDiveApi.listEpisodes({
        page: currentPage,
        limit: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      }),
  });

  const items = data?.episodes ?? [];
  const pagination = data?.pagination ?? null;

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setCurrentPage(1);
      setSearchQuery(draftSearch);
    },
    [draftSearch]
  );

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or channel..."
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
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

        <div className="flex gap-2 shrink-0">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          {searchQuery || statusFilter !== 'all'
            ? 'No episodes match your filters'
            : 'No episodes found'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">
                  Channel
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-28">
                  Status
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-24 hidden sm:table-cell">
                  Restaurants
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32 hidden lg:table-cell">
                  Analysis Date
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, idx: number) => {
                const status = item.queue_status ?? 'unknown';
                return (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                      idx % 2 === 1 ? 'bg-muted/10' : ''
                    }`}
                    onClick={() => setSelectedVideoId(item.video_id)}
                  >
                    <td className="px-4 py-3 max-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {item.title || item.video_id || 'Untitled'}
                        </span>
                        {item.video_url && (
                          <a
                            href={item.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            title="View on YouTube"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                      {item.channel_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span
                        className={`font-semibold tabular-nums ${
                          (item.restaurants_found ?? 0) > 0 ? 'text-green-600' : 'text-muted-foreground'
                        }`}
                      >
                        {item.restaurants_found ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell whitespace-nowrap">
                      {item.analysis_date
                        ? formatDate(item.analysis_date)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVideoId(item.video_id);
                        }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages}
            {pagination.total > 0 && (
              <span className="ml-1 text-muted-foreground/60">
                ({pagination.total.toLocaleString()} total)
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.total_pages || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Episode detail dialog */}
      <EpisodeDetailDialog
        videoId={selectedVideoId}
        onClose={() => setSelectedVideoId(null)}
      />
    </div>
  );
}

// ---- Page -----------------------------------------------------------------------

export default function DeepDivePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
          <Microscope className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deep Dive</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Inspect processing pipeline, prompts, and AI responses for each episode
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="episodes">
        <TabsList>
          <TabsTrigger value="episodes">Episodes</TabsTrigger>
          <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
        </TabsList>

        <TabsContent value="episodes" className="mt-4">
          <EpisodesTab />
        </TabsContent>

        <TabsContent value="restaurants" className="mt-4">
          <div className="border rounded-lg p-8 text-center text-muted-foreground space-y-2">
            <p className="font-medium">Select an episode first</p>
            <p className="text-sm">
              Click any episode in the Episodes tab to inspect its restaurants, prompts, and pipeline
              state.
            </p>
            <p className="text-sm">
              To browse all restaurants, visit the{' '}
              <a href="/dashboard/restaurants" className="text-primary hover:underline">
                Restaurants
              </a>{' '}
              page.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

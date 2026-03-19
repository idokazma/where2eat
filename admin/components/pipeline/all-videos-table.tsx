'use client';

import { useState, Fragment, useMemo } from 'react';
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
  Rss,
  FileText,
  Brain,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Loader2,
  Shield,
  Database as DatabaseIcon,
} from 'lucide-react';
import { pipelineApi, episodesApi } from '@/lib/api';
import { queryKeys, REFETCH_INTERVALS } from '@/lib/constants';
import { formatRelativeTime, formatProcessingDuration } from '@/lib/formatters';
import type { VideoItem, VideoRestaurant, StatusFilter, ProcessingSteps } from '@/types';
import { STATUS_OPTIONS, STATUS_COLORS } from '@/types/common';

/**
 * Parse processing_steps — may be a JSON string or already an object.
 */
function parseSteps(item: VideoItem): ProcessingSteps | null {
  if (!item.processing_steps) return null;
  if (typeof item.processing_steps === 'string') {
    try {
      return JSON.parse(item.processing_steps) as ProcessingSteps;
    } catch {
      return null;
    }
  }
  return item.processing_steps as ProcessingSteps;
}

/**
 * Step indicator showing which pipeline stages a video has completed.
 * Uses actual processing_steps data when available, falls back to heuristics.
 */
function StepIndicator({ item }: { item: VideoItem }) {
  const status = item.status;
  const steps = getSteps(status, item);

  return (
    <div className="flex items-center gap-0.5" title={steps.tooltip}>
      {steps.icons.map((step, i) => (
        <div key={i} className={`flex items-center ${i > 0 ? '' : ''}`}>
          {i > 0 && <div className={`w-1 h-px ${step.done ? 'bg-green-400' : 'bg-border'}`} />}
          <div
            className={`size-4 flex items-center justify-center rounded-full ${step.className}`}
            title={step.label}
          >
            {step.icon}
          </div>
        </div>
      ))}
    </div>
  );
}

function getSteps(status: string, item: VideoItem) {
  const hasRestaurants = (item.restaurants_found ?? 0) > 0;
  const ps = parseSteps(item);

  type StepDef = { icon: React.ReactNode; label: string; done: boolean; className: string };

  const doneClass = 'bg-green-100 text-green-600';
  const failClass = 'bg-red-100 text-red-600';
  const pendingClass = 'bg-gray-100 text-gray-300';
  const activeClass = 'bg-yellow-100 text-yellow-600';

  // If we have processing_steps data, use it directly
  if (ps && status === 'completed') {
    const transcriptOk = ps.transcript?.success !== false;
    const analysisOk = ps.analysis?.success !== false;
    const filterOk = ps.hallucination_filter?.success !== false;
    const enrichOk = ps.enrichment?.success !== false;

    const icons: StepDef[] = [
      { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
      { icon: <FileText className="size-2.5" />, label: `Transcript${ps.transcript?.language ? ` (${ps.transcript.language})` : ''}`, done: transcriptOk, className: transcriptOk ? doneClass : failClass },
      { icon: <Brain className="size-2.5" />, label: `Analyzed${ps.analysis?.restaurants_extracted != null ? ` (${ps.analysis.restaurants_extracted} extracted)` : ''}`, done: analysisOk, className: analysisOk ? doneClass : failClass },
      { icon: <MapPin className="size-2.5" />, label: `Enriched${ps.enrichment?.matched != null ? ` (${ps.enrichment.matched}/${ps.enrichment.total})` : ''}`, done: enrichOk && hasRestaurants, className: (enrichOk && hasRestaurants) ? doneClass : 'bg-gray-100 text-gray-400' },
    ];

    const parts: string[] = [];
    if (ps.analysis?.restaurants_extracted != null) parts.push(`${ps.analysis.restaurants_extracted} extracted`);
    if (ps.hallucination_filter?.rejected != null && ps.hallucination_filter.rejected > 0) parts.push(`${ps.hallucination_filter.rejected} filtered`);
    parts.push(`${item.restaurants_found ?? 0} saved`);

    return { icons, tooltip: `Completed: ${parts.join(' → ')}` };
  }

  if (ps && status === 'failed') {
    const transcriptOk = ps.transcript?.success === true;
    const analysisOk = ps.analysis?.success === true;

    const icons: StepDef[] = [
      { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
      { icon: transcriptOk ? <FileText className="size-2.5" /> : <XCircle className="size-2.5" />, label: 'Transcript', done: transcriptOk, className: transcriptOk ? doneClass : failClass },
      { icon: analysisOk ? <Brain className="size-2.5" /> : <XCircle className="size-2.5" />, label: 'Analysis', done: analysisOk, className: analysisOk ? doneClass : (transcriptOk ? failClass : pendingClass) },
      { icon: <MapPin className="size-2.5" />, label: 'Enrichment', done: false, className: pendingClass },
    ];
    return { icons, tooltip: `Failed: ${item.error_message || 'Unknown error'}` };
  }

  // Heuristic fallback for old records without processing_steps
  if (status === 'completed') {
    const icons: StepDef[] = [
      { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
      { icon: <FileText className="size-2.5" />, label: 'Transcript', done: true, className: doneClass },
      { icon: <Brain className="size-2.5" />, label: 'Analyzed', done: true, className: doneClass },
      { icon: <MapPin className="size-2.5" />, label: 'Enriched', done: hasRestaurants, className: hasRestaurants ? doneClass : 'bg-gray-100 text-gray-400' },
    ];
    return {
      icons,
      tooltip: hasRestaurants
        ? `Completed: ${item.restaurants_found} restaurants found`
        : 'Completed: no restaurants found',
    };
  }

  if (status === 'processing') {
    const icons: StepDef[] = [
      { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
      { icon: <Loader2 className="size-2.5 animate-spin" />, label: 'Processing...', done: false, className: activeClass },
      { icon: <Brain className="size-2.5" />, label: 'Analyzing', done: false, className: pendingClass },
      { icon: <MapPin className="size-2.5" />, label: 'Enrichment', done: false, className: pendingClass },
    ];
    return { icons, tooltip: 'Currently processing...' };
  }

  if (status === 'failed') {
    const icons: StepDef[] = [
      { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
      { icon: <XCircle className="size-2.5" />, label: 'Failed', done: false, className: failClass },
      { icon: <Brain className="size-2.5" />, label: 'Analyzing', done: false, className: pendingClass },
      { icon: <MapPin className="size-2.5" />, label: 'Enrichment', done: false, className: pendingClass },
    ];
    return { icons, tooltip: `Failed: ${item.error_message || 'Unknown error'}` };
  }

  if (status === 'skipped') {
    const icons: StepDef[] = [
      { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
      { icon: <SkipForward className="size-2.5" />, label: 'Skipped', done: false, className: 'bg-gray-100 text-gray-400' },
      { icon: <Brain className="size-2.5" />, label: 'Analyzing', done: false, className: pendingClass },
      { icon: <MapPin className="size-2.5" />, label: 'Enrichment', done: false, className: pendingClass },
    ];
    return { icons, tooltip: 'Skipped' };
  }

  // queued (default)
  const icons: StepDef[] = [
    { icon: <Rss className="size-2.5" />, label: 'Fetched', done: true, className: doneClass },
    { icon: <Clock className="size-2.5" />, label: 'Queued', done: false, className: 'bg-blue-100 text-blue-600' },
    { icon: <Brain className="size-2.5" />, label: 'Analyzing', done: false, className: pendingClass },
    { icon: <MapPin className="size-2.5" />, label: 'Enrichment', done: false, className: pendingClass },
  ];
  return { icons, tooltip: 'Queued for processing' };
}

/**
 * Status badge with icon
 */
function StatusBadge({ status }: { status: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    queued: <Clock className="size-3" />,
    processing: <Loader2 className="size-3 animate-spin" />,
    completed: <CheckCircle2 className="size-3" />,
    failed: <XCircle className="size-3" />,
    skipped: <SkipForward className="size-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {iconMap[status]}
      {status}
    </span>
  );
}

/**
 * Enhanced expanded row showing processing step details
 */
function ExpandedStepDetails({ item }: { item: VideoItem }) {
  const ps = parseSteps(item);

  if (!ps) return null;

  return (
    <div className="space-y-2 mb-3">
      <h4 className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
        Processing Steps
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Transcript */}
        {ps.transcript && (
          <div className={`rounded-md px-3 py-2 text-xs ${ps.transcript.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="size-3" />
              <span className="font-medium">Transcript</span>
              {ps.transcript.success ? (
                <CheckCircle2 className="size-3 text-green-600" />
              ) : (
                <XCircle className="size-3 text-red-600" />
              )}
            </div>
            {ps.transcript.language && (
              <div className="text-muted-foreground">Language: {ps.transcript.language}</div>
            )}
            {ps.transcript.length != null && (
              <div className="text-muted-foreground">Length: {ps.transcript.length.toLocaleString()} chars</div>
            )}
            {ps.transcript.error && (
              <div className="text-red-600 mt-1">{ps.transcript.error}</div>
            )}
          </div>
        )}

        {/* Analysis */}
        {ps.analysis && (
          <div className={`rounded-md px-3 py-2 text-xs ${ps.analysis.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Brain className="size-3" />
              <span className="font-medium">Analysis</span>
              {ps.analysis.success ? (
                <CheckCircle2 className="size-3 text-green-600" />
              ) : (
                <XCircle className="size-3 text-red-600" />
              )}
            </div>
            {ps.analysis.restaurants_extracted != null && (
              <div className="text-muted-foreground">Extracted: {ps.analysis.restaurants_extracted} restaurants (pre-filter)</div>
            )}
            {ps.analysis.error && (
              <div className="text-red-600 mt-1">{ps.analysis.error}</div>
            )}
          </div>
        )}

        {/* Hallucination Filter */}
        {ps.hallucination_filter && (
          <div className={`rounded-md px-3 py-2 text-xs ${ps.hallucination_filter.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-yellow-50 dark:bg-yellow-950/20'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="size-3" />
              <span className="font-medium">Hallucination Filter</span>
              {ps.hallucination_filter.success ? (
                <CheckCircle2 className="size-3 text-green-600" />
              ) : (
                <XCircle className="size-3 text-yellow-600" />
              )}
            </div>
            {ps.hallucination_filter.accepted != null && (
              <div className="text-muted-foreground">
                Accepted: {ps.hallucination_filter.accepted}
                {ps.hallucination_filter.rejected != null && ps.hallucination_filter.rejected > 0 && (
                  <span className="text-red-600"> / Rejected: {ps.hallucination_filter.rejected}</span>
                )}
              </div>
            )}
            {ps.hallucination_filter.rejected_names && ps.hallucination_filter.rejected_names.length > 0 && (
              <div className="text-red-600 mt-1 text-[10px]">
                Filtered: {ps.hallucination_filter.rejected_names.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Enrichment */}
        {ps.enrichment && (
          <div className={`rounded-md px-3 py-2 text-xs ${ps.enrichment.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="size-3" />
              <span className="font-medium">Enrichment</span>
              {ps.enrichment.success ? (
                <CheckCircle2 className="size-3 text-green-600" />
              ) : (
                <XCircle className="size-3 text-red-600" />
              )}
            </div>
            {ps.enrichment.matched != null && (
              <div className="text-muted-foreground">
                Google Places: {ps.enrichment.matched}/{ps.enrichment.total} matched
              </div>
            )}
            {ps.enrichment.error && (
              <div className="text-red-600 mt-1">{ps.enrichment.error}</div>
            )}
          </div>
        )}

        {/* Database */}
        {ps.database && (
          <div className={`rounded-md px-3 py-2 text-xs ${ps.database.success ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <DatabaseIcon className="size-3" />
              <span className="font-medium">Database</span>
              {ps.database.success ? (
                <CheckCircle2 className="size-3 text-green-600" />
              ) : (
                <XCircle className="size-3 text-red-600" />
              )}
            </div>
            {ps.database.restaurants_saved != null && (
              <div className="text-muted-foreground">Saved: {ps.database.restaurants_saved} restaurants</div>
            )}
            {ps.database.error && (
              <div className="text-red-600 mt-1">{ps.database.error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AllVideosTable({ subscriptionId }: { subscriptionId?: string | null }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restaurantCache, setRestaurantCache] = useState<Record<string, VideoRestaurant[]>>({});
  const [loadingRestaurantsFor, setLoadingRestaurantsFor] = useState<string | null>(null);

  // Reset page when subscription changes
  const queryParams = useMemo(() => ({
    page: currentPage,
    limit: 20,
    status: statusFilter,
    search: searchQuery,
    subscription_id: subscriptionId ?? undefined,
  }), [currentPage, statusFilter, searchQuery, subscriptionId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.pipeline.allVideos(queryParams),
    queryFn: () => pipelineApi.getAllVideos(queryParams),
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

  // Status filter chip counts with icons
  const statusIcons: Record<string, React.ReactNode> = {
    all: null,
    queued: <Clock className="size-3" />,
    processing: <Loader2 className="size-3" />,
    completed: <CheckCircle2 className="size-3" />,
    failed: <XCircle className="size-3" />,
    skipped: <SkipForward className="size-3" />,
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold">
            All Videos
            {pagination && (
              <span className="ml-2 text-muted-foreground font-normal text-xs">
                ({pagination.total} in last 3 months)
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track each video through the pipeline: Fetched → Transcript → Analyzed → Enriched
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          className="h-7 w-7 p-0"
          title="Refresh"
          disabled={isLoading}
        >
          <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by title or channel..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="h-8 px-3 text-xs">
          Search
        </Button>
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs"
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
      <div className="flex flex-wrap gap-1.5 mb-3">
        {STATUS_OPTIONS.map((s) => {
          const count = s === 'all' ? totalAll : (statusSummary[s] ?? 0);
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => handleStatusFilter(s)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {statusIcons[s]}
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
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          {searchQuery || statusFilter !== 'all'
            ? 'No results for that filter'
            : 'No videos discovered yet. Check that subscriptions are configured.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                  Video
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell w-24">
                  Published
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-24">
                  Status
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-28 hidden md:table-cell">
                  Pipeline Steps
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground w-20">
                  Restaurants
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
                    <td className="px-3 py-2 max-w-0">
                      <div className="flex flex-col gap-0.5">
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
                        {item.channel_name && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {item.channel_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {item.published_at
                        ? new Date(item.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <div className="flex justify-center">
                        <StepIndicator item={item} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`font-semibold tabular-nums ${
                          item.restaurants_found > 0 ? 'text-green-600' : 'text-muted-foreground'
                        }`}
                      >
                        {item.restaurants_found ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {expandedId === item.id ? (
                        <ChevronUp className="size-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-3.5 text-muted-foreground" />
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === item.id && (
                    <tr className="border-b bg-muted/5">
                      <td colSpan={6} className="px-4 py-3">
                        {/* Timeline */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs mb-3">
                          <div className="flex items-center gap-1.5">
                            <Rss className="size-3 text-purple-500" />
                            <span className="text-muted-foreground">Discovered:</span>
                            <span className="font-medium">
                              {item.published_at
                                ? new Date(item.published_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Brain className="size-3 text-yellow-500" />
                            <span className="text-muted-foreground">Analyzed:</span>
                            <span className="font-medium">
                              {item.processing_completed_at
                                ? formatRelativeTime(item.processing_completed_at)
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3 text-blue-500" />
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="font-medium">
                              {formatProcessingDuration(item.processing_started_at, item.processing_completed_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="size-3 text-green-500" />
                            <span className="text-muted-foreground">Restaurants:</span>
                            <span className={`font-bold ${item.restaurants_found > 0 ? 'text-green-600' : ''}`}>
                              {item.restaurants_found ?? 0}
                            </span>
                          </div>
                        </div>

                        {/* Processing Steps Detail Cards */}
                        <ExpandedStepDetails item={item} />

                        {item.error_message && (
                          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded-md px-3 py-2 mb-3">
                            <XCircle className="size-3.5 shrink-0 mt-0.5" />
                            <span>{item.error_message}</span>
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
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.total_pages} ({pagination.total} videos)
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
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

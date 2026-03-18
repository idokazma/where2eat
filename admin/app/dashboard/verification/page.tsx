'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { verificationApi, VerificationReport, RestaurantVerification } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

function ConfidenceBadge({ confidence, recommendation }: { confidence: number; recommendation: string }) {
  const percentage = Math.round(confidence * 100);

  if (recommendation === 'accept') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {percentage}% valid
      </span>
    );
  } else if (recommendation === 'reject') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <XCircle className="w-3 h-3 mr-1" />
        {percentage}% hallucination
      </span>
    );
  } else {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <AlertCircle className="w-3 h-3 mr-1" />
        {percentage}% uncertain
      </span>
    );
  }
}

function RestaurantRow({ restaurant }: { restaurant: RestaurantVerification }) {
  const [expanded, setExpanded] = useState(false);
  const { verification, data_completeness } = restaurant;

  return (
    <div className="border rounded-lg mb-3 overflow-hidden">
      <div
        className={`p-4 cursor-pointer hover:bg-gray-50 ${
          verification.recommendation === 'reject'
            ? 'bg-red-50'
            : verification.recommendation === 'review'
            ? 'bg-yellow-50'
            : 'bg-white'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-lg">{restaurant.name_hebrew}</span>
              <span className="text-gray-500">{restaurant.name_english}</span>
              <ConfidenceBadge
                confidence={verification.confidence}
                recommendation={verification.recommendation}
              />
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {restaurant.city && <span className="mr-3">{restaurant.city}</span>}
              {restaurant.cuisine_type && restaurant.cuisine_type !== 'לא צוין' && (
                <span className="mr-3">{restaurant.cuisine_type}</span>
              )}
              {restaurant.google_name && (
                <span className="text-blue-600">Google: {restaurant.google_name}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Verification Details */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Verification Details</h4>
              {verification.reasons.length > 0 ? (
                <ul className="text-sm space-y-1">
                  {verification.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start">
                      <XCircle className="w-4 h-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-600 flex items-center">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  No issues detected
                </p>
              )}
            </div>

            {/* Data Completeness */}
            <div>
              <h4 className="font-semibold text-sm mb-2">Data Completeness</h4>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <div className="flex items-center">
                  {data_completeness.has_location ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  Location
                </div>
                <div className="flex items-center">
                  {data_completeness.has_cuisine ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  Cuisine
                </div>
                <div className="flex items-center">
                  {data_completeness.has_google_data ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  Google Data
                </div>
                <div className="flex items-center">
                  {data_completeness.has_photos ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  Photos
                </div>
              </div>
            </div>
          </div>

          {/* Episode Info */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold text-sm mb-2">Source Episode</h4>
            <div className="text-sm space-y-1">
              {restaurant.episode_info.video_url && (
                <a
                  href={restaurant.episode_info.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Watch on YouTube
                </a>
              )}
              {restaurant.episode_info.analysis_date && (
                <p className="text-gray-600">
                  Analyzed: {restaurant.episode_info.analysis_date}
                </p>
              )}
            </div>
          </div>

          {/* Mention Context */}
          {restaurant.mention_context && restaurant.mention_context !== 'לא צוין' && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">Mention Context</h4>
              <p className="text-sm text-gray-700 italic">&ldquo;{restaurant.mention_context}&rdquo;</p>
            </div>
          )}

          {/* Host Comments */}
          {restaurant.host_comments && restaurant.host_comments !== 'לא צוין' && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-sm mb-2">Host Comments</h4>
              <p className="text-sm text-gray-700">{restaurant.host_comments}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerificationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'accepted' | 'rejected' | 'review'>('all');

  const { data: report, isLoading, error } = useQuery<VerificationReport>({
    queryKey: ['verification-report'],
    queryFn: () => verificationApi.getReport(),
  });

  const revalidateMutation = useMutation({
    mutationFn: () => verificationApi.revalidate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-report'] });
    },
  });

  const filteredRestaurants = report?.restaurants.filter((r) => {
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        r.name_hebrew.toLowerCase().includes(searchLower) ||
        r.name_english.toLowerCase().includes(searchLower) ||
        r.google_name.toLowerCase().includes(searchLower) ||
        r.city.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Apply status filter
    if (filter === 'accepted' && r.verification.recommendation !== 'accept') return false;
    if (filter === 'rejected' && r.verification.recommendation !== 'reject') return false;
    if (filter === 'review' && r.verification.recommendation !== 'review') return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Verification Report</h1>
          <p className="text-muted-foreground mt-1">
            Review extracted restaurants for hallucinations and data quality
          </p>
        </div>
        <Button
          onClick={() => revalidateMutation.mutate()}
          disabled={revalidateMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${revalidateMutation.isPending ? 'animate-spin' : ''}`} />
          Revalidate All
        </Button>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card
            className={`cursor-pointer ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => setFilter('all')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{report.total}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer ${filter === 'accepted' ? 'ring-2 ring-green-500' : ''}`}
            onClick={() => setFilter('accepted')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Accepted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{report.summary.accepted}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer ${filter === 'rejected' ? 'ring-2 ring-red-500' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600 flex items-center">
                <XCircle className="w-4 h-4 mr-1" />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{report.summary.rejected}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer ${filter === 'review' ? 'ring-2 ring-yellow-500' : ''}`}
            onClick={() => setFilter('review')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-yellow-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Needs Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{report.summary.needs_review}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search restaurants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredRestaurants?.length || 0} of {report?.total || 0} restaurants
        </div>
      </div>

      {/* Restaurant List */}
      {isLoading ? (
        <div className="text-center py-8">Loading verification report...</div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Failed to load verification report. Make sure the API is running.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredRestaurants?.map((restaurant) => (
            <RestaurantRow key={restaurant.id} restaurant={restaurant} />
          ))}
          {filteredRestaurants?.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No restaurants match your filters.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Generated timestamp */}
      {report && (
        <p className="text-xs text-muted-foreground text-center">
          Report generated: {new Date(report.generated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { restaurantsApi } from '@/lib/api';
import { Restaurant, RestaurantListResponse } from '@/types/restaurant';
import { RestaurantTable } from '@/components/restaurants/restaurant-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RestaurantsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useQuery<RestaurantListResponse>({
    queryKey: ['restaurants', page, search, filters],
    queryFn: () => restaurantsApi.list({
      page,
      limit: 25,
      sort: '-created_at',
      filter: filters,
    }),
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page on search
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  };

  const handleCreateNew = () => {
    router.push('/dashboard/restaurants/new');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Restaurants</h1>
          <p className="text-muted-foreground mt-1">
            Manage restaurant data from podcast analysis
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add Restaurant
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
          <CardDescription>Find restaurants by name, location, or cuisine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restaurant Table */}
      {error ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-destructive">
              Error loading restaurants. Please try again.
            </div>
          </CardContent>
        </Card>
      ) : (
        <RestaurantTable
          data={data?.restaurants || []}
          pagination={data?.pagination}
          isLoading={isLoading}
          onPageChange={setPage}
          currentPage={page}
        />
      )}
    </div>
  );
}

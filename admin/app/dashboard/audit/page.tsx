'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { bulkApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, FileEdit, Trash2, Plus, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface EditHistory {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  admin_user_id: string;
  admin_name: string;
  admin_email: string;
  edit_type: 'create' | 'update' | 'delete' | 'approve' | 'reject';
  changes: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const [searchRestaurant, setSearchRestaurant] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [limit, setLimit] = useState(100);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit-history', searchRestaurant, searchUser, limit],
    queryFn: () =>
      bulkApi.getEditHistory({
        restaurant_id: searchRestaurant || undefined,
        admin_user_id: searchUser || undefined,
        limit,
      }),
  });

  const getEditTypeIcon = (type: string) => {
    switch (type) {
      case 'create':
        return <Plus className="h-5 w-5 text-green-600" />;
      case 'update':
        return <FileEdit className="h-5 w-5 text-blue-600" />;
      case 'delete':
        return <Trash2 className="h-5 w-5 text-red-600" />;
      case 'approve':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'reject':
        return <XCircle className="h-5 w-5 text-orange-600" />;
      default:
        return <FileEdit className="h-5 w-5 text-gray-600" />;
    }
  };

  const getEditTypeLabel = (type: string) => {
    switch (type) {
      case 'create':
        return 'Created';
      case 'update':
        return 'Updated';
      case 'delete':
        return 'Deleted';
      case 'approve':
        return 'Approved';
      case 'reject':
        return 'Rejected';
      default:
        return type;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatChanges = (changesStr: string) => {
    try {
      const changes = JSON.parse(changesStr);
      return JSON.stringify(changes, null, 2);
    } catch {
      return changesStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            View all changes made to restaurants
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by restaurant ID or user ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Restaurant ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by restaurant..."
                  className="pl-10"
                  value={searchRestaurant}
                  onChange={(e) => setSearchRestaurant(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Admin User ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by user..."
                  className="pl-10"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Limit</label>
              <Input
                type="number"
                placeholder="Max records"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                min={1}
                max={500}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Timeline */}
      {error ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center text-destructive">
              Error loading audit log. Please try again.
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <span className="ml-3 text-muted-foreground">Loading audit log...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Edit History</CardTitle>
            <CardDescription>
              {data?.history?.length || 0} edit{(data?.history?.length || 0) !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.history && data.history.length > 0 ? (
              <div className="space-y-4">
                {data.history.map((item: EditHistory) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-0.5">{getEditTypeIcon(item.edit_type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{getEditTypeLabel(item.edit_type)}</span>
                            <span className="text-muted-foreground">by</span>
                            <span className="font-medium">{item.admin_name}</span>
                            <span className="text-muted-foreground text-sm">({item.admin_email})</span>
                          </div>
                          <div className="mt-1 text-sm">
                            <span className="text-muted-foreground">Restaurant:</span>{' '}
                            <span className="font-medium">{item.restaurant_name}</span>
                            {item.restaurant_id && (
                              <>
                                {' '}
                                <span className="text-muted-foreground text-xs">({item.restaurant_id})</span>
                              </>
                            )}
                          </div>
                          {item.changes && (
                            <details className="mt-2">
                              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                                View changes
                              </summary>
                              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                                {formatChanges(item.changes)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(item.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No edit history found
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

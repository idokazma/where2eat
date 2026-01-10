'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
} from '@tanstack/react-table';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Restaurant } from '@/types/restaurant';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Trash2, Eye, Download, Upload, Trash } from 'lucide-react';
import { bulkApi } from '@/lib/api';

interface RestaurantTableProps {
  data: Restaurant[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  onPageChange: (page: number) => void;
  currentPage: number;
}

const columnHelper = createColumnHelper<Restaurant>();

export function RestaurantTable({
  data,
  pagination,
  isLoading,
  onPageChange,
  currentPage,
}: RestaurantTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter(key => rowSelection[key])
      .map(key => data[parseInt(key)]?.id)
      .filter(Boolean) as string[];
  }, [rowSelection, data]);

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkApi.deleteRestaurants(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      setRowSelection({});
    },
  });

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.length} restaurants?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await bulkApi.exportRestaurants(format, selectedIds.length > 0 ? selectedIds : undefined);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `restaurants.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
      }),
      columnHelper.accessor('name_hebrew', {
        header: 'Name',
        cell: (info) => (
          <div>
            <div className="font-semibold">{info.getValue()}</div>
            {info.row.original.name_english && (
              <div className="text-sm text-muted-foreground">
                {info.row.original.name_english}
              </div>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('location.city', {
        header: 'Location',
        cell: (info) => (
          <div>
            <div>{info.getValue() || '-'}</div>
            {info.row.original.location?.neighborhood && (
              <div className="text-sm text-muted-foreground">
                {info.row.original.location.neighborhood}
              </div>
            )}
          </div>
        ),
      }),
      columnHelper.accessor('cuisine_type', {
        header: 'Cuisine',
        cell: (info) => (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue();
          const colors = {
            open: 'bg-green-50 text-green-700 ring-green-600/20',
            closed: 'bg-red-50 text-red-700 ring-red-600/20',
            new_opening: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
            closing_soon: 'bg-orange-50 text-orange-700 ring-orange-600/20',
            reopening: 'bg-purple-50 text-purple-700 ring-purple-600/20',
          };
          return (
            <span
              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                colors[status] || 'bg-gray-50 text-gray-700 ring-gray-600/20'
              }`}
            >
              {status.replace('_', ' ')}
            </span>
          );
        },
      }),
      columnHelper.accessor('host_opinion', {
        header: 'Opinion',
        cell: (info) => {
          const opinion = info.getValue();
          const emojis = {
            positive: '😍',
            negative: '😞',
            mixed: '🤔',
            neutral: '😐',
          };
          return <span className="text-2xl">{emojis[opinion] || '😐'}</span>;
        },
      }),
      columnHelper.accessor('price_range', {
        header: 'Price',
        cell: (info) => {
          const price = info.getValue();
          const symbols = {
            budget: '₪',
            'mid-range': '₪₪',
            expensive: '₪₪₪',
            not_mentioned: '-',
          };
          return <span className="font-semibold">{symbols[price] || '-'}</span>;
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: (props) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/dashboard/restaurants/${props.row.original.id}/preview`)}
              title="Preview"
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push(`/dashboard/restaurants/${props.row.original.id}/edit`)}
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(props.row.original.id!)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      }),
    ],
    [router]
  );

  const table = useReactTable({
    data: data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
  });

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this restaurant?')) {
      // TODO: Implement delete functionality
      console.log('Delete restaurant:', id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <span className="ml-3 text-muted-foreground">Loading restaurants...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-center">
            <p className="text-muted-foreground">No restaurants found.</p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => router.push('/dashboard/restaurants/new')}
            >
              Create your first restaurant
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Operations Toolbar */}
      {selectedIds.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedIds.length} restaurant{selectedIds.length > 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('json')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('csv')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export All Button */}
      {selectedIds.length === 0 && data && data.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('json')}
          >
            <Download className="mr-2 h-4 w-4" />
            Export All JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport('csv')}
          >
            <Download className="mr-2 h-4 w-4" />
            Export All CSV
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-4 py-3 text-left text-sm font-medium"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pagination.limit) + 1} to{' '}
            {Math.min(currentPage * pagination.limit, pagination.total)} of{' '}
            {pagination.total} restaurants
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show first page, last page, current page, and pages around current
                  return (
                    page === 1 ||
                    page === pagination.totalPages ||
                    Math.abs(page - currentPage) <= 1
                  );
                })
                .map((page, idx, arr) => {
                  // Add ellipsis between non-consecutive pages
                  const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                  return (
                    <div key={page} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-2 text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={page === currentPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onPageChange(page)}
                      >
                        {page}
                      </Button>
                    </div>
                  );
                })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

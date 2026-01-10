'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30');

  // Fetch restaurant analytics
  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ['analytics', 'restaurants', period],
    queryFn: () => analyticsApi.getRestaurants({ period }),
  });

  // Fetch overview for additional metrics
  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.getOverview(),
  });

  // Fetch system health
  const { data: systemHealth } = useQuery({
    queryKey: ['analytics', 'system'],
    queryFn: () => analyticsApi.getSystemHealth(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Detailed insights and visualizations
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="restaurants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
        </TabsList>

        {/* Restaurants Tab */}
        <TabsContent value="restaurants" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-5 bg-muted rounded animate-pulse w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Growth Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Restaurant Growth</CardTitle>
                  <CardDescription>New restaurants added over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={restaurantData?.growthData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value: any) => [value, 'Restaurants']}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" name="New" strokeWidth={2} />
                      <Line type="monotone" dataKey="cumulative" stroke="#10b981" name="Total" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {/* Cuisine Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Cuisines</CardTitle>
                    <CardDescription>Most popular cuisine types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={restaurantData?.cuisineDistribution || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="cuisine" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Location Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Cities</CardTitle>
                    <CardDescription>Restaurants by location</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={restaurantData?.locationDistribution || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="city" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Price Range Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Price Range Distribution</CardTitle>
                    <CardDescription>Restaurants by price category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(restaurantData?.priceRangeStats || {}).map(([name, value]) => ({
                            name: name.replace('_', ' '),
                            value,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.keys(restaurantData?.priceRangeStats || {}).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Sentiment Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Host Opinions</CardTitle>
                    <CardDescription>Sentiment breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(restaurantData?.sentimentBreakdown || {}).map(([name, value]) => ({
                            name,
                            value,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => {
                            const emoji = name === 'positive' ? '😍' :
                                         name === 'negative' ? '😞' :
                                         name === 'mixed' ? '🤔' : '😐';
                            return `${emoji} ${((percent || 0) * 100).toFixed(0)}%`;
                          }}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.keys(restaurantData?.sentimentBreakdown || {}).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* System Health Tab */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Database</CardTitle>
                <CardDescription>Storage and records</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Size</span>
                    <span className="text-sm font-medium">{systemHealth?.database.sizeFormatted || '0 MB'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Records</span>
                    <span className="text-sm font-medium">{systemHealth?.database.totalRecords || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Performance</CardTitle>
                <CardDescription>Response times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">p50</span>
                    <span className="text-sm font-medium">{systemHealth?.api.responseTime.p50 || 0}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">p95</span>
                    <span className="text-sm font-medium">{systemHealth?.api.responseTime.p95 || 0}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">p99</span>
                    <span className="text-sm font-medium">{systemHealth?.api.responseTime.p99 || 0}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uptime</CardTitle>
                <CardDescription>Server status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Uptime</span>
                    <span className="text-sm font-medium">
                      {systemHealth?.api.uptime
                        ? `${Math.floor(systemHealth.api.uptime / 3600)}h ${Math.floor((systemHealth.api.uptime % 3600) / 60)}m`
                        : '0h 0m'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm font-medium text-green-600">Healthy</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Memory Usage</CardTitle>
              <CardDescription>Server memory statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Heap Used</p>
                  <p className="text-lg font-medium">
                    {systemHealth?.api.memoryUsage
                      ? `${(systemHealth.api.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
                      : '0 MB'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Heap Total</p>
                  <p className="text-lg font-medium">
                    {systemHealth?.api.memoryUsage
                      ? `${(systemHealth.api.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`
                      : '0 MB'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RSS</p>
                  <p className="text-lg font-medium">
                    {systemHealth?.api.memoryUsage
                      ? `${(systemHealth.api.memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`
                      : '0 MB'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">External</p>
                  <p className="text-lg font-medium">
                    {systemHealth?.api.memoryUsage
                      ? `${(systemHealth.api.memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
                      : '0 MB'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

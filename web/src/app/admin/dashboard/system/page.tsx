'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/admin/auth-context';
import { systemApi, errorsApi, type ConnectionStatus, type AllConnectionsResult, type ErrorLog, type ErrorSummary, type SystemHealth, type SystemStats } from '@/lib/admin/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Button } from '@/components/admin/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/admin/ui/tabs';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Database,
  Youtube,
  MapPin,
  Bot,
  Cpu,
  HardDrive,
  Clock,
  Activity,
  Trash2,
  Eye,
  Server,
  Key,
  Zap
} from 'lucide-react';

// Status icon component
function StatusIcon({ status }: { status: ConnectionStatus | string }) {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'degraded':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'unavailable':
      return <AlertCircle className="h-5 w-5 text-gray-400" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-400" />;
  }
}

// Service icon component
function ServiceIcon({ service }: { service: string }) {
  switch (service) {
    case 'database':
      return <Database className="h-5 w-5" />;
    case 'youtube_transcript':
      return <Youtube className="h-5 w-5" />;
    case 'google_places':
      return <MapPin className="h-5 w-5" />;
    case 'claude_api':
    case 'openai_api':
      return <Bot className="h-5 w-5" />;
    default:
      return <Server className="h-5 w-5" />;
  }
}

// Service name formatter
function formatServiceName(service: string): string {
  const names: Record<string, string> = {
    'database': 'SQLite Database',
    'youtube_transcript': 'YouTube Transcript API',
    'google_places': 'Google Places API',
    'claude_api': 'Claude API (Anthropic)',
    'openai_api': 'OpenAI API'
  };
  return names[service] || service;
}

// Connection Card Component
function ConnectionCard({
  service,
  result,
  onTest,
  isTesting
}: {
  service: string;
  result?: { status: ConnectionStatus; response_time_ms: number; details: Record<string, any> };
  onTest: () => void;
  isTesting: boolean;
}) {
  const statusColors: Record<ConnectionStatus, string> = {
    healthy: 'bg-green-50 border-green-200',
    degraded: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
    unavailable: 'bg-gray-50 border-gray-200',
    timeout: 'bg-orange-50 border-orange-200'
  };

  return (
    <Card className={`${result ? statusColors[result.status] : 'bg-gray-50 border-gray-200'}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-background rounded-lg border">
              <ServiceIcon service={service} />
            </div>
            <div>
              <h3 className="font-semibold">{formatServiceName(service)}</h3>
              {result && (
                <div className="flex items-center gap-2 mt-1">
                  <StatusIcon status={result.status} />
                  <span className="text-sm capitalize">{result.status}</span>
                  <span className="text-xs text-muted-foreground">
                    {result.response_time_ms}ms
                  </span>
                </div>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onTest}
            disabled={isTesting}
          >
            {isTesting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              'Test'
            )}
          </Button>
        </div>

        {result?.details && (
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            {result.details.error && (
              <p className="text-red-600">{result.details.error}</p>
            )}
            {result.details.api_key_valid !== undefined && (
              <p>API Key: {result.details.api_key_valid ? 'Valid' : 'Invalid'}</p>
            )}
            {result.details.cache_enabled !== undefined && (
              <p>Cache: {result.details.cache_enabled ? `Enabled (${result.details.cache_entries} entries)` : 'Disabled'}</p>
            )}
            {result.details.db_size_mb !== undefined && (
              <p>Size: {result.details.db_size_mb} MB</p>
            )}
            {result.details.stats && (
              <p>Records: {result.details.stats.total_restaurants} restaurants</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Error Level Badge
function ErrorLevelBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-yellow-100 text-yellow-700',
    info: 'bg-blue-100 text-blue-700',
    debug: 'bg-gray-100 text-gray-700'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[level] || 'bg-gray-100'}`}>
      {level}
    </span>
  );
}

export default function SystemPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('connections');
  const [testingService, setTestingService] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  // Fetch all connection statuses
  const { data: connections, isLoading: isLoadingConnections, refetch: refetchConnections } = useQuery({
    queryKey: ['system', 'connections'],
    queryFn: systemApi.getConnectionStatus,
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch system health
  const { data: health, isLoading: isLoadingHealth } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: systemApi.getHealth,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch system stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['system', 'stats'],
    queryFn: systemApi.getStats,
    refetchInterval: 60000
  });

  // Fetch error summary
  const { data: errorSummary } = useQuery({
    queryKey: ['system', 'errors', 'summary'],
    queryFn: () => errorsApi.getSummary(24)
  });

  // Fetch error list
  const { data: errors } = useQuery({
    queryKey: ['system', 'errors', 'list'],
    queryFn: () => errorsApi.list({ limit: 20, resolved: false })
  });

  // Fetch API key status (super_admin only)
  const { data: apiKeys } = useQuery({
    queryKey: ['system', 'api-keys'],
    queryFn: systemApi.getApiKeyStatus,
    enabled: isSuperAdmin
  });

  // Test single connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: (service: string) => {
      setTestingService(service);
      return systemApi.testConnection(service);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'connections'] });
    },
    onSettled: () => {
      setTestingService(null);
    }
  });

  // Vacuum database mutation
  const vacuumMutation = useMutation({
    mutationFn: systemApi.runVacuum,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'stats'] });
    }
  });

  // Resolve error mutation
  const resolveErrorMutation = useMutation({
    mutationFn: ({ errorId, notes }: { errorId: string; notes?: string }) =>
      errorsApi.resolve(errorId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'errors'] });
    }
  });

  const services = ['database', 'youtube_transcript', 'google_places', 'claude_api', 'openai_api'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Monitor API connections, system health, and error logs
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetchConnections()}
          disabled={isLoadingConnections}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingConnections ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${health?.status === 'healthy' ? 'bg-green-100' : health?.status === 'degraded' ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <Activity className={`h-5 w-5 ${health?.status === 'healthy' ? 'text-green-600' : health?.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Status</p>
                <p className="text-xl font-bold capitalize">{health?.status || 'Loading...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API Uptime</p>
                <p className="text-xl font-bold">{health?.server?.uptime_formatted || '...'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <HardDrive className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Database Size</p>
                <p className="text-xl font-bold">{stats?.system?.database?.size_mb || '...'} MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${(errorSummary?.unresolved || 0) > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <AlertTriangle className={`h-5 w-5 ${(errorSummary?.unresolved || 0) > 0 ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unresolved Errors</p>
                <p className="text-xl font-bold">{errorSummary?.unresolved || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connections">
            <Zap className="h-4 w-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="errors">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Errors
            {(errorSummary?.unresolved || 0) > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {errorSummary?.unresolved}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="maintenance">
              <Database className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
          )}
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="space-y-4">
          {/* Overall Status */}
          {connections && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon status={connections.overall_status} />
                  Overall Status: {connections.overall_status.charAt(0).toUpperCase() + connections.overall_status.slice(1)}
                </CardTitle>
                <CardDescription>
                  {connections.summary.healthy} healthy, {connections.summary.degraded} degraded, {connections.summary.error} errors, {connections.summary.unavailable} unavailable
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <ConnectionCard
                key={service}
                service={service}
                result={connections?.services?.[service]}
                onTest={() => testConnectionMutation.mutate(service)}
                isTesting={testingService === service}
              />
            ))}
          </div>

          {/* API Keys Status (Super Admin) */}
          {isSuperAdmin && apiKeys && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  API Keys Status
                </CardTitle>
                <CardDescription>Configured API keys (masked for security)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(apiKeys.api_keys).map(([key, info]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{key.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">{info.env_var}</p>
                      </div>
                      <div className="text-right">
                        {info.configured ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500 inline mr-1" />
                            <span className="text-sm font-mono">{info.masked_key}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 text-red-500 inline mr-1" />
                            <span className="text-sm text-muted-foreground">Not configured</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          {/* Error Summary */}
          {errorSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold">{errorSummary.total_errors}</p>
                  <p className="text-sm text-muted-foreground">Total Errors (24h)</p>
                </CardContent>
              </Card>
              <Card className="bg-red-50">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-600">
                    {errorSummary.by_level?.critical?.count || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-yellow-600">
                    {errorSummary.by_level?.warning?.count || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50">
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-blue-600">
                    {errorSummary.by_level?.info?.count || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Info</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Unresolved errors from the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              {errors?.errors && errors.errors.length > 0 ? (
                <div className="space-y-3">
                  {errors.errors.map((error: ErrorLog) => (
                    <div
                      key={error.id}
                      className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <ErrorLevelBadge level={error.level} />
                          <span className="text-sm font-medium">{error.service}</span>
                          {error.occurrence_count > 1 && (
                            <span className="text-xs text-muted-foreground">
                              ({error.occurrence_count}x)
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{error.message}</p>
                        <p className="text-xs text-muted-foreground">
                          First: {new Date(error.first_occurred).toLocaleString()} |
                          Last: {new Date(error.last_occurred).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveErrorMutation.mutate({ errorId: error.error_id })}
                          disabled={resolveErrorMutation.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No unresolved errors</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backend Health */}
            <Card>
              <CardHeader>
                <CardTitle>Backend Services</CardTitle>
                <CardDescription>Python backend component status</CardDescription>
              </CardHeader>
              <CardContent>
                {health?.backend?.checks && (
                  <div className="space-y-3">
                    {Object.entries(health.backend.checks).map(([check, status]) => (
                      <div key={check} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="capitalize">{check.replace('_', ' ')}</span>
                        {status ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Server Health */}
            <Card>
              <CardHeader>
                <CardTitle>API Server</CardTitle>
                <CardDescription>Express.js server metrics</CardDescription>
              </CardHeader>
              <CardContent>
                {health?.server && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Uptime</span>
                      <span className="font-mono">{health.server.uptime_formatted}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Memory (Heap Used)</span>
                      <span className="font-mono">
                        {(health.server.memory_usage.heapUsed / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Memory (RSS)</span>
                      <span className="font-mono">
                        {(health.server.memory_usage.rss / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Node Version</span>
                      <span className="font-mono">{health.server.node_version}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>Platform</span>
                      <span className="font-mono">{health.server.platform}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Database Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Database Statistics</CardTitle>
              <CardDescription>SQLite database metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats.database?.restaurants || 0}</p>
                    <p className="text-sm text-muted-foreground">Restaurants</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats.database?.episodes || 0}</p>
                    <p className="text-sm text-muted-foreground">Episodes</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats.database?.active_jobs || 0}</p>
                    <p className="text-sm text-muted-foreground">Active Jobs</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats.database?.unique_cities || 0}</p>
                    <p className="text-sm text-muted-foreground">Cities</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold">{stats.database?.unique_cuisines || 0}</p>
                    <p className="text-sm text-muted-foreground">Cuisines</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab (Super Admin) */}
        {isSuperAdmin && (
          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Maintenance</CardTitle>
                <CardDescription>Administrative database operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Vacuum Database</h3>
                    <p className="text-sm text-muted-foreground">
                      Reclaim space and optimize database performance
                    </p>
                  </div>
                  <Button
                    onClick={() => vacuumMutation.mutate()}
                    disabled={vacuumMutation.isPending}
                  >
                    {vacuumMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <HardDrive className="h-4 w-4 mr-2" />
                    )}
                    Run Vacuum
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Clear Resolved Errors</h3>
                    <p className="text-sm text-muted-foreground">
                      Delete resolved error logs older than 30 days
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => systemApi.clearResolvedErrors(30)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Old Errors
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
                <CardDescription>Detailed system configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">Database Path</p>
                    <p className="font-mono text-xs truncate">{stats?.system?.database?.path || 'N/A'}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">Database Size</p>
                    <p className="font-mono">{stats?.system?.database?.size_mb || 0} MB</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">Memory Usage (Python)</p>
                    <p className="font-mono">{stats?.system?.memory?.rss_mb || 0} MB</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-muted-foreground">Memory Percentage</p>
                    <p className="font-mono">{stats?.system?.memory?.percent?.toFixed(1) || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

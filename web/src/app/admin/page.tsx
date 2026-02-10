"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Settings,
  Database,
  RefreshCw,
  Play,
  XCircle,
  CheckCircle,
  Clock,
  BarChart3,
  Youtube,
  FileJson,
  Trash2,
  Download,
  Lock,
  LogOut,
} from "lucide-react"
import { useLanguage } from "@/contexts/LanguageContext"
import { endpoints, getApiUrl } from "@/lib/config"

interface Job {
  id: number
  job_type: string
  status: string
  created_at: string
  updated_at: string
  error_message?: string
}

interface Stats {
  total_restaurants: number
  total_episodes: number
  total_jobs: number
  pending_jobs: number
  completed_jobs: number
  failed_jobs: number
}

function AdminLoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await fetch(getApiUrl("/api/admin/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok && data.token) {
        onLogin(data.token)
      } else {
        setError(data.detail || "Invalid credentials")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <RefreshCw className="size-4 mr-2 animate-spin" />
              ) : (
                <Lock className="size-4 mr-2" />
              )}
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function AdminDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { t } = useLanguage()
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadJobs = useCallback(async () => {
    setIsLoadingJobs(true)
    try {
      const response = await fetch(endpoints.jobs.list())
      const data = await response.json()
      if (data.jobs) {
        setJobs(data.jobs)
      }
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setIsLoadingJobs(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch(endpoints.restaurants.list())
      const data = await response.json()

      const totalRestaurants = data.restaurants?.length || data.count || 0
      const episodeIds = new Set(data.restaurants?.map((r: any) => r.episode_info?.video_id).filter(Boolean) || [])

      setStats({
        total_restaurants: totalRestaurants,
        total_episodes: episodeIds.size,
        total_jobs: jobs.length,
        pending_jobs: jobs.filter(j => j.status === 'pending' || j.status === 'processing').length,
        completed_jobs: jobs.filter(j => j.status === 'completed').length,
        failed_jobs: jobs.filter(j => j.status === 'failed').length
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }, [jobs])

  useEffect(() => {
    loadJobs()
    loadStats()
  }, [loadJobs, loadStats])

  const handleAnalyzeVideo = async () => {
    if (!youtubeUrl) return

    setIsAnalyzing(true)
    try {
      const response = await fetch(endpoints.analyze.video(), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ url: youtubeUrl }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(t('youtube.analysisStarted'))
        setYoutubeUrl("")
        loadJobs()
      } else {
        alert(data.error || data.detail || t('youtube.errorStarting'))
      }
    } catch (error) {
      console.error('Error analyzing video:', error)
      alert(t('youtube.unexpectedError'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCancelJob = async (jobId: number) => {
    try {
      await fetch(endpoints.jobs.cancel(String(jobId)), {
        method: 'POST',
        headers: authHeaders,
      })
      loadJobs()
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="size-4 text-green-600" />
      case 'failed':
        return <XCircle className="size-4 text-red-600" />
      case 'processing':
        return <RefreshCw className="size-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="size-4 text-yellow-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      failed: "destructive",
      processing: "secondary",
      pending: "outline"
    }
    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-black tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage restaurants, analyze videos, and monitor system status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="size-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
            <Database className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_restaurants || 0}</div>
            <p className="text-xs text-muted-foreground">
              From {stats?.total_episodes || 0} episodes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <RefreshCw className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending_jobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.completed_jobs || 0} completed, {stats?.failed_jobs || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <CheckCircle className="size-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Operational</div>
            <p className="text-xs text-muted-foreground">
              All systems running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Video Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-red-600" />
            Analyze YouTube Video
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Enter YouTube URL..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAnalyzeVideo}
              disabled={!youtubeUrl || isAnalyzing}
              className="min-w-[120px]"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="size-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="size-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter a YouTube video URL to extract restaurant recommendations from the transcript
          </p>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              Recent Jobs
            </CardTitle>
            <Button
              onClick={loadJobs}
              variant="outline"
              size="sm"
              disabled={isLoadingJobs}
            >
              <RefreshCw className={`size-4 mr-2 ${isLoadingJobs ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingJobs ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="size-12 mx-auto mb-3 opacity-50" />
              <p>No jobs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="font-medium text-sm">{job.job_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(job.status)}
                    {job.status === 'processing' && (
                      <Button
                        onClick={() => handleCancelJob(job.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <XCircle className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="size-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start">
              <Download className="size-4 mr-2" />
              Export Database
            </Button>
            <Button variant="outline" className="justify-start">
              <FileJson className="size-4 mr-2" />
              Import JSON
            </Button>
            <Button variant="outline" className="justify-start">
              <RefreshCw className="size-4 mr-2" />
              Refresh All Data
            </Button>
            <Button variant="outline" className="justify-start text-red-600">
              <Trash2 className="size-4 mr-2" />
              Clear Cache
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const STORAGE_KEY = "where2eat_admin_token"

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check for existing token in sessionStorage
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      // Verify the token is still valid
      fetch(getApiUrl("/api/admin/auth/me"), {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((res) => {
          if (res.ok) {
            setToken(stored)
          } else {
            sessionStorage.removeItem(STORAGE_KEY)
          }
        })
        .catch(() => {
          sessionStorage.removeItem(STORAGE_KEY)
        })
        .finally(() => setIsChecking(false))
    } else {
      setIsChecking(false)
    }
  }, [])

  const handleLogin = (newToken: string) => {
    sessionStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
  }

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken(null)
  }

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!token) {
    return <AdminLoginForm onLogin={handleLogin} />
  }

  return <AdminDashboard token={token} onLogout={handleLogout} />
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Lock, LogOut } from "lucide-react"
import { getApiUrl, endpoints } from "@/lib/config"
import StatusStrip from "./components/StatusStrip"
import PipelineView from "./components/PipelineView"
import AllVideos from "./components/AllVideos"

interface PipelineOverview {
  queued: number
  processing: number
  completed: number
  failed: number
  skipped: number
  total: number
}

interface PipelineStats {
  status_counts: Record<string, number>
  avg_processing_seconds: number
  completed_last_24h: number
  completed_last_7d: number
  failure_rate_percent: number
  total_items: number
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
        setError(data.error || data.detail || "Invalid credentials")
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
            {error && <p className="text-sm text-red-600">{error}</p>}
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

function AdminDashboard({
  token,
  onLogout,
}: {
  token: string
  onLogout: () => void
}) {
  const [overview, setOverview] = useState<PipelineOverview | null>(null)
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [restaurantCount, setRestaurantCount] = useState(0)
  const [isLoadingMeta, setIsLoadingMeta] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }

  const loadMeta = useCallback(async () => {
    try {
      const [overviewRes, statsRes, restaurantsRes] = await Promise.all([
        fetch(endpoints.admin.pipeline.overview(), { headers: authHeaders }),
        fetch(endpoints.admin.pipeline.stats(), { headers: authHeaders }),
        fetch(endpoints.restaurants.list()),
      ])

      const [overviewData, statsData, restaurantsData] = await Promise.all([
        overviewRes.json(),
        statsRes.json(),
        restaurantsRes.json(),
      ])

      if (overviewData.overview) setOverview(overviewData.overview)
      if (statsData.stats) setStats(statsData.stats)

      const total =
        restaurantsData.restaurants?.length || restaurantsData.count || 0
      setRestaurantCount(total)
      setLastRefresh(new Date())
    } catch (error) {
      console.error("Failed to load dashboard meta:", error)
    } finally {
      setIsLoadingMeta(false)
    }
  }, [token])

  useEffect(() => {
    loadMeta()
    const interval = setInterval(loadMeta, 15000)
    return () => clearInterval(interval)
  }, [loadMeta])

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header: title + logout */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground whitespace-nowrap">
            Pipeline Control
          </h1>
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline">
              Updated {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMeta}
            className="h-7 w-7 p-0"
            title="Refresh all"
          >
            <RefreshCw className={`size-3.5 ${isLoadingMeta ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="h-7 px-2 text-xs">
            <LogOut className="size-3.5 mr-1" />
            Logout
          </Button>
        </div>
      </div>

      {/* Status Strip */}
      <StatusStrip
        overview={overview}
        stats={stats}
        restaurantCount={restaurantCount}
        isLoading={isLoadingMeta}
      />

      {/* Pipeline: Now Processing + Queue + Failed + Analyze */}
      <PipelineView token={token} />

      {/* Separator */}
      <div className="border-t" />

      {/* All Videos with status filters and extraction results */}
      <AllVideos token={token} />
    </div>
  )
}

const STORAGE_KEY = "where2eat_admin_token"

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
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
      queueMicrotask(() => setIsChecking(false))
    }
  }, [])

  const handleLogin = (newToken: string) => {
    sessionStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
  }

  const handleLogout = async () => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        await fetch(getApiUrl("/api/admin/auth/logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${stored}` },
        })
      }
    } catch {
      // Continue with client-side cleanup even if server call fails
    }
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

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  RefreshCw,
  Lock,
  LogOut,
  LayoutDashboard,
  Youtube,
  UtensilsCrossed,
  ListTodo,
} from "lucide-react"
import { getApiUrl } from "@/lib/config"
import OverviewTab from "./components/OverviewTab"
import VideosTab from "./components/VideosTab"
import RestaurantsTab from "./components/RestaurantsTab"
import QueueTab from "./components/QueueTab"

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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor system status, manage videos, and control the pipeline
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="size-4 mr-2" />
          Logout
        </Button>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="overview">
            <LayoutDashboard className="size-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="videos">
            <Youtube className="size-4 mr-1.5" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="restaurants">
            <UtensilsCrossed className="size-4 mr-1.5" />
            Restaurants
          </TabsTrigger>
          <TabsTrigger value="queue">
            <ListTodo className="size-4 mr-1.5" />
            Queue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab token={token} />
        </TabsContent>

        <TabsContent value="videos">
          <VideosTab token={token} />
        </TabsContent>

        <TabsContent value="restaurants">
          <RestaurantsTab />
        </TabsContent>

        <TabsContent value="queue">
          <QueueTab token={token} />
        </TabsContent>
      </Tabs>
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
      // Intentional: set initial state when no stored token exists
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

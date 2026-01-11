"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Wifi, WifiOff, Loader2, Check, X } from "lucide-react"
import { endpoints, config } from "@/lib/config"

interface HealthResponse {
  status: string
  timestamp: string
}

type ConnectionStatus = "idle" | "checking" | "success" | "error"

export function ConnectivityCheck() {
  const [status, setStatus] = useState<ConnectionStatus>("idle")
  const [response, setResponse] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkConnectivity = async () => {
    setStatus("checking")
    setError(null)
    setResponse(null)

    try {
      const res = await fetch(endpoints.health(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data: HealthResponse = await res.json()
      setResponse(data)
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
      setStatus("error")
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case "checking":
        return <Loader2 className="size-4 animate-spin" />
      case "success":
        return <Check className="size-4 text-green-600" />
      case "error":
        return <X className="size-4 text-red-600" />
      default:
        return <Wifi className="size-4" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "success":
        return "border-green-500 bg-green-50 text-green-700"
      case "error":
        return "border-red-500 bg-red-50 text-red-700"
      default:
        return ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={checkConnectivity}
        disabled={status === "checking"}
        className={`gap-2 ${getStatusColor()}`}
      >
        {getStatusIcon()}
        {status === "checking" ? "Checking..." : "Check API"}
      </Button>

      {/* Show API URL being used */}
      <div className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
        {config.apiUrl || "(same origin)"}
      </div>

      {/* Success response */}
      {status === "success" && response && (
        <div className="text-xs bg-green-50 border border-green-200 rounded-lg p-2 space-y-1">
          <div className="flex items-center gap-1 text-green-700 font-medium">
            <Check className="size-3" />
            Connected
          </div>
          <div className="text-green-600 font-mono">
            <div>Status: {response.status}</div>
            <div className="truncate">Time: {new Date(response.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      )}

      {/* Error response */}
      {status === "error" && error && (
        <div className="text-xs bg-red-50 border border-red-200 rounded-lg p-2 space-y-1">
          <div className="flex items-center gap-1 text-red-700 font-medium">
            <WifiOff className="size-3" />
            Connection Failed
          </div>
          <div className="text-red-600 font-mono break-all">
            {error}
          </div>
          <div className="text-red-500 mt-1">
            Check NEXT_PUBLIC_API_URL env var
          </div>
        </div>
      )}
    </div>
  )
}

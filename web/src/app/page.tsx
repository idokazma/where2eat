"use client"

import { Suspense } from "react"
import { MasterDashboard } from "@/components/master-dashboard"
import { RefreshCw } from "lucide-react"

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-textured flex items-center justify-center">
      <div className="text-center animate-reveal-up">
        <div className="relative mb-6">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <RefreshCw className="size-8 animate-spin text-primary" />
          </div>
        </div>
        <p className="text-lg font-medium text-foreground">Loading...</p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MasterDashboard />
    </Suspense>
  )
}
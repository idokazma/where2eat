"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Lock } from "lucide-react"

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001"

export default function AdminPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            The admin dashboard has moved to a dedicated application with full
            CMS capabilities, pipeline monitoring, analytics, and more.
          </p>
          <Button asChild className="w-full">
            <a href={ADMIN_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 mr-2" />
              Open Admin Dashboard
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
import { Youtube, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { PodcastData, YouTubeAnalysisRequest } from "@/types/restaurant"
import { endpoints } from "@/lib/config"
import { useLanguage } from "@/contexts/LanguageContext"

export function YoutubeAnalyzer() {
  const { t } = useLanguage()
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<PodcastData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisType, setAnalysisType] = useState<"video" | "channel">("video")
  const [channelJob, setChannelJob] = useState<any>(null)

  const isValidYouTubeUrl = (url: string) => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
    return youtubeRegex.test(url)
  }

  const handleAnalyze = async () => {
    if (!isValidYouTubeUrl(url)) {
      setError(t('youtube.invalidUrl'))
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const response = await fetch(endpoints.analyze.video(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error(t('youtube.errorStarting'))
      }

      const result = await response.json()

      // Analysis is now processing in background
      // Show success message and refresh after delay
      await new Promise(resolve => setTimeout(resolve, 2000))

      setError(null)
      setAnalysisResult(null)

      // Show success message and suggest refreshing
      alert(t('youtube.analysisStarted'))

      // Auto-refresh the page after a delay to show new restaurants
      setTimeout(() => {
        window.location.reload()
      }, 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : t('youtube.unexpectedError'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getStatusIcon = (status: YouTubeAnalysisRequest['status']) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="size-4 text-yellow-500" />
      case 'processing':
        return <Loader2 className="size-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="size-4 text-green-500" />
      case 'error':
        return <XCircle className="size-4 text-red-500" />
      default:
        return <AlertCircle className="size-4 text-gray-500" />
    }
  }

  const clearResults = () => {
    setUrl("")
    setAnalysisResult(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="size-5 text-red-500" />
            {t('youtube.analyzeVideo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="youtube-url" className="text-sm font-medium">
              {t('youtube.youtubeAddress')}
            </label>
            <Input
              id="youtube-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-left"
              disabled={isAnalyzing}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleAnalyze} 
              disabled={!url || isAnalyzing || !isValidYouTubeUrl(url)}
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin ml-2" />
                  {t('youtube.analyzing')}
                </>
              ) : (
                t('youtube.startAnalysis')
              )}
            </Button>
            
            {(analysisResult || error) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">{t('youtube.clearResults')}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('youtube.clearResults')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('youtube.confirmClearResults')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('youtube.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={clearResults}>{t('youtube.clear')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="size-4" />
                <span className="font-medium">{t('youtube.error')}</span>
              </div>
              <p className="text-sm text-destructive/80 mt-1 text-right">{error}</p>
            </div>
          )}

          {isAnalyzing && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Loader2 className="size-4 animate-spin" />
                <span className="font-medium">{t('youtube.analyzingVideo')}</span>
              </div>
              <div className="space-y-2 mt-3 text-sm text-blue-600 dark:text-blue-400">
                <div className="flex items-center gap-2">
                  {getStatusIcon('processing')}
                  <span>{t('youtube.downloadingTranscript')}</span>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  {getStatusIcon('pending')}
                  <span>{t('youtube.extractingRestaurantInfo')}</span>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  {getStatusIcon('pending')}
                  <span>{t('youtube.processingResults')}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="size-5 text-green-500" />
              {t('youtube.analysisResults')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">{t('episode.details')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('episode.language')}:</span>
                  <span className="ml-2">{analysisResult.episode_info.language}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('episode.analysisDate')}:</span>
                  <span className="ml-2">{analysisResult.episode_info.analysis_date}</span>
                </div>
              </div>
              <a
                href={analysisResult.episode_info.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm block mt-2"
              >
                {t('youtube.watchOriginalVideo')}
              </a>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">{t('youtube.episodeSummary')}</h3>
              <Textarea
                value={analysisResult.episode_summary}
                readOnly
                className="min-h-[100px] text-right"
              />
            </div>

            {analysisResult.food_trends.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">{t('youtube.foodTrends')}</h3>
                  <div className="flex flex-wrap gap-1">
                    {analysisResult.food_trends.map((trend, index) => (
                      <Badge key={index} variant="secondary">
                        {trend}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">
                {t('episode.restaurantsFound')} ({analysisResult.restaurants.length})
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('youtube.restaurantsWillAppear')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
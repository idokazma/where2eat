"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, ExternalLink, Clock, Quote, MapPin, Utensils } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { useLanguage } from "@/contexts/LanguageContext"

interface MentionTimestamp {
  timestamp: string
  duration: string
  context: string
  restaurant_name: string
  mention_type: 'introduction' | 'review' | 'recommendation' | 'comparison' | 'closing'
  key_points: string[]
}

interface MentionTimestampProps {
  restaurant: Restaurant
  mentions?: MentionTimestamp[]
  videoUrl: string
  onTimestampClick?: (timestamp: string) => void
}

export function MentionTimestampComponent({ restaurant, mentions = [], videoUrl, onTimestampClick }: MentionTimestampProps) {
  const { t } = useLanguage()
  const [expandedMention, setExpandedMention] = useState<number | null>(null)

  const formatTimestamp = (timestamp: string) => {
    // Convert timestamp like "1:23:45" or "23:45" to readable format
    const parts = timestamp.split(':')
    if (parts.length === 3) {
      return `${parts[0]}:${parts[1]}:${parts[2]}`
    } else if (parts.length === 2) {
      return `${parts[0]}:${parts[1]}`
    }
    return timestamp
  }

  const getTimestampUrl = (timestamp: string) => {
    // Convert timestamp to seconds for YouTube URL
    const parts = timestamp.split(':').map(p => parseInt(p))
    let totalSeconds = 0
    
    if (parts.length === 3) {
      totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      totalSeconds = parts[0] * 60 + parts[1]
    }
    
    return `${videoUrl}&t=${totalSeconds}s`
  }

  const getMentionTypeConfig = (type: string) => {
    const configs = {
      introduction: {
        label: t('mentions.types.presentation'),
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '👋'
      },
      review: {
        label: t('mentions.types.review'),
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        icon: '📝'
      },
      recommendation: {
        label: t('mentions.types.recommendation'),
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '⭐'
      },
      comparison: {
        label: t('mentions.types.comparison'),
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⚖️'
      },
      closing: {
        label: t('mentions.types.summary'),
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: '🏁'
      }
    }
    return configs[type as keyof typeof configs] || configs.review
  }

  // Generate synthetic timestamps if none provided (based on restaurant context)
  const syntheticMentions: MentionTimestamp[] = mentions.length > 0 ? mentions : [
    {
      timestamp: "5:30",
      duration: "2:15",
      context: restaurant.mention_context || `${t('mentions.discussionAbout')} ${restaurant.name_hebrew}`,
      restaurant_name: restaurant.name_hebrew,
      mention_type: 'review',
      key_points: [
        restaurant.host_comments || t('mentions.hostOpinion'),
        `${t('mentions.cuisine')} ${restaurant.cuisine_type}`,
        `${t('mentions.location')}: ${restaurant.location.city || t('mentions.locationNotSpecified')}`,
        `${t('mentions.priceRange')}: ${restaurant.price_range}`
      ].filter(Boolean)
    }
  ]

  return (
    <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5" />
          {t('mentions.timestampsInEpisode')} - {restaurant.name_hebrew}
          <Badge className="bg-white/20 text-white border-white/30">
            {syntheticMentions.length} {t('analytics.mentions')}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          {syntheticMentions.map((mention, index) => {
            const isExpanded = expandedMention === index
            const typeConfig = getMentionTypeConfig(mention.mention_type)
            
            return (
              <Card key={index} className="overflow-hidden border border-indigo-200">
                <div className="bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Button
                          size="sm"
                          className="bg-indigo-500 hover:bg-indigo-600 text-white"
                          onClick={() => {
                            const timestampUrl = getTimestampUrl(mention.timestamp)
                            window.open(timestampUrl, '_blank')
                            onTimestampClick?.(mention.timestamp)
                          }}
                        >
                          <Play className="size-4 ml-1" />
                          {formatTimestamp(mention.timestamp)}
                        </Button>
                        <Badge className={typeConfig.color}>
                          {typeConfig.icon} {typeConfig.label}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {t('mentions.duration')}: {mention.duration}
                        </span>
                      </div>
                      
                      <div className="flex items-start gap-2 mb-3">
                        <Quote className="size-4 text-indigo-500 mt-1 flex-shrink-0" />
                        <p className="text-gray-700 text-right">{mention.context}</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedMention(isExpanded ? null : index)}
                    >
                      {isExpanded ? t('mentions.less') : t('mentions.more')}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                      <h4 className="font-semibold text-indigo-800 mb-3">{t('mentions.keyPoints')}:</h4>
                      <div className="space-y-2">
                        {mention.key_points.map((point, pointIndex) => (
                          <div key={pointIndex} className="flex items-start gap-2">
                            <span className="w-2 h-2 bg-indigo-400 rounded-full mt-2 flex-shrink-0" />
                            <span className="text-sm text-indigo-700">{point}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t border-indigo-200">
                        <div className="flex gap-4 text-sm text-indigo-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="size-4" />
                            {restaurant.location.city || t('mentions.locationNotSpecified')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Utensils className="size-4" />
                            {restaurant.cuisine_type}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Direct link to full video */}
        <div className="mt-6 pt-4 border-t border-indigo-200">
          <Button
            variant="outline"
            asChild
            className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
          >
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 ml-2" />
              {t('mentions.watchFullEpisode')}
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
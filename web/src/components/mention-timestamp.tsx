"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Play, ExternalLink, Clock, Quote, MapPin, Utensils } from "lucide-react"
import { Restaurant } from "@/types/restaurant"

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
        label: 'הצגה',
        color: 'bg-info/10 text-info border-info/20',
        icon: '👋'
      },
      review: {
        label: 'ביקורת',
        color: 'bg-primary/10 text-primary border-primary/20',
        icon: '📝'
      },
      recommendation: {
        label: 'המלצה',
        color: 'bg-success/10 text-success border-success/20',
        icon: '⭐'
      },
      comparison: {
        label: 'השוואה',
        color: 'bg-warning/10 text-warning border-warning/20',
        icon: '⚖️'
      },
      closing: {
        label: 'סיכום',
        color: 'bg-muted text-muted-foreground border-border',
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
      context: restaurant.mention_context || `דיון על ${restaurant.name_hebrew}`,
      restaurant_name: restaurant.name_hebrew,
      mention_type: 'review',
      key_points: [
        restaurant.host_comments || "דעת המובחר",
        `מטבח ${restaurant.cuisine_type}`,
        `מיקום: ${restaurant.location?.city || 'לא צוין'}`,
        `טווח מחיר: ${restaurant.price_range}`
      ].filter(Boolean)
    }
  ]

  return (
    <Card className="card-standard border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="bg-mesh-warm text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5" />
          זמני אזכור בפרק - {restaurant.name_hebrew}
          <Badge className="bg-white/20 text-white border-white/30">
            {syntheticMentions.length} אזכורים
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
        <div className="space-y-4">
          {syntheticMentions.map((mention, index) => {
            const isExpanded = expandedMention === index
            const typeConfig = getMentionTypeConfig(mention.mention_type)

            return (
              <Card key={index} className="overflow-hidden border border-border">
                <div className="bg-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        <span className="text-sm text-muted-foreground">
                          משך: {mention.duration}
                        </span>
                      </div>

                      <div className="flex items-start gap-2 mb-3">
                        <Quote className="size-4 text-primary mt-1 flex-shrink-0" />
                        <p className="text-foreground/80 text-right">{mention.context}</p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedMention(isExpanded ? null : index)}
                    >
                      {isExpanded ? 'פחות' : 'עוד'}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 p-4 bg-accent/50 rounded-xl border border-border">
                      <h4 className="font-semibold text-foreground mb-3">נקודות עיקריות:</h4>
                      <div className="space-y-2">
                        {mention.key_points.map((point, pointIndex) => (
                          <div key={pointIndex} className="flex items-start gap-2">
                            <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                            <span className="text-sm text-foreground/70">{point}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="size-4" />
                            {restaurant.location?.city || 'מיקום לא צוין'}
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
        <div className="mt-6 pt-4 border-t border-border">
          <Button
            variant="outline"
            asChild
            className="w-full border-primary/30 text-primary hover:bg-primary/5"
          >
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4 ml-2" />
              צפה בפרק המלא ב-YouTube
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
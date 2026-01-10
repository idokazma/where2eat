"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, MapPin, Star, Users, Sparkles } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { OptimizedImage } from "./optimized-image"

interface BentoHeroProps {
  featuredRestaurants: Restaurant[]
  stats: {
    totalRestaurants: number
    totalEpisodes: number
    topCuisines: [string, number][]
    topLocations: [string, number][]
  }
}

export function BentoHero({ featuredRestaurants, stats }: BentoHeroProps) {
  const featured = featuredRestaurants.slice(0, 3)

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8 stagger-reveal">
      {/* Large featured card - Main restaurant */}
      {featured[0] && (
        <Card className="md:col-span-7 md:row-span-2 card-featured group cursor-pointer">
          <div className="relative h-full min-h-[420px]">
            <OptimizedImage
              src="/placeholder-restaurant.jpg"
              alt={featured[0].name_hebrew}
              className="w-full h-full"
              aspectRatio="landscape"
              priority
            />
            {/* Enhanced gradient overlay */}
            <div className="absolute inset-0 image-overlay-dark" />
            <div className="absolute inset-0 image-overlay-vignette opacity-50" />

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
              <Badge className="bg-primary/90 backdrop-blur-sm text-primary-foreground mb-4 rounded-full px-4 py-1">
                <Sparkles className="size-3 mr-1.5" />
                מומלץ ביותר
              </Badge>
              <h2 className="font-display text-4xl font-black text-white mb-3 leading-tight tracking-tight drop-shadow-xl">
                {featured[0].name_hebrew}
              </h2>
              <div className="flex items-center gap-5 text-sm">
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <MapPin className="size-4" />
                  <span>{featured[0].location.city}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span>{featured[0].cuisine_type}</span>
                </div>
              </div>
              {featured[0].host_comments && (
                <p className="text-white/85 text-sm mt-4 line-clamp-2 italic leading-relaxed max-w-lg">
                  &ldquo;{featured[0].host_comments}&rdquo;
                </p>
              )}
            </div>

            {/* Hover effect */}
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </Card>
      )}

      {/* Stats Grid - Refined gradient */}
      <Card className="md:col-span-5 bg-mesh-warm text-white border-0 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 grain-overlay opacity-20" />
        <div className="relative p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="size-5" />
            </div>
            <h3 className="text-lg font-bold">סטטיסטיקות מערכת</h3>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="font-display text-4xl font-black">{stats.totalRestaurants}</div>
              <div className="text-white/70 text-sm mt-1">מסעדות</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="font-display text-4xl font-black">{stats.totalEpisodes}</div>
              <div className="text-white/70 text-sm mt-1">פרקים</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="font-display text-3xl font-bold">{stats.topCuisines.length}</div>
              <div className="text-white/70 text-sm mt-1">סוגי מטבח</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <div className="font-display text-3xl font-bold">{stats.topLocations.length}</div>
              <div className="text-white/70 text-sm mt-1">ערים</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Secondary featured restaurant */}
      {featured[1] && (
        <Card className="md:col-span-3 card-featured group cursor-pointer">
          <div className="relative h-full min-h-[200px]">
            <OptimizedImage
              src="/placeholder-restaurant.jpg"
              alt={featured[1].name_hebrew}
              className="w-full h-full"
              aspectRatio="square"
            />
            <div className="absolute inset-0 image-overlay-dark" />
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <h3 className="font-display font-bold text-xl mb-1.5 drop-shadow-lg">{featured[1].name_hebrew}</h3>
              <div className="flex items-center gap-1.5 text-sm text-white/80">
                <MapPin className="size-3.5" />
                <span>{featured[1].location.city}</span>
              </div>
            </div>
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </Card>
      )}

      {/* Top cuisines card - Refined gradient */}
      <Card className="md:col-span-2 bg-mesh-cool text-white border-0 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 grain-overlay opacity-20" />
        <div className="relative p-5 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Users className="size-4" />
            </div>
            <h3 className="font-bold text-sm">מטבחים פופולריים</h3>
          </div>
          <div className="space-y-2.5 flex-1">
            {stats.topCuisines.slice(0, 3).map(([cuisine, count]) => (
              <div key={cuisine} className="flex justify-between items-center text-sm bg-white/10 rounded-lg px-3 py-2">
                <span className="font-medium">{cuisine}</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-0 rounded-full">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Third featured restaurant - if available */}
      {featured[2] && (
        <Card className="md:col-span-0 hidden md:block card-featured group cursor-pointer">
          <div className="relative h-full min-h-[200px]">
            <OptimizedImage
              src="/placeholder-restaurant.jpg"
              alt={featured[2].name_hebrew}
              className="w-full h-full"
              aspectRatio="portrait"
            />
            <div className="absolute inset-0 image-overlay-dark" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-display font-bold text-lg mb-1 drop-shadow-lg">{featured[2].name_hebrew}</h3>
              <p className="text-xs text-white/70">{featured[2].cuisine_type}</p>
            </div>
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </Card>
      )}
    </div>
  )
}

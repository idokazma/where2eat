"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, MapPin, Star, Users } from "lucide-react"
import { Restaurant } from "@/types/restaurant"
import { OptimizedImage } from "./optimized-image"
import { useLanguage } from "@/contexts/LanguageContext"

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
  const { t } = useLanguage()
  const featured = featuredRestaurants.slice(0, 3)

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
      {/* Large featured card - Main restaurant */}
      {featured[0] && (
        <Card className="md:col-span-7 md:row-span-2 overflow-hidden border-0 shadow-lg group cursor-pointer">
          <div className="relative h-full min-h-[400px]">
            <OptimizedImage
              src="/placeholder-restaurant.jpg"
              alt={featured[0].name_hebrew}
              className="w-full h-full"
              aspectRatio="landscape"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <Badge className="bg-orange-500 text-white mb-3">{t('restaurant.highlyRecommended')}</Badge>
              <h2 className="image-headline text-white mb-2">
                {featured[0].name_hebrew}
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  <span>{featured[0].location.city}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="size-4 fill-yellow-400 text-yellow-400" />
                  <span>{featured[0].cuisine_type}</span>
                </div>
              </div>
              {featured[0].host_comments && (
                <p className="text-white/90 text-sm mt-3 line-clamp-2 italic">
                  "{featured[0].host_comments}"
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <Card className="md:col-span-5 bg-gradient-to-br from-orange-500 to-amber-500 text-white border-0 shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-5" />
            <h3 className="text-lg font-bold">{t('stats.systemStats')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold">{stats.totalRestaurants}</div>
              <div className="text-orange-100 text-sm">{t('common.restaurants')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{stats.totalEpisodes}</div>
              <div className="text-orange-100 text-sm">{t('common.episodes')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.topCuisines.length}</div>
              <div className="text-orange-100 text-sm">{t('stats.cuisineTypes')}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.topLocations.length}</div>
              <div className="text-orange-100 text-sm">{t('stats.cities')}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Secondary featured restaurant */}
      {featured[1] && (
        <Card className="md:col-span-3 overflow-hidden border-0 shadow-lg group cursor-pointer">
          <div className="relative h-full min-h-[200px]">
            <OptimizedImage
              src="/placeholder-restaurant.jpg"
              alt={featured[1].name_hebrew}
              className="w-full h-full"
              aspectRatio="square"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-bold text-lg mb-1">{featured[1].name_hebrew}</h3>
              <div className="flex items-center gap-1 text-sm">
                <MapPin className="size-3" />
                <span>{featured[1].location.city}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Top cuisines card */}
      <Card className="md:col-span-2 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0 shadow-lg">
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Users className="size-4" />
            <h3 className="font-bold text-sm">{t('stats.popularCuisines')}</h3>
          </div>
          <div className="space-y-2 flex-1">
            {stats.topCuisines.slice(0, 3).map(([cuisine, count]) => (
              <div key={cuisine} className="flex justify-between items-center text-sm">
                <span className="font-medium">{cuisine}</span>
                <Badge variant="secondary" className="bg-white/20 text-white border-0">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Third featured restaurant - if available */}
      {featured[2] && (
        <Card className="md:col-span-0 hidden md:block overflow-hidden border-0 shadow-lg group cursor-pointer">
          <div className="relative h-full min-h-[200px]">
            <OptimizedImage
              src="/placeholder-restaurant.jpg"
              alt={featured[2].name_hebrew}
              className="w-full h-full"
              aspectRatio="portrait"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h3 className="font-bold text-base mb-1">{featured[2].name_hebrew}</h3>
              <p className="text-xs opacity-90">{featured[2].cuisine_type}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

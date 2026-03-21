"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { Restaurant } from "@/types/restaurant"

interface FavoritesContextType {
  favorites: string[]
  addFavorite: (restaurantId: string) => void
  removeFavorite: (restaurantId: string) => void
  isFavorite: (restaurantId: string) => boolean
  favoriteRestaurants: Restaurant[]
  setAllRestaurants: (restaurants: Restaurant[]) => void
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem("where2eat-favorites")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [allRestaurants, setAllRestaurantsState] = useState<Restaurant[]>([])

  // Save favorites to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("where2eat-favorites", JSON.stringify(favorites))
  }, [favorites])

  const addFavorite = (restaurantId: string) => {
    setFavorites(prev => [...prev.filter(id => id !== restaurantId), restaurantId])
  }

  const removeFavorite = (restaurantId: string) => {
    setFavorites(prev => prev.filter(id => id !== restaurantId))
  }

  const isFavorite = (restaurantId: string) => {
    return favorites.includes(restaurantId)
  }

  const favoriteRestaurants = allRestaurants.filter(restaurant =>
    isFavorite(restaurant.id || restaurant.google_places?.place_id || restaurant.name_hebrew)
  )

  const setAllRestaurants = useCallback((restaurants: Restaurant[]) => {
    setAllRestaurantsState(restaurants)
  }, [])

  return (
    <FavoritesContext.Provider value={{
      favorites,
      addFavorite,
      removeFavorite,
      isFavorite,
      favoriteRestaurants,
      setAllRestaurants
    }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  const context = useContext(FavoritesContext)
  if (context === undefined) {
    throw new Error("useFavorites must be used within a FavoritesProvider")
  }
  return context
}
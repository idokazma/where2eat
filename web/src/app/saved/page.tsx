'use client';

import { Heart } from 'lucide-react';
import { PageLayout } from '@/components/layout';
import { RestaurantCardNew } from '@/components/restaurant';
import { useFavorites } from '@/contexts/favorites-context';
import { getRestaurantImage } from '@/lib/images';

export default function SavedPage() {
  const { favoriteRestaurants } = useFavorites();

  return (
    <PageLayout title="שמורים" showHeader showBottomNav>
      <div className="px-4 py-4">
        {favoriteRestaurants.length > 0 ? (
          <>
            <p className="text-sm text-[var(--color-ink-muted)] mb-4">
              {favoriteRestaurants.length} מסעדות שמורות
            </p>
            <div className="space-y-4">
              {favoriteRestaurants.map((restaurant, index) => (
                <div
                  key={restaurant.google_places?.place_id || restaurant.name_hebrew}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
                >
                  <RestaurantCardNew
                    restaurant={restaurant}
                    imageUrl={getRestaurantImage(restaurant) || undefined}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-surface)] flex items-center justify-center">
              <Heart className="w-10 h-10 text-[var(--color-ink-muted)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">
              עדיין לא שמרת מסעדות
            </h2>
            <p className="text-[var(--color-ink-muted)] max-w-xs">
              גלה מסעדות חדשות ושמור את המועדפות עליך בלחיצה על הלב
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

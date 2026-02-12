import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { Restaurant } from '@/types/restaurant';

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <FavoritesProvider>{children}</FavoritesProvider>
    </LanguageProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export function createMockRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    name_hebrew: 'מסעדת טסט',
    name_english: 'Test Restaurant',
    cuisine_type: 'Italian',
    price_range: 'mid-range',
    host_opinion: 'positive',
    host_comments: 'Great food',
    location: {
      city: 'Tel Aviv',
      neighborhood: 'Neve Tzedek',
      address: '123 Test St',
      region: 'Center',
    },
    contact_info: {
      phone: '03-1234567',
      website: 'https://test.com',
      hours: '10:00-22:00',
    },
    menu_items: [],
    special_features: [],
    status: 'open',
    business_news: '',
    episode_info: {
      video_id: 'abc123',
      video_url: 'https://youtube.com/watch?v=abc123',
      language: 'he',
      analysis_date: '2024-01-01',
    },
    photos: [],
    image_url: null,
    ...overrides,
  };
}

export * from '@testing-library/react';

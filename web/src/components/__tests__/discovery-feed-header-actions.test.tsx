/** @jest-environment jsdom */

import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders, createMockRestaurant } from '@/test-utils';
import { SettingsProvider } from '@/contexts/settings-context';
import { DiscoveryFeed } from '../feed/DiscoveryFeed';
import type { Restaurant } from '@/types/restaurant';

const restaurant: Restaurant = createMockRestaurant();

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

beforeAll(() => {
  // The card carousel and infinite scroll use observers that jsdom lacks.
  Object.assign(globalThis, { ResizeObserver: ObserverStub, IntersectionObserver: ObserverStub });
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }) as unknown as MediaQueryList);
});

describe('DiscoveryFeed header actions', () => {
  it('renders extra controls next to the compact toggle', () => {
    renderWithProviders(
      <SettingsProvider>
        <DiscoveryFeed restaurants={[restaurant]} headerActions={<button type="button">ערבב</button>} />
      </SettingsProvider>
    );
    const shuffle = screen.getByText('ערבב');
    const compact = screen.getByLabelText(/תצוגה קומפקטית|תצוגת כרטיסים/);
    expect(shuffle.parentElement).toBe(compact.parentElement);
  });
});

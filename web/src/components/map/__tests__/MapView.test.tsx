/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock react-leaflet components
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({
    fitBounds: jest.fn(),
    panTo: jest.fn(),
    eachLayer: jest.fn(),
    flyTo: jest.fn(),
  }),
}));

// Mock leaflet
jest.mock('leaflet', () => ({
  Icon: {
    Default: {
      prototype: {
        _getIconUrl: jest.fn(),
      },
      mergeOptions: jest.fn(),
    },
  },
  divIcon: jest.fn(() => ({})),
  latLngBounds: jest.fn(() => ({
    extend: jest.fn(),
  })),
}));

// We need to import after mocking
const mockRestaurants = [
  {
    id: '1',
    name_hebrew: 'מסעדת הבוקר',
    name_english: 'Breakfast Place',
    cuisine_type: 'ארוחת בוקר',
    location: {
      coordinates: {
        latitude: 32.0853,
        longitude: 34.7818,
      },
      city: 'תל אביב',
    },
    rating: {
      google_rating: 4.5,
      total_reviews: 120,
    },
    host_opinion: 'positive' as const,
  },
  {
    id: '2',
    name_hebrew: 'פיצה רומא',
    location: {
      coordinates: {
        latitude: 31.7683,
        longitude: 35.2137,
      },
      city: 'ירושלים',
    },
    host_opinion: 'neutral' as const,
  },
];

describe('MapView Component', () => {
  it('renders map container when restaurants have coordinates', async () => {
    // Dynamic import to avoid SSR issues in tests
    const MapView = (await import('../MapView')).default;

    render(<MapView restaurants={mockRestaurants} />);

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('shows empty state when no restaurants have coordinates', async () => {
    const MapView = (await import('../MapView')).default;

    render(<MapView restaurants={[]} />);

    expect(screen.getByText(/אין מסעדות עם נתוני מיקום/)).toBeInTheDocument();
  });

  it('renders markers for each restaurant with coordinates', async () => {
    const MapView = (await import('../MapView')).default;

    render(<MapView restaurants={mockRestaurants} />);

    const markers = screen.getAllByTestId('marker');
    expect(markers).toHaveLength(2);
  });

  it('displays restaurant count overlay', async () => {
    const MapView = (await import('../MapView')).default;

    render(<MapView restaurants={mockRestaurants} />);

    expect(screen.getByText(/2 מסעדות על המפה/)).toBeInTheDocument();
  });
});

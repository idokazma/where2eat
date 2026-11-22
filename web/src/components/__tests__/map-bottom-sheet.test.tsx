/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MapBottomSheet } from '../map/MapBottomSheet';
import type { WithDistance } from '@/lib/geo-utils';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const actual = jest.requireActual('react');
  return {
    motion: {
      div: actual.forwardRef(({ children, style, className, onDrag, onDragEnd, drag, dragConstraints, dragElastic, ...props }: any, ref: any) => (
        <div ref={ref} style={style} className={className} {...props}>
          {children}
        </div>
      )),
    },
    useMotionValue: jest.fn(() => ({
      get: () => 80,
      set: jest.fn(),
    })),
    useTransform: jest.fn(() => 0),
    animate: jest.fn(),
    PanInfo: {} as any,
  };
});

// Mock react-window v2 (uses List + useListRef instead of FixedSizeList)
jest.mock('react-window', () => {
  const React = jest.requireActual('react');
  return {
    List: ({ rowComponent: RowComponent, rowCount, rowProps, listRef }: any) => {
      // Assign mock API to listRef
      if (listRef && typeof listRef === 'object') {
        listRef.current = { scrollToRow: jest.fn(), element: null };
      }
      return (
        <div data-testid="virtual-list">
          {Array.from({ length: rowCount }, (_, index) => (
            <div key={index}>
              <RowComponent
                index={index}
                style={{}}
                ariaAttributes={{ role: 'listitem', 'aria-posinset': index + 1, 'aria-setsize': rowCount }}
                {...(rowProps || {})}
              />
            </div>
          ))}
        </div>
      );
    },
    useListRef: () => React.useRef(null),
  };
});

// Mock haptics
jest.mock('@/lib/haptics', () => ({
  triggerHaptic: jest.fn(),
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  ChevronUp: ({ className }: { className?: string }) => (
    <span data-testid="chevron-up" className={className}>^</span>
  ),
  Star: ({ className }: { className?: string }) => (
    <span data-testid="star-icon" className={className}>★</span>
  ),
  Heart: ({ className }: { className?: string }) => (
    <span data-testid="heart-icon" className={className}>♥</span>
  ),
  MapPin: ({ className }: { className?: string }) => (
    <span data-testid="mappin-icon" className={className}>📍</span>
  ),
}));

interface MapRestaurant {
  id?: string;
  name_hebrew: string;
  cuisine_type?: string | null;
  location?: {
    city?: string | null;
    [key: string]: unknown;
  };
  rating?: {
    google_rating?: number;
    total_reviews?: number;
  };
  google_places?: {
    place_id?: string;
    google_name?: string;
  };
  host_opinion?: string | null;
  episode_info?: { published_at?: string };
}

describe('MapBottomSheet', () => {
  const mockRestaurants: WithDistance<MapRestaurant>[] = [
    {
      item: {
        id: '1',
        name_hebrew: 'מסעדה ראשונה',
        cuisine_type: 'איטלקית',
        location: { city: 'תל אביב' },
        rating: { google_rating: 4.5, total_reviews: 100 },
        google_places: { place_id: 'place1', google_name: 'First Restaurant' },
      },
      distance: 0.5,
    },
    {
      item: {
        id: '2',
        name_hebrew: 'מסעדה שנייה',
        cuisine_type: 'יפנית',
        location: { city: 'ירושלים' },
        rating: { google_rating: 4.2, total_reviews: 75 },
        google_places: { place_id: 'place2', google_name: 'Second Restaurant' },
      },
      distance: 1.2,
    },
  ];

  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders restaurant count text', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('2 מסעדות קרובות')).toBeInTheDocument();
  });

  it('renders the drag handle bar', () => {
    const { container } = render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    const dragHandle = container.querySelector('.w-10.h-1');
    expect(dragHandle).toBeInTheDocument();
    expect(dragHandle).toHaveClass('bg-gray-300');
    expect(dragHandle).toHaveClass('rounded-full');
  });

  it('renders ChevronUp icon', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByTestId('chevron-up')).toBeInTheDocument();
  });

  it('calls onSelect when a list item is clicked', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    // Find and click the first restaurant button
    const firstRestaurant = screen.getByText('מסעדה ראשונה');
    const button = firstRestaurant.closest('button');

    expect(button).toBeInTheDocument();
    fireEvent.click(button!);

    expect(mockOnSelect).toHaveBeenCalledWith('place1');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('renders all restaurants in the list', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('מסעדה ראשונה')).toBeInTheDocument();
    expect(screen.getByText('מסעדה שנייה')).toBeInTheDocument();
  });

  it('shows correct count for single restaurant', () => {
    const singleRestaurant = [mockRestaurants[0]];

    render(
      <MapBottomSheet
        restaurants={singleRestaurant}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('1 מסעדות קרובות')).toBeInTheDocument();
  });

  it('shows correct count for zero restaurants', () => {
    render(
      <MapBottomSheet
        restaurants={[]}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('0 מסעדות קרובות')).toBeInTheDocument();
  });

  it('highlights selected restaurant', () => {
    const { container } = render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId="place1"
        onSelect={mockOnSelect}
      />
    );

    const firstRestaurant = screen.getByText('מסעדה ראשונה');
    const button = firstRestaurant.closest('button');

    expect(button).toHaveClass('bg-blue-50');
    expect(button).toHaveClass('border-r-blue-500');
  });

  it('passes favoriteIds to list items', () => {
    const favoriteIds = new Set(['place1']);

    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
        favoriteIds={favoriteIds}
      />
    );

    // First restaurant should show heart icon
    const heartIcons = screen.getAllByTestId('heart-icon');
    expect(heartIcons.length).toBeGreaterThan(0);
  });

  it('passes heatColors to list items', () => {
    const heatColors = new Map([
      ['place1', '#ef4444'],
      ['place2', '#3b82f6'],
    ]);

    const { container } = render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
        heatColors={heatColors}
      />
    );

    // Check for colored dots
    const colorDots = container.querySelectorAll('[style*="background"]');
    expect(colorDots.length).toBeGreaterThan(0);
  });

  it('renders virtual list', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByTestId('virtual-list')).toBeInTheDocument();
  });

  it("shows the restaurant's own name, Google's name only when it has none", () => {
    const restaurantsWithMixedNames: WithDistance<MapRestaurant>[] = [
      {
        item: {
          id: '1',
          name_hebrew: 'שם עברי',
          google_places: { place_id: 'place1', google_name: 'Google Name' },
        },
        distance: 0.5,
      },
      {
        item: {
          id: '2',
          name_hebrew: '',
          google_places: { place_id: 'place2', google_name: 'Google Only' },
        },
        distance: 1.2,
      },
    ];

    render(
      <MapBottomSheet
        restaurants={restaurantsWithMixedNames}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    // Google matches can be wrong, so the stored name wins.
    expect(screen.getByText('שם עברי')).toBeInTheDocument();
    expect(screen.queryByText('Google Name')).toBeNull();
    expect(screen.getByText('Google Only')).toBeInTheDocument();
  });

  it('handles restaurants without google_places', () => {
    const restaurantsWithoutPlaces: WithDistance<MapRestaurant>[] = [
      {
        item: {
          id: 'rest1',
          name_hebrew: 'מסעדה ללא Google Places',
          cuisine_type: 'מקסיקנית',
        },
        distance: 0.8,
      },
    ];

    render(
      <MapBottomSheet
        restaurants={restaurantsWithoutPlaces}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText('מסעדה ללא Google Places')).toBeInTheDocument();

    // Click should use id as identifier
    const button = screen.getByText('מסעדה ללא Google Places').closest('button');
    fireEvent.click(button!);

    expect(mockOnSelect).toHaveBeenCalledWith('rest1');
  });

  it('handles restaurants without id (uses name as fallback)', () => {
    const restaurantsWithoutId: WithDistance<MapRestaurant>[] = [
      {
        item: {
          name_hebrew: 'מסעדה ללא ID',
          cuisine_type: 'תאילנדית',
        },
        distance: 0.3,
      },
    ];

    render(
      <MapBottomSheet
        restaurants={restaurantsWithoutId}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    const button = screen.getByText('מסעדה ללא ID').closest('button');
    fireEvent.click(button!);

    expect(mockOnSelect).toHaveBeenCalledWith('מסעדה ללא ID');
  });

  it('has proper accessibility structure', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // At least 2 restaurant buttons
  });

  it('displays restaurant details correctly', () => {
    render(
      <MapBottomSheet
        restaurants={mockRestaurants}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    );

    // Check first restaurant details
    expect(screen.getByText('איטלקית')).toBeInTheDocument();
    expect(screen.getByText('תל אביב')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('500 מ׳')).toBeInTheDocument();

    // Check second restaurant details
    expect(screen.getByText('יפנית')).toBeInTheDocument();
    expect(screen.getByText('ירושלים')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('1.2 ק״מ')).toBeInTheDocument();
  });
});

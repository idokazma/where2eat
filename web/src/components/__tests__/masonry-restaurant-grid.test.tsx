import { render, screen } from '@testing-library/react'
import { MasonryRestaurantGrid } from '../masonry-restaurant-grid'
import { Restaurant } from '@/types/restaurant'

// Mock components
jest.mock('../visual-restaurant-card', () => ({
  VisualRestaurantCard: ({ restaurant }: any) => (
    <div data-testid="restaurant-card">{restaurant.name_hebrew}</div>
  ),
}))

jest.mock('../skeletons/grid-skeleton', () => ({
  GridSkeleton: () => <div data-testid="grid-skeleton">Loading...</div>,
}))

const mockRestaurants: Restaurant[] = [
  {
    name_hebrew: 'מסעדה 1',
    name_english: 'Restaurant 1',
    cuisine_type: 'Italian',
    price_range: 'mid-range',
    host_opinion: 'positive',
    host_comments: 'Great place',
    location: {
      city: 'Tel Aviv',
      region: 'Center',
      neighborhood: 'Neve Tzedek',
      address: '123 Test St',
      latitude: 32.0,
      longitude: 34.0,
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
      episode_title: 'Test Episode',
      video_id: 'abc123',
      youtube_url: 'https://youtube.com/watch?v=abc123',
      publish_date: '2024-01-01',
    },
  },
  {
    name_hebrew: 'מסעדה 2',
    name_english: 'Restaurant 2',
    cuisine_type: 'Japanese',
    price_range: 'expensive',
    host_opinion: 'positive',
    host_comments: 'Amazing sushi',
    location: {
      city: 'Tel Aviv',
      region: 'Center',
      neighborhood: 'Florentin',
      address: '456 Test Ave',
      latitude: 32.1,
      longitude: 34.1,
    },
    contact_info: {
      phone: '03-7654321',
      website: 'https://test2.com',
      hours: '11:00-23:00',
    },
    menu_items: [],
    special_features: [],
    status: 'open',
    business_news: '',
    episode_info: {
      episode_title: 'Test Episode 2',
      video_id: 'def456',
      youtube_url: 'https://youtube.com/watch?v=def456',
      publish_date: '2024-01-02',
    },
  },
]

describe('MasonryRestaurantGrid', () => {
  it('shows loading skeleton when isLoading is true', () => {
    render(
      <MasonryRestaurantGrid
        restaurants={[]}
        isLoading={true}
      />
    )

    expect(screen.getByTestId('grid-skeleton')).toBeInTheDocument()
  })

  it('shows empty state when no restaurants', () => {
    render(
      <MasonryRestaurantGrid
        restaurants={[]}
        isLoading={false}
      />
    )

    expect(screen.getByText('לא נמצאו מסעדות')).toBeInTheDocument()
    expect(screen.getByText('נסה לשנות את הסינון או החיפוש')).toBeInTheDocument()
  })

  it('renders restaurant cards when data is provided', () => {
    render(
      <MasonryRestaurantGrid
        restaurants={mockRestaurants}
        isLoading={false}
      />
    )

    expect(screen.getByText('מסעדה 1')).toBeInTheDocument()
    expect(screen.getByText('מסעדה 2')).toBeInTheDocument()
  })

  it('renders correct number of restaurant cards', () => {
    render(
      <MasonryRestaurantGrid
        restaurants={mockRestaurants}
        isLoading={false}
      />
    )

    const cards = screen.getAllByTestId('restaurant-card')
    expect(cards).toHaveLength(2)
  })
})

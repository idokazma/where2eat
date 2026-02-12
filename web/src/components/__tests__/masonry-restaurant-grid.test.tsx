import { screen } from '@testing-library/react'
import { renderWithProviders, createMockRestaurant } from '@/test-utils'
import { MasonryRestaurantGrid } from '../masonry-restaurant-grid'

// Mock components
jest.mock('../visual-restaurant-card', () => ({
  VisualRestaurantCard: ({ restaurant }: any) => (
    <div data-testid="restaurant-card">{restaurant.name_hebrew}</div>
  ),
}))

jest.mock('../skeletons/grid-skeleton', () => ({
  GridSkeleton: () => <div data-testid="grid-skeleton">Loading...</div>,
}))

const mockRestaurants = [
  createMockRestaurant({ name_hebrew: 'מסעדה 1', cuisine_type: 'Italian' }),
  createMockRestaurant({ name_hebrew: 'מסעדה 2', cuisine_type: 'Japanese' }),
]

describe('MasonryRestaurantGrid', () => {
  it('shows loading skeleton when isLoading is true', () => {
    renderWithProviders(
      <MasonryRestaurantGrid
        restaurants={[]}
        isLoading={true}
      />
    )

    expect(screen.getByTestId('grid-skeleton')).toBeInTheDocument()
  })

  it('shows empty state when no restaurants', () => {
    renderWithProviders(
      <MasonryRestaurantGrid
        restaurants={[]}
        isLoading={false}
      />
    )

    expect(screen.getByText('לא נמצאו מסעדות')).toBeInTheDocument()
    expect(screen.getByText('נסה לשנות את הסינון או החיפוש')).toBeInTheDocument()
  })

  it('renders restaurant cards when data is provided', () => {
    renderWithProviders(
      <MasonryRestaurantGrid
        restaurants={mockRestaurants}
        isLoading={false}
      />
    )

    expect(screen.getByText('מסעדה 1')).toBeInTheDocument()
    expect(screen.getByText('מסעדה 2')).toBeInTheDocument()
  })

  it('renders correct number of restaurant cards', () => {
    renderWithProviders(
      <MasonryRestaurantGrid
        restaurants={mockRestaurants}
        isLoading={false}
      />
    )

    const cards = screen.getAllByTestId('restaurant-card')
    expect(cards).toHaveLength(2)
  })
})

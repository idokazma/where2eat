import { screen } from '@testing-library/react';
import { renderWithProviders, createMockRestaurant } from '@/test-utils';
import { RestaurantCardNew } from '../RestaurantCardNew';

describe('RestaurantCardNew', () => {
  it('renders restaurant name', () => {
    const restaurant = createMockRestaurant({ name_hebrew: 'מסעדת טסט' });
    renderWithProviders(<RestaurantCardNew restaurant={restaurant} />);

    expect(screen.getByText('מסעדת טסט')).toBeInTheDocument();
  });

  it('renders image when imageUrl provided', () => {
    const restaurant = createMockRestaurant();
    renderWithProviders(
      <RestaurantCardNew restaurant={restaurant} imageUrl="https://example.com/photo.jpg" />
    );

    const img = screen.getByAltText('מסעדת טסט');
    expect(img).toHaveAttribute('src', expect.stringContaining('photo.jpg'));
  });

  it('shows gradient fallback when no imageUrl', () => {
    const restaurant = createMockRestaurant({ cuisine_type: 'Italian' });
    renderWithProviders(
      <RestaurantCardNew restaurant={restaurant} />
    );

    // Cuisine type text appears in the gradient fallback and meta items
    const italianElements = screen.getAllByText('Italian');
    expect(italianElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows photo count badge when multiple photos', () => {
    const restaurant = createMockRestaurant({
      photos: [
        { photo_reference: 'ref1', photo_url: '', width: 400, height: 300 },
        { photo_reference: 'ref2', photo_url: '', width: 400, height: 300 },
        { photo_reference: 'ref3', photo_url: '', width: 400, height: 300 },
      ],
    });
    renderWithProviders(
      <RestaurantCardNew restaurant={restaurant} imageUrl="https://example.com/photo.jpg" />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show photo count badge when 0 or 1 photos', () => {
    const restaurant = createMockRestaurant({
      photos: [{ photo_reference: 'ref1', photo_url: '', width: 400, height: 300 }],
    });
    renderWithProviders(
      <RestaurantCardNew restaurant={restaurant} imageUrl="https://example.com/photo.jpg" />
    );

    // Only 1 photo - no badge
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('shows host quote when opinion is positive', () => {
    const restaurant = createMockRestaurant({
      host_opinion: 'positive',
      host_comments: 'Amazing food!',
    });
    renderWithProviders(<RestaurantCardNew restaurant={restaurant} />);

    expect(screen.getByText(/Amazing food!/)).toBeInTheDocument();
  });

  it('shows meta items (city, cuisine, price)', () => {
    const restaurant = createMockRestaurant({
      location: { city: 'Tel Aviv', neighborhood: 'Neve Tzedek', address: '123 Test', region: 'Center' },
      cuisine_type: 'Italian',
      price_range: 'expensive',
    });
    renderWithProviders(
      <RestaurantCardNew restaurant={restaurant} imageUrl="https://example.com/photo.jpg" />
    );

    expect(screen.getByText('Tel Aviv')).toBeInTheDocument();
    expect(screen.getByText('₪₪₪')).toBeInTheDocument();
    // Cuisine type appears in meta items
    expect(screen.getByText('Italian')).toBeInTheDocument();
  });
});

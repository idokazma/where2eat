/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RestaurantListItem } from '../map/RestaurantListItem';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
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

describe('RestaurantListItem', () => {
  it('renders restaurant name', () => {
    render(<RestaurantListItem name="המסעדה של יוסי" />);

    expect(screen.getByText('המסעדה של יוסי')).toBeInTheDocument();
  });

  it('shows cuisine type when provided', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        cuisineType="איטלקית"
      />
    );

    expect(screen.getByText('איטלקית')).toBeInTheDocument();
  });

  it('shows city when provided', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        city="תל אביב"
      />
    );

    expect(screen.getByText('תל אביב')).toBeInTheDocument();
  });

  it('shows both cuisine type and city with separator', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        cuisineType="איטלקית"
        city="תל אביב"
      />
    );

    expect(screen.getByText('איטלקית')).toBeInTheDocument();
    expect(screen.getByText('תל אביב')).toBeInTheDocument();
    expect(screen.getByText('·')).toBeInTheDocument();
  });

  it('shows Google rating when provided', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        googleRating={4.5}
      />
    );

    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByTestId('star-icon')).toBeInTheDocument();
  });

  it('shows formatted distance when provided', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        distance={2.345}
      />
    );

    // formatDistance(2.345) should return "2.3 ק״מ"
    expect(screen.getByText('2.3 ק״מ')).toBeInTheDocument();
  });

  it('shows distance in meters when less than 1km', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        distance={0.5}
      />
    );

    // formatDistance(0.5) should return "500 מ׳"
    expect(screen.getByText('500 מ׳')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();

    render(
      <RestaurantListItem
        name="Test Restaurant"
        onClick={handleClick}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows favorite heart icon when isFavorite is true', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        isFavorite={true}
      />
    );

    const heartIcon = screen.getByTestId('heart-icon');
    expect(heartIcon).toBeInTheDocument();
    expect(heartIcon).toHaveClass('text-red-500');
    expect(heartIcon).toHaveClass('fill-red-500');
  });

  it('does not show heart icon when isFavorite is false', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        isFavorite={false}
      />
    );

    expect(screen.queryByTestId('heart-icon')).not.toBeInTheDocument();
  });

  it('applies highlighted styles when isHighlighted is true', () => {
    const { container } = render(
      <RestaurantListItem
        name="Test Restaurant"
        isHighlighted={true}
      />
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-blue-50');
    expect(button).toHaveClass('border-r-blue-500');
  });

  it('applies normal styles when isHighlighted is false', () => {
    const { container } = render(
      <RestaurantListItem
        name="Test Restaurant"
        isHighlighted={false}
      />
    );

    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('hover:bg-gray-50');
  });

  it('renders heat color dot when heatColor is provided', () => {
    const { container } = render(
      <RestaurantListItem
        name="Test Restaurant"
        heatColor="#ef4444"
      />
    );

    const colorDot = container.querySelector('[style*="background"]');
    expect(colorDot).toBeInTheDocument();
    expect(colorDot).toHaveStyle({ backgroundColor: '#ef4444' });
  });

  it('does not render heat color dot when heatColor is not provided', () => {
    const { container } = render(
      <RestaurantListItem name="Test Restaurant" />
    );

    const colorDot = container.querySelector('.w-3.h-3.rounded-full');
    expect(colorDot).not.toBeInTheDocument();
  });

  it('has RTL direction', () => {
    const { container } = render(
      <RestaurantListItem name="Test Restaurant" />
    );

    const button = container.querySelector('button');
    expect(button).toHaveAttribute('dir', 'rtl');
  });

  it('renders all props together', () => {
    const handleClick = jest.fn();

    render(
      <RestaurantListItem
        name="המסעדה של יוסי"
        cuisineType="איטלקית"
        city="תל אביב"
        googleRating={4.7}
        totalReviews={250}
        distance={1.2}
        heatColor="#22c55e"
        isFavorite={true}
        isHighlighted={true}
        onClick={handleClick}
      />
    );

    expect(screen.getByText('המסעדה של יוסי')).toBeInTheDocument();
    expect(screen.getByText('איטלקית')).toBeInTheDocument();
    expect(screen.getByText('תל אביב')).toBeInTheDocument();
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText('1.2 ק״מ')).toBeInTheDocument();
    expect(screen.getByTestId('heart-icon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('handles null values gracefully', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        cuisineType={null}
        city={null}
        googleRating={null}
        distance={null}
      />
    );

    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
    // Should not crash, and null values should not be displayed
  });

  it('renders as a button element', () => {
    render(<RestaurantListItem name="Test Restaurant" />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('shows MapPin icon when city is provided', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        city="ירושלים"
      />
    );

    expect(screen.getByTestId('mappin-icon')).toBeInTheDocument();
  });

  it('displays rating with one decimal place', () => {
    render(
      <RestaurantListItem
        name="Test Restaurant"
        googleRating={4}
      />
    );

    expect(screen.getByText('4.0')).toBeInTheDocument();
  });
});

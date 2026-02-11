import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoGallery } from '../PhotoGallery';

const mockPhotos = [
  '/api/photos/ref1?maxwidth=800',
  '/api/photos/ref2?maxwidth=800',
  '/api/photos/ref3?maxwidth=800',
  '/api/photos/ref4?maxwidth=800',
  '/api/photos/ref5?maxwidth=800',
];

describe('PhotoGallery', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('renders nothing when photos array is empty', () => {
    const { container } = render(
      <PhotoGallery photos={[]} restaurantName="Test" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders thumbnails for each photo', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(5);
    expect(images[0]).toHaveAttribute('alt', 'Test Restaurant - 1');
    expect(images[4]).toHaveAttribute('alt', 'Test Restaurant - 5');
  });

  it('opens lightbox on thumbnail click and hides body overflow', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    // Click the first thumbnail button
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    // Lightbox should be visible with close button
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('shows photo counter in lightbox', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]); // Click second thumbnail

    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('shows navigation buttons when multiple photos', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);

    expect(screen.getByLabelText('Next photo')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous photo')).toBeInTheDocument();
  });

  it('navigates to next photo', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const thumbnails = screen.getAllByRole('button');
    fireEvent.click(thumbnails[0]); // Open at index 0

    expect(screen.getByText('1 / 5')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next photo'));
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('navigates to previous photo', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const thumbnails = screen.getAllByRole('button');
    fireEvent.click(thumbnails[1]); // Open at index 1

    expect(screen.getByText('2 / 5')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous photo'));
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('shows dot indicators for each photo', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const thumbnails = screen.getAllByRole('button');
    fireEvent.click(thumbnails[0]);

    // There should be dot buttons with aria labels for each photo
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByLabelText(`Go to photo ${i}`)).toBeInTheDocument();
    }
  });

  it('closes lightbox and restores body overflow', () => {
    render(<PhotoGallery photos={mockPhotos} restaurantName="Test Restaurant" />);

    const thumbnails = screen.getAllByRole('button');
    fireEvent.click(thumbnails[0]);

    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByLabelText('Close'));
    expect(document.body.style.overflow).toBe('');
  });
});

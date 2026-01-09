import { render, screen, waitFor } from '@testing-library/react'
import { OptimizedImage } from '../optimized-image'

// Mock react-intersection-observer
jest.mock('react-intersection-observer', () => ({
  useInView: () => ({
    ref: jest.fn(),
    inView: true,
  }),
}))

describe('OptimizedImage', () => {
  it('renders with correct alt text', () => {
    render(
      <OptimizedImage
        src="/test-image.jpg"
        alt="Test Restaurant"
        aspectRatio="landscape"
      />
    )

    expect(screen.getByAltText('Test Restaurant')).toBeInTheDocument()
  })

  it('applies correct aspect ratio class', () => {
    const { container } = render(
      <OptimizedImage
        src="/test-image.jpg"
        alt="Test"
        aspectRatio="square"
      />
    )

    expect(container.querySelector('.aspect-square')).toBeInTheDocument()
  })

  it('shows shimmer loading effect initially', () => {
    const { container } = render(
      <OptimizedImage
        src="/test-image.jpg"
        alt="Test"
      />
    )

    expect(container.querySelector('.shimmer')).toBeInTheDocument()
  })

  it('displays fallback on error', async () => {
    render(
      <OptimizedImage
        src="/broken-image.jpg"
        alt="Test Restaurant"
        fallbackSrc="/fallback.jpg"
      />
    )

    const img = screen.getByAltText('Test Restaurant')

    // Simulate image error
    img.dispatchEvent(new Event('error'))

    await waitFor(() => {
      expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
    })
  })

  it('applies custom className', () => {
    const { container } = render(
      <OptimizedImage
        src="/test-image.jpg"
        alt="Test"
        className="custom-class"
      />
    )

    expect(container.querySelector('.custom-class')).toBeInTheDocument()
  })
})

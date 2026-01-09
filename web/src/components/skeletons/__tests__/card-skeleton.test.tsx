import { render } from '@testing-library/react'
import { CardSkeleton } from '../card-skeleton'

describe('CardSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<CardSkeleton />)
    expect(container).toBeInTheDocument()
  })

  it('applies landscape aspect ratio by default', () => {
    const { container } = render(<CardSkeleton />)
    expect(container.querySelector('.aspect-landscape')).toBeInTheDocument()
  })

  it('applies square aspect ratio when specified', () => {
    const { container } = render(<CardSkeleton aspectRatio="square" />)
    expect(container.querySelector('.aspect-square')).toBeInTheDocument()
  })

  it('applies portrait aspect ratio when specified', () => {
    const { container } = render(<CardSkeleton aspectRatio="portrait" />)
    expect(container.querySelector('.aspect-portrait')).toBeInTheDocument()
  })

  it('applies wide aspect ratio when specified', () => {
    const { container } = render(<CardSkeleton aspectRatio="wide" />)
    expect(container.querySelector('.aspect-wide')).toBeInTheDocument()
  })

  it('contains shimmer animation class', () => {
    const { container } = render(<CardSkeleton />)
    const skeletons = container.querySelectorAll('.shimmer')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

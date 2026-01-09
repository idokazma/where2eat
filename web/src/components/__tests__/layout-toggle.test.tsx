import { render, screen, fireEvent } from '@testing-library/react'
import { LayoutToggle } from '../layout-toggle'

describe('LayoutToggle', () => {
  it('renders all three layout options', () => {
    const mockOnChange = jest.fn()

    render(
      <LayoutToggle
        currentLayout="masonry"
        onLayoutChange={mockOnChange}
      />
    )

    expect(screen.getByText('מזונרי')).toBeInTheDocument()
    expect(screen.getByText('גריד')).toBeInTheDocument()
    expect(screen.getByText('רשימה')).toBeInTheDocument()
  })

  it('highlights current layout', () => {
    const mockOnChange = jest.fn()

    const { rerender } = render(
      <LayoutToggle
        currentLayout="masonry"
        onLayoutChange={mockOnChange}
      />
    )

    const masonryButton = screen.getByText('מזונרי').closest('button')
    expect(masonryButton).toHaveClass('bg-primary')

    rerender(
      <LayoutToggle
        currentLayout="grid"
        onLayoutChange={mockOnChange}
      />
    )

    const gridButton = screen.getByText('גריד').closest('button')
    expect(gridButton).toHaveClass('bg-primary')
  })

  it('calls onLayoutChange when clicking buttons', () => {
    const mockOnChange = jest.fn()

    render(
      <LayoutToggle
        currentLayout="masonry"
        onLayoutChange={mockOnChange}
      />
    )

    fireEvent.click(screen.getByText('גריד'))
    expect(mockOnChange).toHaveBeenCalledWith('grid')

    fireEvent.click(screen.getByText('רשימה'))
    expect(mockOnChange).toHaveBeenCalledWith('list')
  })

  it('does not call onChange when clicking current layout', () => {
    const mockOnChange = jest.fn()

    render(
      <LayoutToggle
        currentLayout="masonry"
        onLayoutChange={mockOnChange}
      />
    )

    fireEvent.click(screen.getByText('מזונרי'))
    expect(mockOnChange).toHaveBeenCalledWith('masonry')
  })
})

/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { HeatLegend } from '../map/HeatLegend';

describe('HeatLegend', () => {
  it('renders gradient and labels when visible is true (default)', () => {
    const { container } = render(<HeatLegend />);

    // Should render the container
    const legendContainer = container.querySelector('div');
    expect(legendContainer).toBeInTheDocument();

    // Should have gradient bar
    const gradientBar = container.querySelector('[style*="background"]');
    expect(gradientBar).toBeInTheDocument();
    expect(gradientBar).toHaveStyle({
      background: 'linear-gradient(to left, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)',
    });

    // Should display Hebrew labels
    expect(screen.getByText('חדש')).toBeInTheDocument();
    expect(screen.getByText('ישן')).toBeInTheDocument();
  });

  it('renders when visible is explicitly true', () => {
    const { container } = render(<HeatLegend visible={true} />);

    const legendContainer = container.querySelector('div');
    expect(legendContainer).toBeInTheDocument();

    expect(screen.getByText('חדש')).toBeInTheDocument();
    expect(screen.getByText('ישן')).toBeInTheDocument();
  });

  it('returns null when visible is false', () => {
    const { container } = render(<HeatLegend visible={false} />);

    // Container should be empty (null rendered)
    expect(container.firstChild).toBeNull();

    // Labels should not be in document
    expect(screen.queryByText('חדש')).not.toBeInTheDocument();
    expect(screen.queryByText('ישן')).not.toBeInTheDocument();
  });

  it('displays Hebrew text correctly', () => {
    render(<HeatLegend visible={true} />);

    const newLabel = screen.getByText('חדש');
    const oldLabel = screen.getByText('ישן');

    expect(newLabel).toBeInTheDocument();
    expect(oldLabel).toBeInTheDocument();

    // Verify they are span elements
    expect(newLabel.tagName).toBe('SPAN');
    expect(oldLabel.tagName).toBe('SPAN');
  });

  it('has correct styling classes', () => {
    const { container } = render(<HeatLegend visible={true} />);

    const legendContainer = container.firstChild as HTMLElement;

    expect(legendContainer).toHaveClass('absolute');
    // Sits above the map's bottom controls.
    expect(legendContainer).toHaveClass('bottom-24');
    expect(legendContainer).toHaveClass('left-4');
    // Below the map's bottom sheet (z-[1000]), so the open sheet covers it.
    expect(legendContainer).toHaveClass('z-[999]');
    expect(legendContainer).toHaveClass('bg-white/90');
    expect(legendContainer).toHaveClass('backdrop-blur-sm');
    expect(legendContainer).toHaveClass('rounded-lg');
    expect(legendContainer).toHaveClass('shadow-md');
  });

  it('has RTL direction', () => {
    const { container } = render(<HeatLegend visible={true} />);

    const legendContainer = container.firstChild as HTMLElement;
    expect(legendContainer).toHaveAttribute('dir', 'rtl');
  });

  it('gradient bar has correct dimensions', () => {
    const { container } = render(<HeatLegend visible={true} />);

    const gradientBar = container.querySelector('[style*="background"]');

    expect(gradientBar).toHaveClass('w-[80px]');
    expect(gradientBar).toHaveClass('h-[8px]');
    expect(gradientBar).toHaveClass('rounded-full');
  });

  it('labels have correct text styling', () => {
    render(<HeatLegend visible={true} />);

    const newLabel = screen.getByText('חדש');
    const oldLabel = screen.getByText('ישן');

    expect(newLabel).toHaveClass('text-[10px]');
    expect(newLabel).toHaveClass('font-medium');

    expect(oldLabel).toHaveClass('text-[10px]');
    expect(oldLabel).toHaveClass('font-medium');
  });

  it('renders in correct order: new label, gradient, old label (RTL)', () => {
    const { container } = render(<HeatLegend visible={true} />);

    const flexContainer = container.querySelector('.flex.items-center.gap-2');
    const children = Array.from(flexContainer?.children || []);

    expect(children).toHaveLength(3);

    // In RTL: new (right), gradient (center), old (left)
    expect(children[0].textContent).toBe('חדש');
    expect(children[1]).toHaveClass('w-[80px]'); // gradient bar
    expect(children[2].textContent).toBe('ישן');
  });
});

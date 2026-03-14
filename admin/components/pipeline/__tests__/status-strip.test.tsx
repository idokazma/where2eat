import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusStrip } from '../status-strip';
import type { PipelineOverview, PipelineStats } from '@/types';

const mockOverview: PipelineOverview = {
  queued: 5,
  processing: 2,
  processed_24h: 15,
  failed_24h: 1,
  completed: 100,
  failed: 3,
  skipped: 0,
  total: 108,
};

const mockStats: PipelineStats = {
  status_counts: { completed: 100, failed: 3 },
  avg_processing_seconds: 125,
  completed_last_24h: 15,
  completed_last_7d: 80,
  failure_rate_percent: 5,
  total_items: 108,
};

describe('StatusStrip', () => {
  it('renders with reduced opacity when loading', () => {
    const { container } = render(
      <StatusStrip overview={null} stats={null} isLoading={true} />
    );
    const strip = container.firstChild as HTMLElement;
    expect(strip.className).toContain('opacity-60');
  });

  it('renders with full opacity when not loading', () => {
    const { container } = render(
      <StatusStrip overview={mockOverview} stats={mockStats} isLoading={false} />
    );
    const strip = container.firstChild as HTMLElement;
    expect(strip.className).toContain('opacity-100');
  });

  it('renders metrics from overview data', () => {
    render(
      <StatusStrip overview={mockOverview} stats={mockStats} isLoading={false} />
    );
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Done 24h')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows restaurant count when provided', () => {
    render(
      <StatusStrip
        overview={mockOverview}
        stats={mockStats}
        restaurantCount={42}
        isLoading={false}
      />
    );
    expect(screen.getByText('Restaurants')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('does not show restaurant metric when not provided', () => {
    render(
      <StatusStrip overview={mockOverview} stats={mockStats} isLoading={false} />
    );
    expect(screen.queryByText('Restaurants')).not.toBeInTheDocument();
  });

  it('shows success rate with green class for low failure rate', () => {
    render(
      <StatusStrip overview={mockOverview} stats={mockStats} isLoading={false} />
    );
    expect(screen.getByText('Success')).toBeInTheDocument();
    // 100 - 5 = 95%
    expect(screen.getByText('95%')).toBeInTheDocument();
    // failure_rate_percent 5 <= 10 => text-green-600
    const successValue = screen.getByText('95%');
    expect(successValue.className).toContain('text-green-600');
  });

  it('shows success rate with yellow class for moderate failure rate', () => {
    const moderateStats: PipelineStats = {
      ...mockStats,
      failure_rate_percent: 15,
    };
    render(
      <StatusStrip overview={mockOverview} stats={moderateStats} isLoading={false} />
    );
    const successValue = screen.getByText('85%');
    expect(successValue.className).toContain('text-yellow-600');
  });

  it('shows success rate with red class for high failure rate', () => {
    const highFailStats: PipelineStats = {
      ...mockStats,
      failure_rate_percent: 25,
    };
    render(
      <StatusStrip overview={mockOverview} stats={highFailStats} isLoading={false} />
    );
    const successValue = screen.getByText('75%');
    expect(successValue.className).toContain('text-red-600');
  });

  it('handles null overview gracefully', () => {
    render(
      <StatusStrip overview={null} stats={null} isLoading={false} />
    );
    expect(screen.getByText('Queued')).toBeInTheDocument();
    // Should show dashes for missing values
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('handles null stats gracefully', () => {
    render(
      <StatusStrip overview={mockOverview} stats={null} isLoading={false} />
    );
    expect(screen.getByText('Success')).toBeInTheDocument();
    // Success rate should be dash when stats is null
    const successLabel = screen.getByText('Success');
    const metricContainer = successLabel.closest('div');
    const valueSpan = metricContainer?.querySelector('.font-bold');
    expect(valueSpan?.textContent).toBe('—');
  });
});

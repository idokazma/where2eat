/** @jest-environment jsdom */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreatorFilter } from '../filters/CreatorFilter';

const creators = ['גיל הראל', 'מדברים מהבטן'];

describe('CreatorFilter source picker', () => {
  it('renders nothing for a single source', () => {
    const { container } = render(<CreatorFilter creators={['x']} selected={null} onSelect={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows one button and no source list until opened', () => {
    render(<CreatorFilter creators={creators} selected={null} onSelect={jest.fn()} />);
    expect(screen.getByText('מקור')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a sheet with counts and selects a source', () => {
    const onSelect = jest.fn();
    render(
      <CreatorFilter
        creators={creators}
        selected={null}
        onSelect={onSelect}
        counts={{ 'גיל הראל': 11, 'מדברים מהבטן': 353 }}
        totalCount={364}
      />
    );
    fireEvent.click(screen.getByText('מקור'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('353')).toBeInTheDocument();
    expect(screen.getByText('364')).toBeInTheDocument();
    fireEvent.click(screen.getByText('גיל הראל'));
    expect(onSelect).toHaveBeenCalledWith('גיל הראל');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the selection on the button and clears via all-sources', () => {
    const onSelect = jest.fn();
    render(<CreatorFilter creators={creators} selected="גיל הראל" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('מקור: גיל הראל'));
    fireEvent.click(screen.getByText('כל המקורות'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('lists sources by restaurant count, largest first', () => {
    render(
      <CreatorFilter
        creators={['בית הפודיום', 'גיל הראל', 'מדברים מהבטן']}
        selected={null}
        onSelect={jest.fn()}
        counts={{ 'בית הפודיום': 7, 'גיל הראל': 11, 'מדברים מהבטן': 339 }}
        totalCount={357}
      />
    );
    fireEvent.click(screen.getByText('מקור'));
    const rows = screen.getAllByRole('button').map((b) => b.textContent || '');
    const order = ['מדברים מהבטן', 'גיל הראל', 'בית הפודיום'].map((n) => rows.findIndex((t) => t.includes(n)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it('closes on Escape', () => {
    render(<CreatorFilter creators={creators} selected={null} onSelect={jest.fn()} />);
    fireEvent.click(screen.getByText('מקור'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

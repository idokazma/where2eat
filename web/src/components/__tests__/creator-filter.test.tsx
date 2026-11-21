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
    expect(screen.getByText('מקור: כולם')).toBeInTheDocument();
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
    fireEvent.click(screen.getByText('מקור: כולם'));
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

  it('closes on Escape', () => {
    render(<CreatorFilter creators={creators} selected={null} onSelect={jest.fn()} />);
    fireEvent.click(screen.getByText('מקור: כולם'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/** @jest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { HomeHero } from '../HomeHero';

describe('HomeHero', () => {
  it('asks where to eat today, with "היום?" highlighted', () => {
    render(<HomeHero />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('איפה אוכלים היום?');
    expect(screen.getByText('היום?')).toHaveClass('hl-marker');
  });

  it('no longer leads with a restaurant count', () => {
    render(<HomeHero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/\d|מסעדות|פספוסים/);
  });
});

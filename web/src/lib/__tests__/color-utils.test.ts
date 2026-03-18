/** @jest-environment jsdom */

import {
  ratioToHeatColor,
  dateToHeatColor,
  getDateRange,
} from '../color-utils';

describe('color-utils', () => {
  describe('ratioToHeatColor', () => {
    it('returns a reddish color for ratio=1 (newest)', () => {
      const color = ratioToHeatColor(1);

      // Should be hex format
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);

      // Parse hex to RGB
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // For hue=0 (red), saturation=75%, lightness=50%
      // Red component should be dominant
      expect(r).toBeGreaterThan(g);
      expect(r).toBeGreaterThan(b);
    });

    it('returns a bluish color for ratio=0 (oldest)', () => {
      const color = ratioToHeatColor(0);

      expect(color).toMatch(/^#[0-9a-f]{6}$/i);

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // For hue=220 (blue), blue component should be dominant
      expect(b).toBeGreaterThan(r);
    });

    it('returns a middle color for ratio=0.5', () => {
      const color = ratioToHeatColor(0.5);

      expect(color).toMatch(/^#[0-9a-f]{6}$/i);

      // Hue should be around 110 (yellowish-green)
      // All components should be relatively balanced
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Green should be highest for hue=110
      expect(g).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(b);
    });

    it('clamps ratio below 0 to 0', () => {
      const color = ratioToHeatColor(-0.5);
      const expectedColor = ratioToHeatColor(0);

      expect(color).toBe(expectedColor);
    });

    it('clamps ratio above 1 to 1', () => {
      const color = ratioToHeatColor(1.5);
      const expectedColor = ratioToHeatColor(1);

      expect(color).toBe(expectedColor);
    });

    it('returns consistent colors for same ratio', () => {
      const color1 = ratioToHeatColor(0.7);
      const color2 = ratioToHeatColor(0.7);

      expect(color1).toBe(color2);
    });
  });

  describe('dateToHeatColor', () => {
    const minDate = new Date('2024-01-01');
    const maxDate = new Date('2024-12-31');

    it('returns gray for null date', () => {
      const color = dateToHeatColor(null, minDate, maxDate);

      expect(color).toBe('#9ca3af');
    });

    it('returns gray for undefined date', () => {
      const color = dateToHeatColor(undefined, minDate, maxDate);

      expect(color).toBe('#9ca3af');
    });

    it('returns gray for invalid date string', () => {
      const color = dateToHeatColor('invalid-date', minDate, maxDate);

      expect(color).toBe('#9ca3af');
    });

    it('returns hot color for single-point date range', () => {
      const singleDate = new Date('2024-06-15');
      const color = dateToHeatColor('2024-06-15', singleDate, singleDate);

      // Should be same as ratioToHeatColor(1)
      const expectedColor = ratioToHeatColor(1);
      expect(color).toBe(expectedColor);
    });

    it('returns hot color for newest date in range', () => {
      const color = dateToHeatColor('2024-12-31', minDate, maxDate);

      // Should be close to red (ratio=1)
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      const r = parseInt(color.slice(1, 3), 16);
      const b = parseInt(color.slice(5, 7), 16);
      expect(r).toBeGreaterThan(b);
    });

    it('returns cold color for oldest date in range', () => {
      const color = dateToHeatColor('2024-01-01', minDate, maxDate);

      // Should be close to blue (ratio=0)
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      const r = parseInt(color.slice(1, 3), 16);
      const b = parseInt(color.slice(5, 7), 16);
      expect(b).toBeGreaterThan(r);
    });

    it('returns middle color for middle date in range', () => {
      // Mid-year date
      const color = dateToHeatColor('2024-07-01', minDate, maxDate);

      expect(color).toMatch(/^#[0-9a-f]{6}$/i);

      // Should be somewhere in the middle of the spectrum
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Green should be relatively high for middle hues
      expect(g).toBeGreaterThan(50);
    });

    it('handles ISO 8601 date strings', () => {
      const color = dateToHeatColor('2024-06-15T12:00:00Z', minDate, maxDate);

      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color).not.toBe('#9ca3af'); // Should not be gray
    });
  });

  describe('getDateRange', () => {
    it('returns correct min and max dates', () => {
      const restaurants = [
        { episode_info: { published_at: '2024-03-15' } },
        { episode_info: { published_at: '2024-01-10' } },
        { episode_info: { published_at: '2024-06-20' } },
      ];

      const range = getDateRange(restaurants);

      expect(range).not.toBeNull();
      expect(range!.min).toEqual(new Date('2024-01-10'));
      expect(range!.max).toEqual(new Date('2024-06-20'));
    });

    it('returns null for empty array', () => {
      const range = getDateRange([]);

      expect(range).toBeNull();
    });

    it('returns null when no published_at dates exist', () => {
      const restaurants = [
        { episode_info: {} },
        { episode_info: undefined },
        {},
      ];

      const range = getDateRange(restaurants);

      expect(range).toBeNull();
    });

    it('returns null when all dates are invalid', () => {
      const restaurants = [
        { episode_info: { published_at: 'invalid' } },
        { episode_info: { published_at: 'not-a-date' } },
      ];

      const range = getDateRange(restaurants);

      expect(range).toBeNull();
    });

    it('ignores invalid dates and uses valid ones', () => {
      const restaurants = [
        { episode_info: { published_at: '2024-03-15' } },
        { episode_info: { published_at: 'invalid' } },
        { episode_info: { published_at: '2024-01-10' } },
        { episode_info: {} },
      ];

      const range = getDateRange(restaurants);

      expect(range).not.toBeNull();
      expect(range!.min).toEqual(new Date('2024-01-10'));
      expect(range!.max).toEqual(new Date('2024-03-15'));
    });

    it('handles single valid date', () => {
      const restaurants = [
        { episode_info: { published_at: '2024-05-20' } },
      ];

      const range = getDateRange(restaurants);

      expect(range).not.toBeNull();
      expect(range!.min).toEqual(new Date('2024-05-20'));
      expect(range!.max).toEqual(new Date('2024-05-20'));
    });

    it('handles restaurants without episode_info', () => {
      const restaurants = [
        { episode_info: { published_at: '2024-03-15' } },
        { name: 'No episode info' },
        { episode_info: { published_at: '2024-01-10' } },
      ];

      const range = getDateRange(restaurants);

      expect(range).not.toBeNull();
      expect(range!.min).toEqual(new Date('2024-01-10'));
      expect(range!.max).toEqual(new Date('2024-03-15'));
    });
  });
});

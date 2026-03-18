/** @jest-environment jsdom */

import {
  haversineDistance,
  sortByDistance,
  getNClosest,
  getBoundsForPoints,
  formatDistance,
  type GeoCoords,
  type WithDistance,
} from '../geo-utils';

describe('geo-utils', () => {
  describe('haversineDistance', () => {
    it('calculates distance between Tel Aviv and Jerusalem (within 5%)', () => {
      const telAviv: GeoCoords = { lat: 32.0853, lng: 34.7818 };
      const jerusalem: GeoCoords = { lat: 31.7683, lng: 35.2137 };

      const distance = haversineDistance(telAviv, jerusalem);

      // Expected distance ~54km, allow 5% tolerance
      expect(distance).toBeGreaterThan(51); // 54 - 5%
      expect(distance).toBeLessThan(57); // 54 + 5%
    });

    it('returns 0 for same point', () => {
      const point: GeoCoords = { lat: 32.0853, lng: 34.7818 };

      const distance = haversineDistance(point, point);

      expect(distance).toBe(0);
    });

    it('calculates symmetric distance', () => {
      const a: GeoCoords = { lat: 32.0853, lng: 34.7818 };
      const b: GeoCoords = { lat: 31.7683, lng: 35.2137 };

      const distanceAB = haversineDistance(a, b);
      const distanceBA = haversineDistance(b, a);

      expect(distanceAB).toBe(distanceBA);
    });
  });

  describe('sortByDistance', () => {
    it('returns items sorted by ascending distance', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 }; // Tel Aviv
      const locations = [
        { name: 'Jerusalem', lat: 31.7683, lng: 35.2137 }, // ~54km
        { name: 'Herzliya', lat: 32.1656, lng: 34.8433 },  // ~10km
        { name: 'Haifa', lat: 32.7940, lng: 34.9896 },     // ~80km
      ];

      const sorted = sortByDistance(
        locations,
        userCoords,
        (item) => ({ lat: item.lat, lng: item.lng })
      );

      expect(sorted).toHaveLength(3);
      expect(sorted[0].item.name).toBe('Herzliya'); // Closest
      expect(sorted[1].item.name).toBe('Jerusalem');
      expect(sorted[2].item.name).toBe('Haifa'); // Farthest

      // Verify ascending order
      expect(sorted[0].distance).toBeLessThan(sorted[1].distance);
      expect(sorted[1].distance).toBeLessThan(sorted[2].distance);
    });

    it('filters out items with null coordinates', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 };
      const locations = [
        { name: 'Valid', lat: 32.1656, lng: 34.8433 },
        { name: 'Invalid', lat: null as any, lng: null as any },
      ];

      const sorted = sortByDistance(
        locations,
        userCoords,
        (item) => item.lat && item.lng ? { lat: item.lat, lng: item.lng } : null
      );

      expect(sorted).toHaveLength(1);
      expect(sorted[0].item.name).toBe('Valid');
    });

    it('returns empty array for empty input', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 };

      const sorted = sortByDistance<any>(
        [],
        userCoords,
        (item) => ({ lat: item.lat, lng: item.lng })
      );

      expect(sorted).toEqual([]);
    });
  });

  describe('getNClosest', () => {
    it('returns exactly N closest items', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 };
      const locations = [
        { name: 'A', lat: 32.1, lng: 34.8 },
        { name: 'B', lat: 32.2, lng: 34.9 },
        { name: 'C', lat: 32.3, lng: 35.0 },
        { name: 'D', lat: 32.4, lng: 35.1 },
      ];

      const closest = getNClosest(
        locations,
        userCoords,
        (item) => ({ lat: item.lat, lng: item.lng }),
        2
      );

      expect(closest).toHaveLength(2);
      expect(closest[0].distance).toBeLessThan(closest[1].distance);
    });

    it('returns fewer than N when input has fewer items', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 };
      const locations = [
        { name: 'A', lat: 32.1, lng: 34.8 },
      ];

      const closest = getNClosest(
        locations,
        userCoords,
        (item) => ({ lat: item.lat, lng: item.lng }),
        5
      );

      expect(closest).toHaveLength(1);
    });

    it('returns empty array when input is empty', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 };

      const closest = getNClosest<any>(
        [],
        userCoords,
        (item) => ({ lat: item.lat, lng: item.lng }),
        5
      );

      expect(closest).toEqual([]);
    });

    it('returns empty array when N is 0', () => {
      const userCoords: GeoCoords = { lat: 32.0853, lng: 34.7818 };
      const locations = [
        { name: 'A', lat: 32.1, lng: 34.8 },
      ];

      const closest = getNClosest(
        locations,
        userCoords,
        (item) => ({ lat: item.lat, lng: item.lng }),
        0
      );

      expect(closest).toEqual([]);
    });
  });

  describe('getBoundsForPoints', () => {
    it('returns correct bounds for multiple points', () => {
      const points: GeoCoords[] = [
        { lat: 32.0, lng: 34.5 },
        { lat: 32.5, lng: 35.0 },
        { lat: 31.5, lng: 34.0 },
      ];

      const bounds = getBoundsForPoints(points);

      expect(bounds).toEqual([
        [31.5, 34.0], // South-West (min lat, min lng)
        [32.5, 35.0], // North-East (max lat, max lng)
      ]);
    });

    it('returns same point for single point', () => {
      const points: GeoCoords[] = [
        { lat: 32.0853, lng: 34.7818 },
      ];

      const bounds = getBoundsForPoints(points);

      expect(bounds).toEqual([
        [32.0853, 34.7818],
        [32.0853, 34.7818],
      ]);
    });

    it('returns null for empty array', () => {
      const bounds = getBoundsForPoints([]);

      expect(bounds).toBeNull();
    });

    it('handles negative coordinates', () => {
      const points: GeoCoords[] = [
        { lat: -33.8688, lng: 151.2093 }, // Sydney
        { lat: -37.8136, lng: 144.9631 }, // Melbourne
      ];

      const bounds = getBoundsForPoints(points);

      expect(bounds).toEqual([
        [-37.8136, 144.9631], // Further south, further west
        [-33.8688, 151.2093], // Further north, further east
      ]);
    });
  });

  describe('formatDistance', () => {
    it('formats distance less than 1km in meters', () => {
      expect(formatDistance(0.5)).toBe('500 מ׳');
      expect(formatDistance(0.123)).toBe('123 מ׳');
      expect(formatDistance(0.999)).toBe('999 מ׳');
    });

    it('formats distance 1km or more in kilometers with 1 decimal', () => {
      expect(formatDistance(1)).toBe('1.0 ק״מ');
      expect(formatDistance(2.345)).toBe('2.3 ק״מ');
      expect(formatDistance(54.321)).toBe('54.3 ק״מ');
      expect(formatDistance(100)).toBe('100.0 ק״מ');
    });

    it('rounds meters to whole numbers', () => {
      expect(formatDistance(0.1234)).toBe('123 מ׳');
      expect(formatDistance(0.1256)).toBe('126 מ׳');
    });

    it('handles zero distance', () => {
      expect(formatDistance(0)).toBe('0 מ׳');
    });

    it('handles very small distances', () => {
      expect(formatDistance(0.001)).toBe('1 מ׳');
      expect(formatDistance(0.0001)).toBe('0 מ׳');
    });
  });
});

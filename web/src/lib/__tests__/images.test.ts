import {
  getRestaurantImage,
  getRestaurantImages,
  getPhotoProxyUrl,
  getCuisineGradient,
} from '../images';
import { Restaurant } from '@/types/restaurant';

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return { name_hebrew: 'test', ...overrides };
}

describe('getRestaurantImage', () => {
  it('returns proxy URL when photo_reference exists', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: 'ref123', photo_url: 'https://direct.com/img.jpg', width: 400, height: 300 },
      ],
    });
    expect(getRestaurantImage(r)).toBe('/api/photos/ref123?maxwidth=800');
  });

  it('returns photo_url when no photo_reference', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: '', photo_url: 'https://direct.com/img.jpg', width: 400, height: 300 },
      ],
    });
    expect(getRestaurantImage(r)).toBe('https://direct.com/img.jpg');
  });

  it('falls back to image_url when no photos', () => {
    const r = makeRestaurant({ image_url: 'https://fallback.com/image.jpg' });
    expect(getRestaurantImage(r)).toBe('https://fallback.com/image.jpg');
  });

  it('returns null when no image sources', () => {
    const r = makeRestaurant({ photos: [], image_url: null });
    expect(getRestaurantImage(r)).toBeNull();
  });

  it('returns null when restaurant has no photos or image_url', () => {
    const r = makeRestaurant({});
    expect(getRestaurantImage(r)).toBeNull();
  });
});

describe('getRestaurantImages', () => {
  it('returns all photo URLs from photos array', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: 'ref1', photo_url: '', width: 400, height: 300 },
        { photo_reference: '', photo_url: 'https://direct.com/2.jpg', width: 400, height: 300 },
        { photo_reference: 'ref3', photo_url: '', width: 400, height: 300 },
      ],
    });
    const urls = getRestaurantImages(r);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toBe('/api/photos/ref1?maxwidth=800');
    expect(urls[1]).toBe('https://direct.com/2.jpg');
    expect(urls[2]).toBe('/api/photos/ref3?maxwidth=800');
  });

  it('falls back to image_url when photos array is empty', () => {
    const r = makeRestaurant({ photos: [], image_url: 'https://fallback.com/img.jpg' });
    expect(getRestaurantImages(r)).toEqual(['https://fallback.com/img.jpg']);
  });

  it('returns empty array when no images at all', () => {
    const r = makeRestaurant({ photos: [], image_url: null });
    expect(getRestaurantImages(r)).toEqual([]);
  });
});

describe('getPhotoProxyUrl', () => {
  it('builds correct proxy URL with default maxWidth', () => {
    expect(getPhotoProxyUrl('abc123')).toBe('/api/photos/abc123?maxwidth=800');
  });

  it('builds proxy URL with custom maxWidth', () => {
    expect(getPhotoProxyUrl('abc123', 400)).toBe('/api/photos/abc123?maxwidth=400');
  });

  it('encodes special characters in reference', () => {
    expect(getPhotoProxyUrl('ref/with spaces')).toBe(
      '/api/photos/ref%2Fwith%20spaces?maxwidth=800'
    );
  });
});

describe('getCuisineGradient', () => {
  it('returns gradient-italian for Italian cuisine', () => {
    expect(getCuisineGradient('Italian')).toBe('gradient-italian');
  });

  it('returns gradient-italian for Hebrew Italian (איטלקי)', () => {
    expect(getCuisineGradient('איטלקי')).toBe('gradient-italian');
  });

  it('returns gradient-asian for Japanese cuisine (יפני)', () => {
    expect(getCuisineGradient('יפני')).toBe('gradient-asian');
  });

  it('returns gradient-meat for meat/steak cuisines', () => {
    expect(getCuisineGradient('סטייק')).toBe('gradient-meat');
    expect(getCuisineGradient('meat')).toBe('gradient-meat');
  });

  it('returns gradient-dessert for dessert/coffee types', () => {
    expect(getCuisineGradient('קפה')).toBe('gradient-dessert');
    expect(getCuisineGradient('dessert')).toBe('gradient-dessert');
  });

  it('returns gradient-default for null or undefined', () => {
    expect(getCuisineGradient(null)).toBe('gradient-default');
    expect(getCuisineGradient(undefined)).toBe('gradient-default');
  });

  it('returns gradient-default for unknown cuisine', () => {
    expect(getCuisineGradient('unknown cuisine type')).toBe('gradient-default');
  });

  it('is case insensitive', () => {
    expect(getCuisineGradient('ITALIAN')).toBe('gradient-italian');
    expect(getCuisineGradient('Hummus')).toBe('gradient-hummus');
  });
});

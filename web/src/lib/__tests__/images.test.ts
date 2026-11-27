// Opt-in paid Google photo behaviour; the default (off) is covered by no-paid-photo-requests.test.ts.
process.env.NEXT_PUBLIC_PAID_GOOGLE_PHOTOS = 'true';
import {
  getRestaurantImage,
  getRestaurantImages,
  getPhotoProxyUrl,
  getCuisineGradient,
  getStoredPhotoUrls,
  looksLikeLogo,
} from '../images';
import { Restaurant } from '@/types/restaurant';

function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return { name_hebrew: 'test', ...overrides };
}

describe('getRestaurantImage', () => {
  it('prefers owner photo over regular photo', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: 'regular1', photo_url: '', width: 400, height: 300 },
        { photo_reference: 'owner1', photo_url: '', width: 400, height: 300, is_owner_photo: true },
      ],
    });
    expect(getRestaurantImage(r)).toBe('/api/photos/owner1?maxwidth=800');
  });

  it('prefers owner photo over og:image', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: 'owner1', photo_url: '', width: 400, height: 300, is_owner_photo: true },
      ],
      og_image_url: 'https://restaurant.com/hero.jpg',
    });
    expect(getRestaurantImage(r)).toBe('/api/photos/owner1?maxwidth=800');
  });

  it('prefers regular photo over og:image when no owner photo', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: 'regular1', photo_url: '', width: 400, height: 300 },
      ],
      og_image_url: 'https://restaurant.com/hero.jpg',
    });
    expect(getRestaurantImage(r)).toBe('/api/photos/regular1?maxwidth=800');
  });

  it('falls back to first photo when no owner photo and no og:image', () => {
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

  it('falls back to og:image when photos array is empty', () => {
    const r = makeRestaurant({
      photos: [],
      og_image_url: 'https://restaurant.com/hero.jpg',
    });
    expect(getRestaurantImage(r)).toBe('https://restaurant.com/hero.jpg');
  });

  it('falls back to image_url when no photos and no og:image', () => {
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
  it('never puts paid Google proxy URLs in the gallery', () => {
    const r = makeRestaurant({
      photos: [
        { photo_reference: 'ref1', photo_url: '', width: 400, height: 300 },
        { photo_reference: '', photo_url: 'https://direct.com/2.jpg', width: 400, height: 300 },
        { photo_reference: 'ref3', photo_url: '', width: 400, height: 300 },
      ],
    });
    expect(getRestaurantImages(r)).toEqual(['https://direct.com/2.jpg']);
  });

  it('keeps our own venue image first and omits Google proxy photos', () => {
    const r = makeRestaurant({
      image_url: '/api/venue-images/abc.jpg',
      photos: [{ photo_reference: 'ref1', photo_url: '', width: 400, height: 300 }],
    });
    expect(getRestaurantImages(r)).toEqual(['/api/venue-images/abc.jpg']);
  });

  it('falls back to og:image when only Google references exist', () => {
    const r = makeRestaurant({
      photos: [{ photo_reference: 'ref1', photo_url: '', width: 400, height: 300 }],
      og_image_url: 'https://restaurant.com/hero.jpg',
    });
    expect(getRestaurantImages(r)).toEqual(['https://restaurant.com/hero.jpg']);
  });

  it('returns og:image alone when no Google photos', () => {
    const r = makeRestaurant({
      photos: [],
      og_image_url: 'https://restaurant.com/hero.jpg',
    });
    const urls = getRestaurantImages(r);
    expect(urls).toEqual(['https://restaurant.com/hero.jpg']);
  });

  it('falls back to image_url when photos array is empty and no og:image', () => {
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

  it('preserves slashes in reference for catch-all route', () => {
    expect(getPhotoProxyUrl('places/ChIJ123/photos/ATCDNf456')).toBe(
      '/api/photos/places/ChIJ123/photos/ATCDNf456?maxwidth=800'
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

describe('stored photos (served from our own server, free per view)', () => {
  const stored = [
    { path: '/api/place-photos/aaa.jpg', width: 1200, height: 900, credit: 'צלם א' },
    { path: '/api/place-photos/bbb.jpg', width: 1200, height: 900, credit: 'צלם ב' },
  ];
  const googlePhotos = [{ photo_reference: 'owner1', photo_url: '', width: 400, height: 300, is_owner_photo: true }];

  it('uses the first stored photo as the main image, before any paid Google photo', () => {
    const r = makeRestaurant({ stored_photos: stored, photos: googlePhotos, image_url: 'https://x.example/a.jpg' });
    expect(getRestaurantImage(r)).toBe('/api/place-photos/aaa.jpg');
  });

  it('builds the gallery from stored photos only when there are some', () => {
    const r = makeRestaurant({ stored_photos: stored, photos: googlePhotos });
    expect(getRestaurantImages(r)).toEqual(['/api/place-photos/aaa.jpg', '/api/place-photos/bbb.jpg']);
    expect(getStoredPhotoUrls(r)).toEqual(['/api/place-photos/aaa.jpg', '/api/place-photos/bbb.jpg']);
  });

  it('falls back to the previous order without stored photos', () => {
    const r = makeRestaurant({ stored_photos: [], photos: googlePhotos });
    expect(getRestaurantImage(r)).toBe('/api/photos/owner1?maxwidth=800');
  });
});

describe('getRestaurantImage with expiring lh3 image_url', () => {
  const lh3 = 'https://lh3.googleusercontent.com/place-photos/abc=s1600';
  it('prefers non-Google og_image_url over lh3 image_url', () => {
    const r = makeRestaurant({ image_url: lh3, og_image_url: 'https://cdn.example.com/og.jpg' });
    expect(getRestaurantImage(r)).toBe('https://cdn.example.com/og.jpg');
  });
  it('keeps lh3 image_url when og_image_url is missing or also lh3', () => {
    expect(getRestaurantImage(makeRestaurant({ image_url: lh3 }))).toBe(lh3);
    expect(
      getRestaurantImage(makeRestaurant({ image_url: lh3, og_image_url: 'https://lh3.googleusercontent.com/x' }))
    ).toBe(lh3);
  });
  it('keeps non-lh3 image_url over og_image_url', () => {
    const r = makeRestaurant({ image_url: 'https://a.com/i.jpg', og_image_url: 'https://b.com/o.jpg' });
    expect(getRestaurantImage(r)).toBe('https://a.com/i.jpg');
  });
});

describe('looksLikeLogo', () => {
  it('flags logos, icons and favicons by their file name, not food photos', () => {
    expect(looksLikeLogo('https://x.co.il/wp-content/uploads/2022/03/face-icon.png')).toBe(true);
    expect(looksLikeLogo('https://x.co.il/uploads/logo_09-01-1024x1024.png')).toBe(true);
    // Ontopo keeps venue cover photos under /organization/icons/<hash>: a photo, not a logo.
    expect(looksLikeLogo('https://ros-prd-il-resources.s3.amazonaws.com/organization/icons/9246292ae66837cd')).toBe(false);
    expect(looksLikeLogo('https://x.co.il/favicon.ico')).toBe(true);
    expect(looksLikeLogo('https://cdn.example/uploads/2023/hummus-plate.jpg')).toBe(false);
    expect(looksLikeLogo('https://logo-restaurant.example/photos/dish.jpg')).toBe(false); // host is not the file
    expect(looksLikeLogo('https://x.co.il/logos/2024/dinner-table.jpg')).toBe(false); // folder is not the file
  });

  it('keeps the Google photo on cards when the alternative is a logo', () => {
    const lh3 = 'https://lh3.googleusercontent.com/place-photos/abc=s4800-w800';
    const r = makeRestaurant({ image_url: lh3, og_image_url: 'https://x.co.il/uploads/site-logo-orange.png' });
    expect(getRestaurantImage(r)).toBe(lh3);
  });
});

describe('our own uploaded venue image', () => {
  const own = 'https://api.example.com/api/venue-images/abc123.jpg';
  const gallery = [
    { photo_reference: 'places/PLACE1/photos/ref1', is_owner_photo: true },
    { photo_reference: 'places/PLACE1/photos/ref2' },
  ];

  it('wins over a Google proxy photo for the card image', () => {
    const r = makeRestaurant({ image_url: own, photos: gallery as never, google_place_id: 'PLACE1' });
    expect(getRestaurantImage(r)).toBe(own);
  });

  it('leads the gallery; paid Google proxy photos are left out', () => {
    const r = makeRestaurant({ image_url: own, photos: gallery as never, google_place_id: 'PLACE1' });
    const images = getRestaurantImages(r);
    expect(images[0]).toBe(own);
    expect(images).toHaveLength(1);
  });

  it('does not treat other image_url values as our own', () => {
    const r = makeRestaurant({
      image_url: 'https://lh3.googleusercontent.com/x=s800',
      photos: gallery as never,
      google_place_id: 'PLACE1',
    });
    expect(getRestaurantImage(r)).toContain('/api/photos/places/PLACE1/photos/ref1');
  });

  it('still prefers stored place photos', () => {
    const r = makeRestaurant({
      image_url: own,
      stored_photos: [{ path: '/api/stored/1.jpg' }] as never,
    });
    expect(getRestaurantImage(r)).toContain('/api/stored/1.jpg');
  });
});

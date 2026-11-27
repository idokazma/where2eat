import { getRestaurantImage, getRestaurantImages, isPaidProxyUrl } from '../images';
import { storyPhotos, storyFrames, storyGoogleFallback, needsPlacePhotoCount, buildStories } from '../stories';
import { getMapPreviewImage } from '../map-discovery';
import { Restaurant } from '@/types/restaurant';

/**
 * Network invariant: with the default configuration no image URL any public
 * rendering path can produce reaches the paid Google photo routes (/api/photos/...),
 * whatever the restaurant record holds. Our own and direct free URLs still render.
 */
const refs = [
  { photo_reference: 'places/ChIJabc/photos/AAA', photo_url: '', width: 1, height: 1, is_owner_photo: true },
  { photo_reference: 'legacyref', photo_url: '', width: 1, height: 1 },
  { photo_reference: '', photo_url: 'https://direct.example.com/free.jpg', width: 1, height: 1 },
];

const variants: Record<string, Partial<Restaurant>> = {
  'google refs only': { photos: refs.slice(0, 2), google_place_id: 'ChIJabc' },
  'refs and direct': { photos: refs, google_place_id: 'ChIJabc' },
  'bare reference as image_url': { image_url: 'ATCDNf456', photos: [] },
  'own image plus refs': { image_url: '/api/venue-images/abc.jpg', photos: refs },
  'place id and nothing else': { google_place_id: 'ChIJabc', photos: [] },
  'stored photos plus refs': { stored_photos: [{ path: '/api/place-photos/a.jpg' }] as never, photos: refs },
  'lh3 image_url plus refs': { image_url: 'https://lh3.googleusercontent.com/x=s1600', photos: refs.slice(0, 2) },
};

const make = (o: Partial<Restaurant>): Restaurant =>
  ({ name_hebrew: 'x', id: 'r1', location: { lat: 32, lng: 34.8, city: 'TLV' }, ...o }) as Restaurant;

describe('no paid Google photo requests by default', () => {
  const OLD = process.env.NEXT_PUBLIC_PAID_GOOGLE_PHOTOS;
  beforeEach(() => { delete process.env.NEXT_PUBLIC_PAID_GOOGLE_PHOTOS; });
  afterAll(() => { if (OLD !== undefined) process.env.NEXT_PUBLIC_PAID_GOOGLE_PHOTOS = OLD; });

  for (const [name, o] of Object.entries(variants)) {
    it(`emits no paid proxy URL: ${name}`, () => {
      const r = make(o);
      const urls: (string | null)[] = [
        getRestaurantImage(r),
        ...getRestaurantImages(r),
        getMapPreviewImage(r),
        ...storyGoogleFallback({ restaurant: r } as never),
        ...storyPhotos({ restaurant: r, image: 'https://own.example/p.jpg' } as never, { extraPhotos: true, placePhotoCount: 5 }).map((p) => p.url),
        ...storyFrames({ restaurant: r, image: 'https://own.example/p.jpg' } as never, { extraPhotos: true, placePhotoCount: 5 }).map((f) => f.photo.url),
      ];
      for (const u of urls) if (u) expect(isPaidProxyUrl(u)).toBe(false);
      expect(storyPhotos({ restaurant: r, image: 'https://own.example/p.jpg' } as never, { placePhotoCount: 5 }).some((p) => p.paid)).toBe(false);
      expect(needsPlacePhotoCount(r)).toBe(false);
      const feed = buildStories([r], null);
      for (const s of [...feed.near, ...feed.far]) {
        expect(isPaidProxyUrl(s.image)).toBe(false);
        s.alternates.forEach((a) => expect(isPaidProxyUrl(a)).toBe(false));
      }
    });
  }

  it('still renders free images', () => {
    expect(getRestaurantImage(make(variants['own image plus refs']))).toBe('/api/venue-images/abc.jpg');
    expect(getRestaurantImage(make(variants['refs and direct']))).toBe('https://direct.example.com/free.jpg');
    expect(getRestaurantImage(make(variants['stored photos plus refs']))).toBe('/api/place-photos/a.jpg');
    expect(getRestaurantImages(make(variants['stored photos plus refs']))).toEqual(['/api/place-photos/a.jpg']);
  });

  it('opt-in env restores the proxy', () => {
    process.env.NEXT_PUBLIC_PAID_GOOGLE_PHOTOS = 'true';
    expect(getRestaurantImage(make(variants['google refs only']))).toContain('/api/photos/');
  });
});

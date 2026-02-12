/**
 * Tests for the photo proxy API route logic.
 *
 * Since NextRequest/NextResponse require Web API globals not available in jsdom,
 * we test the route handler by mocking next/server and calling the GET function.
 */

// Mock next/server before any imports
jest.mock('next/server', () => {
  class MockNextRequest {
    nextUrl: { searchParams: URLSearchParams };
    constructor(url: string) {
      this.nextUrl = { searchParams: new URL(url).searchParams };
    }
  }

  class MockNextResponse {
    status: number;
    _headers: Map<string, string>;
    _body: any;

    constructor(body: any, init?: { headers?: Record<string, string>; status?: number }) {
      this._body = body;
      this.status = init?.status || 200;
      this._headers = new Map(Object.entries(init?.headers || {}));
    }

    static json(data: any, init?: { status?: number }) {
      const resp = new MockNextResponse(JSON.stringify(data), { status: init?.status });
      resp._body = data;
      return resp;
    }

    headers = {
      get: (key: string) => this._headers.get(key) || null,
    };

    async json() {
      return this._body;
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Photo proxy route', () => {
  it('returns 500 when API key not configured', async () => {
    process.env.GOOGLE_PLACES_API_KEY = '';
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY = '';

    const { GET } = require('../[reference]/route');

    const request = {
      nextUrl: { searchParams: new URLSearchParams('maxwidth=800') },
    };
    const params = Promise.resolve({ reference: 'test-ref' });

    const response = await GET(request, { params });
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.error).toBe('API key not configured');
  });

  it('returns 400 when reference is empty', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    const { GET } = require('../[reference]/route');

    const request = {
      nextUrl: { searchParams: new URLSearchParams('maxwidth=800') },
    };
    const params = Promise.resolve({ reference: '' });

    const response = await GET(request, { params });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Missing photo reference');
  });

  it('returns image with cache headers on success', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    const mockImageBuffer = new ArrayBuffer(8);
    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer),
      headers: { get: (key: string) => (key === 'content-type' ? 'image/jpeg' : null) },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as any;

    const { GET } = require('../[reference]/route');

    const request = {
      nextUrl: { searchParams: new URLSearchParams('maxwidth=800') },
    };
    const params = Promise.resolve({ reference: 'photo-ref-123' });

    const response = await GET(request, { params });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=604800, immutable'
    );
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('returns correct Content-Type from Google response', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';

    const mockResponse = {
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      headers: { get: (key: string) => (key === 'content-type' ? 'image/webp' : null) },
    };

    global.fetch = jest.fn().mockResolvedValue(mockResponse) as any;

    const { GET } = require('../[reference]/route');

    const request = {
      nextUrl: { searchParams: new URLSearchParams('maxwidth=400') },
    };
    const params = Promise.resolve({ reference: 'webp-ref' });

    const response = await GET(request, { params });
    expect(response.headers.get('Content-Type')).toBe('image/webp');
  });
});

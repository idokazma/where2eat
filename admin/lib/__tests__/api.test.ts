import { getAuthToken, setAuthToken, clearAuthToken, apiFetch } from '../api';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Provide a mock localStorage for jsdom
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('getAuthToken', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('returns null when no token is stored', () => {
    expect(getAuthToken()).toBeNull();
  });

  it('returns stored token', () => {
    localStorageMock.setItem('admin_token', 'test-token-123');
    expect(getAuthToken()).toBe('test-token-123');
  });
});

describe('setAuthToken / getAuthToken / clearAuthToken round-trip', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('stores and retrieves a token', () => {
    setAuthToken('my-secret-token');
    expect(getAuthToken()).toBe('my-secret-token');
  });

  it('clears the token', () => {
    setAuthToken('my-secret-token');
    expect(getAuthToken()).toBe('my-secret-token');
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });
});

describe('apiFetch', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  it('adds Authorization header when token exists', async () => {
    setAuthToken('bearer-token-abc');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer bearer-token-abc');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('does not add Authorization header when no token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    await apiFetch('/api/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('returns parsed JSON on successful response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: [{ id: '1', name: 'Alice' }] }),
    });

    const result = await apiFetch<{ users: { id: string; name: string }[] }>('/api/users');
    expect(result).toEqual({ users: [{ id: '1', name: 'Alice' }] });
  });

  it('throws parsed error data on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(apiFetch('/api/protected')).rejects.toEqual({ error: 'Unauthorized' });
  });

  it('sends request to correct URL with API base', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch('/api/restaurants');

    const [url] = mockFetch.mock.calls[0];
    // Default API_URL is http://localhost:3001
    expect(url).toContain('/api/restaurants');
  });

  it('passes through additional options like method and body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1' }),
    });

    await apiFetch('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ name: 'Test' }));
  });

  it('includes credentials in request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch('/api/test');

    const [, options] = mockFetch.mock.calls[0];
    expect(options.credentials).toBe('include');
  });
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import AdminPage from '../page';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

// Mock sessionStorage
const store: Record<string, string> = {};
const mockSessionStorage = {
  getItem: jest.fn((key: string) => store[key] || null),
  setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: jest.fn((key: string) => { delete store[key]; }),
  clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

// Helper to mock all dashboard API calls that fire on login
function mockDashboardApiCalls() {
  // OverviewTab loads 5 endpoints in parallel
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ overview: { queued: 3, processing: 1, completed: 10, failed: 2, skipped: 0, total: 16 } }),
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ stats: { status_counts: {}, avg_processing_seconds: 45, completed_last_24h: 2, completed_last_7d: 8, failure_rate_percent: 5, total_items: 16 } }),
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ history: [] }),
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ restaurants: [], count: 0 }),
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ episodes: [], pagination: { total: 5 } }),
  });
}

function renderAdmin() {
  return render(
    <LanguageProvider>
      <AdminPage />
    </LanguageProvider>
  );
}

describe('AdminPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSessionStorage.clear();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows login form when no token exists', async () => {
    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows error on invalid credentials', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'bad@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows dashboard with tabs after successful login', async () => {
    // Login fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'valid-jwt-token' }),
    });
    // Dashboard data loads
    mockDashboardApiCalls();

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Logout')).toBeInTheDocument();
    // Verify tabs are rendered (use role=tab to avoid matching content within tabs)
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(4);
    expect(tabs[0]).toHaveTextContent('Overview');
    expect(tabs[1]).toHaveTextContent('Videos');
    expect(tabs[2]).toHaveTextContent('Restaurants');
    expect(tabs[3]).toHaveTextContent('Queue');
  });

  it('shows overview stats on the default tab', async () => {
    // Login fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'valid-jwt-token' }),
    });
    mockDashboardApiCalls();

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    // Wait for overview data to load
    await waitFor(() => {
      // Queue count
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    // Pipeline status section
    expect(screen.getByText('Pipeline Status')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('clears token and returns to login form on logout', async () => {
    // Login fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'valid-jwt-token' }),
    });
    mockDashboardApiCalls();

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    // Mock the logout server call
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByText('Admin Login')).toBeInTheDocument();
    });
  });

  it('restores session from stored token', async () => {
    // Simulate stored token
    mockSessionStorage.getItem.mockReturnValue('stored-token');
    // Token validation
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ user: {} }) });
    // Dashboard data loads
    mockDashboardApiCalls();

    renderAdmin();

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
    // Should go straight to dashboard, no login form
    expect(screen.queryByText('Admin Login')).not.toBeInTheDocument();
  });
});

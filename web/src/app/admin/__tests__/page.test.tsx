import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import AdminPage from '../page';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

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
    mockSessionStorage.clear();
    // Default: no stored token
    mockSessionStorage.getItem.mockReturnValue(null);
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

  it('shows dashboard after successful login', async () => {
    // Login fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'valid-jwt-token' }),
    });
    // loadJobs fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] }),
    });
    // loadStats: restaurants fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ restaurants: [], count: 0 }),
    });
    // loadStats: jobs fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobs: [] }),
    });

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
  });

  it('clears token and returns to login form on logout', async () => {
    // Login fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'valid-jwt-token' }),
    });
    // loadJobs + loadStats
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [] }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ restaurants: [], count: 0 }) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [] }) });

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
});

import { render, screen, waitFor } from '@testing-library/react';
import AboutPage from '../page';

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock PageLayout to just render children
jest.mock('@/components/layout', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PageLayout: ({ children }: any) => <div>{children}</div>,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('AboutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches restaurant count from API and displays it', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        restaurants: [
          { name_hebrew: 'מסעדה 1', episode_info: { video_id: 'vid1' } },
          { name_hebrew: 'מסעדה 2', episode_info: { video_id: 'vid1' } },
          { name_hebrew: 'מסעדה 3', episode_info: { video_id: 'vid2' } },
        ],
        count: 3,
      }),
    });

    render(<AboutPage />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('calculates unique episode count from video_ids', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        restaurants: [
          { name_hebrew: 'מסעדה 1', episode_info: { video_id: 'vid1' } },
          { name_hebrew: 'מסעדה 2', episode_info: { video_id: 'vid1' } },
          { name_hebrew: 'מסעדה 3', episode_info: { video_id: 'vid2' } },
          { name_hebrew: 'מסעדה 4', episode_info: { video_id: 'vid3' } },
        ],
        count: 4,
      }),
    });

    render(<AboutPage />);

    // 3 unique episodes (vid1, vid2, vid3)
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows 0 on API error (not stuck on loading)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<AboutPage />);

    await waitFor(() => {
      // Should show 0 for both counts, not "..."
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows loading state initially', () => {
    // Never resolve the fetch
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<AboutPage />);

    // Should show "..." while loading
    const loadingIndicators = screen.getAllByText('...');
    expect(loadingIndicators.length).toBeGreaterThanOrEqual(2);
  });
});

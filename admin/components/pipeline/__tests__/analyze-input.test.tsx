import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalyzeInput } from '../analyze-input';

// Mock the pipelineApi
const mockAnalyzeVideo = jest.fn();
jest.mock('@/lib/api', () => ({
  pipelineApi: {
    analyzeVideo: (...args: unknown[]) => mockAnalyzeVideo(...args),
  },
}));

// Mock lucide-react icons to simple spans
jest.mock('lucide-react', () => ({
  RefreshCw: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="refresh-icon" {...props} />,
  Play: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="play-icon" {...props} />,
  Youtube: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="youtube-icon" {...props} />,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('AnalyzeInput', () => {
  beforeEach(() => {
    mockAnalyzeVideo.mockReset();
  });

  it('renders input and button', () => {
    render(<AnalyzeInput />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText(/youtube\.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('button is disabled when input is empty', () => {
    render(<AnalyzeInput />, { wrapper: createWrapper() });
    const button = screen.getByRole('button', { name: /analyze/i });
    expect(button).toBeDisabled();
  });

  it('button is enabled when input has a value', async () => {
    const user = userEvent.setup();
    render(<AnalyzeInput />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/youtube\.com/);
    await user.type(input, 'https://www.youtube.com/watch?v=abc123');

    const button = screen.getByRole('button', { name: /analyze/i });
    expect(button).not.toBeDisabled();
  });

  it('calls mutation on button click', async () => {
    mockAnalyzeVideo.mockResolvedValue({ job_id: '123' });
    const user = userEvent.setup();
    render(<AnalyzeInput />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/youtube\.com/);
    await user.type(input, 'https://www.youtube.com/watch?v=abc123');

    const button = screen.getByRole('button', { name: /analyze/i });
    await user.click(button);

    await waitFor(() => {
      expect(mockAnalyzeVideo).toHaveBeenCalledWith(
        'https://www.youtube.com/watch?v=abc123'
      );
    });
  });

  it('shows success message after successful analysis', async () => {
    mockAnalyzeVideo.mockResolvedValue({ job_id: '123' });
    const user = userEvent.setup();
    render(<AnalyzeInput />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/youtube\.com/);
    await user.type(input, 'https://www.youtube.com/watch?v=abc123');

    const button = screen.getByRole('button', { name: /analyze/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Video queued for analysis.')).toBeInTheDocument();
    });
  });

  it('clears input after successful analysis', async () => {
    mockAnalyzeVideo.mockResolvedValue({ job_id: '123' });
    const user = userEvent.setup();
    render(<AnalyzeInput />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/youtube\.com/) as HTMLInputElement;
    await user.type(input, 'https://www.youtube.com/watch?v=abc123');

    const button = screen.getByRole('button', { name: /analyze/i });
    await user.click(button);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows error message on failed analysis', async () => {
    mockAnalyzeVideo.mockRejectedValue({ error: 'Invalid URL' });
    const user = userEvent.setup();
    render(<AnalyzeInput />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText(/youtube\.com/);
    await user.type(input, 'not-a-valid-url');

    const button = screen.getByRole('button', { name: /analyze/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('Invalid URL')).toBeInTheDocument();
    });
  });
});

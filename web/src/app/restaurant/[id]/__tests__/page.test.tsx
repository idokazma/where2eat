import { render, screen, waitFor, within } from '@testing-library/react';
import RestaurantDetailPage from '../page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'rest-1' }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));
jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { alt?: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));
jest.mock('@/contexts/favorites-context', () => ({
  useFavorites: () => ({ isFavorite: () => false, addFavorite: jest.fn(), removeFavorite: jest.fn() }),
}));
jest.mock('@/components/restaurant/PhotoGallery', () => ({ PhotoGallery: () => null }));
jest.mock('@/components/restaurant/YouTubeEmbed', () => ({ YouTubeEmbed: () => null }));

const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

const base = {
  id: 'rest-1',
  name_hebrew: 'ARC',
  name_english: 'ARC',
  cuisine_type: 'איטלקי',
  status: 'open',
  location: { city: 'יפו', address: 'רחוב 1' },
  host_comments: 'ביקורת ראשית',
  mention_level: 'נטעם',
  episode_info: { video_id: 'primary', video_url: 'https://www.youtube.com/watch?v=primary' },
};

function mockRestaurant(overrides: Record<string, unknown>) {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...base, ...overrides }) });
}

describe('RestaurantDetailPage provenance and additional reviews', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the photo credit only when one is recorded', async () => {
    mockRestaurant({ image_url: 'https://cdn.example/a.jpg', image_credit: 'קרניבורים אורגינל', image_source: 'creator_owned' });
    const { unmount } = render(<RestaurantDetailPage />);
    expect(await screen.findByText(/תמונה: קרניבורים אורגינל/)).toBeInTheDocument();
    unmount();

    mockRestaurant({});
    render(<RestaurantDetailPage />);
    await waitFor(() => expect(screen.getByText('ARC', { selector: 'h1' })).toBeInTheDocument());
    expect(screen.queryByText(/תמונה:/)).not.toBeInTheDocument();
  });

  it('renders each other-creator review with its own attribution, quote, link and tasted/mentioned state', async () => {
    mockRestaurant({
      mentions: [
        { video_id: 'primary', channel_name: 'ערוץ ראשי', mention_level: 'נטעם', host_quotes: ['לא אמור להופיע'], verdict: 'add_to_page' },
        {
          video_id: 'v2', channel_name: 'קרניבורים אורגינל', mention_level: 'נטעם', verdict: 'add_to_page',
          host_quotes: ['הציטוט המדויק של יוצר א'], timestamp_display: '0:10',
          youtube_url: 'https://www.youtube.com/watch?v=v2&t=10s',
        },
        {
          video_id: 'v3', channel_name: 'יוצר ב', mention_level: 'הוזכר', verdict: 'add_to_page',
          host_comments: 'הוזכר בלבד', youtube_url: 'https://www.youtube.com/watch?v=v3',
        },
        { video_id: 'v4', channel_name: 'יוצר ג', mention_level: 'הוזכר', verdict: 'reference_only', host_quotes: ['אזכור פנימי'] },
      ],
    });
    render(<RestaurantDetailPage />);
    const heading = await screen.findByText('ביקורות נוספות');
    const section = heading.parentElement as HTMLElement;

    // creator A: tasted, quote, timestamped link
    const a = within(section).getByText('קרניבורים אורגינל').closest('div[class*="rounded-xl"]') as HTMLElement;
    expect(within(a).getByText(/הציטוט המדויק של יוצר א/)).toBeInTheDocument();
    expect(within(a).getByRole('link')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=v2&t=10s');
    expect(a.textContent).toContain('נטעם');
    expect(a.textContent).not.toContain('הוזכר');

    // creator B: mentioned only, falls back to host_comments
    const b = within(section).getByText('יוצר ב').closest('div[class*="rounded-xl"]') as HTMLElement;
    expect(within(b).getByText(/הוזכר בלבד/)).toBeInTheDocument();
    expect(b.textContent).toContain('הוזכר');
    expect(within(b).getByRole('link')).toHaveAttribute('href', 'https://www.youtube.com/watch?v=v3');

    // primary episode and reference_only mentions are not repeated
    expect(screen.queryByText(/לא אמור להופיע/)).not.toBeInTheDocument();
    expect(screen.queryByText(/אזכור פנימי/)).not.toBeInTheDocument();
  });

  it('hides the section when there are no other reviews', async () => {
    mockRestaurant({ mentions: [{ video_id: 'primary', mention_level: 'נטעם' }] });
    render(<RestaurantDetailPage />);
    await waitFor(() => expect(screen.getByText('ARC', { selector: 'h1' })).toBeInTheDocument());
    expect(screen.queryByText('ביקורות נוספות')).not.toBeInTheDocument();
  });
});

describe('additional reviews quote the creators as the rest of the site does', () => {
  const card = (name: string) =>
    within(screen.getByText('ביקורות נוספות').parentElement as HTMLElement)
      .getByText(name).closest('div[class*="rounded-xl"]') as HTMLElement;

  it('puts only a verified quote in quotation marks; transcript text is shown plainly', async () => {
    mockRestaurant({
      mentions: [
        { video_id: 'v2', channel_name: 'מאומת', host_quotes: ['המנה הייתה מעולה'], verified_quote: { text: 'המנה הייתה מעולה' } },
        { video_id: 'v3', channel_name: 'תמלול', host_quotes: ['שמעתי שזה טוב'] },
      ],
    });
    render(<RestaurantDetailPage />);
    await screen.findByText('ביקורות נוספות');
    expect(card('מאומת').textContent).toContain('“המנה הייתה מעולה”');
    expect(card('תמלול').textContent).toContain('שמעתי שזה טוב');
    expect(card('תמלול').textContent).not.toMatch(/[“”"״]/);
  });

  it('skips a quote that is only a disclaimer', async () => {
    mockRestaurant({
      mentions: [
        { video_id: 'v2', channel_name: 'יוצר', host_quotes: ['יש דיסקליימר שאני חבר של השף', 'הבשר היה עשוי מעולה'] },
        { video_id: 'v3', channel_name: 'אחר', host_quotes: ['Disclaimer: I know the owner'], host_comments: 'סיכום קצר' },
      ],
    });
    render(<RestaurantDetailPage />);
    await screen.findByText('ביקורות נוספות');
    expect(card('יוצר').textContent).toContain('הבשר היה עשוי מעולה');
    expect(card('יוצר').textContent).not.toContain('דיסקליימר');
    expect(card('אחר').textContent).toContain('סיכום קצר');
    expect(card('אחר').textContent).not.toContain('Disclaimer');
  });
});

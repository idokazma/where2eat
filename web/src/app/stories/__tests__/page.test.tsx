import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import StoriesPage from "../page";
import { metadata } from "../layout";
import { FavoritesProvider } from "@/contexts/favorites-context";

const mockLocate = jest.fn();
jest.mock("@/hooks/useGeolocation", () => ({
  useGeolocation: () => ({ coords: null, accuracy: null, loading: false, error: null, getCurrentPosition: mockLocate }),
}));

const photo = (id: string) => `https://where2eat-production.up.railway.app/api/venue-images/${id}.jpg`;
const restaurants = [
  {
    id: "far",
    name_hebrew: "רחוקה בחיפה",
    image_url: photo("far"),
    location: { city: "חיפה", lat: 32.8, lng: 34.98 },
    episode_info: { video_id: "vidFAR", channel_name: "מקור", title: "פרק" },
    mention_timestamp_seconds: 50,
  },
  {
    id: "near",
    name_hebrew: "קרובה",
    cuisine_type: "פיצה",
    image_url: photo("near"),
    location: { city: "תל אביב", lat: 32.081, lng: 34.775 },
    episode_info: { video_id: "vidNEAR", channel_name: "מדברים מהבטן - הפודיום", title: "מדברים מהבטן 176" },
    mentions: [
      { video_id: "vidNEAR", timestamp_seconds: 100, mention_level: "נטעם", episode_title: "מדברים מהבטן 176", speaker: "דובר" },
      { video_id: "vidOTHER", timestamp_seconds: 30, mention_level: "הוזכר", channel_name: "יוצר אחר" },
    ],
  },
  {
    id: "nophoto",
    name_hebrew: "בלי תמונה",
    image_url: null,
    location: { city: "תל אביב", lat: 32.08, lng: 34.78 },
    episode_info: { video_id: "vidX", channel_name: "מקור" },
  },
  {
    id: "hidden",
    name_hebrew: "מוסתרת",
    is_hidden: true,
    image_url: photo("hidden"),
    location: { city: "תל אביב", lat: 32.08, lng: 34.78 },
    episode_info: { video_id: "vidX", channel_name: "מקור" },
  },
];
const episode = {
  episode: {},
  mentions: {
    tasted: [{ linked_restaurant_id: "near", host_quotes: ["לא זה"], verified_quote: { text: "הפיצה הכי טובה בעיר" } }],
    mentioned: [],
    reference_only: [],
  },
};

const otherEpisode = {
  episode: {},
  mentions: { tasted: [], mentioned: [{ restaurant_id: "near", host_quotes: ["פיצה טובה ממש"] }], reference_only: [] },
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  Element.prototype.scrollIntoView = jest.fn();
  global.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
});

const observers: FakeObserver[] = [];
class FakeObserver {
  targets: Element[] = [];
  constructor(private cb: IntersectionObserverCallback) {
    observers.push(this);
  }
  observe(el: Element) {
    this.targets.push(el);
  }
  disconnect() {
    this.targets = [];
  }
  unobserve() {}
  fire(el: Element) {
    this.cb([{ target: el, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry], this as never);
  }
}
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () =>
        String(url).includes("/api/episodes/vidNEAR")
          ? episode
          : String(url).includes("/api/episodes/vidOTHER")
            ? otherEpisode
            : { restaurants },
    }),
  ) as jest.Mock;
});

const renderPage = () =>
  render(
    <FavoritesProvider>
      <StoriesPage />
    </FavoritesProvider>,
  );

async function startFromTelAviv() {
  renderPage();
  const preset = await screen.findByRole("button", { name: /תל אביב/ });
  await waitFor(() => expect(preset).toBeEnabled());
  fireEvent.click(preset);
}

it("is kept out of search engines while it is unlinked", () => {
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});

it("asks for location only when the button is pressed", async () => {
  renderPage();
  await screen.findByRole("button", { name: /לפי המיקום שלי/ });
  expect(mockLocate).not.toHaveBeenCalled();
});

it("orders stories nearest first and leaves out hidden and photo-less restaurants", async () => {
  await startFromTelAviv();
  const stories = await screen.findAllByRole("article");
  expect(stories.map((s) => within(s).getByRole("heading").textContent)).toEqual(["קרובה", "רחוקה בחיפה"]);
  expect(screen.queryByText("בלי תמונה")).toBeNull();
  expect(screen.queryByText("מוסתרת")).toBeNull();
  expect(screen.getByText(/מחוץ ל-50 ק״מ/)).toBeInTheDocument();
});

it("uses the device location when allowed, and explains when it is denied", async () => {
  mockLocate.mockResolvedValueOnce({ lat: 32.8, lng: 34.98 });
  renderPage();
  const locateButton = await screen.findByRole("button", { name: /לפי המיקום שלי/ });
  await waitFor(() => expect(locateButton).toBeEnabled());
  fireEvent.click(locateButton);
  const stories = await screen.findAllByRole("article");
  expect(within(stories[0]).getByRole("heading").textContent).toBe("רחוקה בחיפה");

  fireEvent.click(screen.getByRole("button", { name: "חזרה לנקודת ההתחלה" }));
  mockLocate.mockRejectedValueOnce(new Error("denied"));
  fireEvent.click(screen.getByRole("button", { name: /לפי המיקום שלי/ }));
  expect(await screen.findByText(/בחרו נקודה/)).toBeInTheDocument();
});

it("makes one slide per creator mention, tasted first, with the source and no speaker name", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const slides = within(near).getAllByRole("group");
  expect(slides).toHaveLength(2);
  expect(within(slides[0]).getByText(/מדברים מהבטן 176 · 1:40/)).toBeInTheDocument();
  expect(within(slides[0]).getByText("נטעם")).toBeInTheDocument();
  expect(within(slides[1]).getByText(/יוצר אחר/)).toBeInTheDocument();
  expect(screen.queryByText(/דובר/)).toBeNull();
});

it("shows the episode page's verified quote in quotation marks", async () => {
  await startFromTelAviv();
  expect(await screen.findByText("״הפיצה הכי טובה בעיר״")).toBeInTheDocument();
  expect(screen.queryByText(/לא זה/)).toBeNull();
});

it("shows unverified text plainly: no quotation marks and no status label", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const [tasted, other] = within(near).getAllByRole("group");
  await within(tasted).findByText("״הפיצה הכי טובה בעיר״");
  expect(await within(other).findByText("פיצה טובה ממש")).toBeInTheDocument();
  expect(within(other).queryByText(/״/)).toBeNull();
  expect(screen.queryByText(/לא מאומת/)).toBeNull();
});

it("marks the slide in view as active, whatever the browser's RTL scroll convention", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const slides = within(near).getAllByRole("group");
  const dots = () => [...near.querySelectorAll(".stories-dots i")].map((d) => d.className);
  expect(dots()).toEqual(["on", ""]);
  const io = observers.find((o) => o.targets.includes(slides[1]))!;
  act(() => io.fire(slides[1]));
  expect(dots()).toEqual(["", "on"]);
});

it("loads the YouTube player only on tap, at the moment, from the privacy-enhanced domain", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(within(within(near).getAllByRole("group")[0]).getByRole("button", { name: /נגן ברגע הזה/ }));
  const frame = document.querySelector("iframe")!;
  expect(frame.src).toBe("https://www.youtube-nocookie.com/embed/vidNEAR?start=97&autoplay=1&playsinline=1&rel=0");
  expect(screen.getByRole("link", { name: /פתיחה ביוטיוב/ })).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=vidNEAR&t=97s",
  );
  fireEvent.click(screen.getByRole("button", { name: "סגירה" }));
  expect(document.querySelector("iframe")).toBeNull();
});

it("saves a restaurant to the shared favorites", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const save = within(near).getByRole("button", { name: /שמירה/ });
  fireEvent.click(save);
  await waitFor(() => expect(JSON.parse(localStorage.getItem("where2eat-favorites")!)).toEqual(["near"]));
  expect(save).toHaveAttribute("aria-pressed", "true");
});

it("drops a story whose photo fails to load before it is reached", async () => {
  await startFromTelAviv();
  await screen.findAllByRole("article");
  const farImg = document.querySelector<HTMLImageElement>(`img[src="${photo("far")}"]`)!;
  fireEvent.error(farImg);
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
});

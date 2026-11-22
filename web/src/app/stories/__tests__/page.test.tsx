import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import StoriesPage from "../page";
import { StoriesView } from "@/components/stories/StoriesView";
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
    google_places: { place_id: "PN" },
    photos: [
      { photo_reference: "places/PN/photos/ref1", photo_url: "", width: 1, height: 1 },
      { photo_reference: "places/PN/photos/ref2", photo_url: "", width: 1, height: 1 },
    ],
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

const renderPage = (limit?: number) =>
  render(
    <FavoritesProvider>{limit === undefined ? <StoriesPage /> : <StoriesView extraPhotoLimit={limit} />}</FavoritesProvider>,
  );

async function startFromTelAviv(limit?: number) {
  renderPage(limit);
  const preset = await screen.findByRole("button", { name: /תל אביב/ });
  await waitFor(() => expect(preset).toBeEnabled());
  fireEvent.click(preset);
}

it("can be indexed now that the home page links to it", () => {
  expect(metadata.robots).toBeUndefined();
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

it("pages sideways through photos only; reviews stay on the story, other sources as chips", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  expect(frames).toHaveLength(3);
  expect(within(near).getByText(/מדברים מהבטן 176 · 1:40/)).toBeInTheDocument();
  expect(within(near).getByText("נטעם")).toBeInTheDocument();
  // The second source is a chip on the story, not a sideways page.
  expect(within(near).getByRole("button", { name: /יוצר אחר/ })).toBeInTheDocument();
  for (const frame of frames) {
    expect(within(frame).queryByText(/יוצר אחר|מדברים מהבטן 176/)).toBeNull();
    expect(within(frame).queryByRole("button", { name: /נגן/ })).toBeNull();
  }
  expect(screen.queryByText(/דובר/)).toBeNull();
});

const paidImages = () => [...document.querySelectorAll("img")].map((i) => i.getAttribute("src")!).filter((u) => u.includes("/api/photos/"));

it("loads a paid Google photo only when the viewer moves to it", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  expect(paidImages()).toEqual([]);
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  expect(paidImages()).toEqual([expect.stringContaining("/api/photos/places/PN/photos/ref1?maxwidth=900")]);
});

it("stops loading paid photos at the visit limit, showing the story's own photo instead", async () => {
  await startFromTelAviv(1);
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
  expect(paidImages()).toHaveLength(1);
  expect(near.querySelector(`img[src="${photo("near")}"]`)).not.toBeNull();
});

it("skips a photo that fails to load instead of showing an empty page", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  let frames = within(near).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
  const dead = near.querySelector<HTMLImageElement>('img[src*="ref2"]')!;
  fireEvent.error(dead);
  frames = within(near).getAllByRole("group");
  expect(frames).toHaveLength(2);
  // A page is a photo: when it fails there is no empty page left, and the reviews stay.
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  fireEvent.error(near.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
  frames = within(near).getAllByRole("group");
  expect(frames).toHaveLength(1);
  expect(within(near).getByRole("button", { name: /נגן ברגע הזה/ })).toBeInTheDocument();
});

it("moves to the next photo when the side of the photo is tapped", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  const scroll = Element.prototype.scrollIntoView as jest.Mock;
  scroll.mockClear();
  fireEvent.click(within(frames[0]).getByRole("button", { name: "התמונה הבאה" }));
  expect(scroll.mock.contexts[0]).toBe(frames[1]);
});

it("shows the episode page's verified quote in quotation marks", async () => {
  await startFromTelAviv();
  expect(await screen.findByText("״הפיצה הכי טובה בעיר״")).toBeInTheDocument();
  expect(screen.queryByText(/לא זה/)).toBeNull();
});

it("shows unverified text plainly: no quotation marks and no status label", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  await within(near).findByText("״הפיצה הכי טובה בעיר״");
  // Only the lead review's text is on the story; the other source is a chip, not a second quote.
  expect(within(near).queryByText("פיצה טובה ממש")).toBeNull();
  expect(screen.queryByText(/לא מאומת/)).toBeNull();
});

it("marks the slide in view as active, whatever the browser's RTL scroll convention", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const slides = within(near).getAllByRole("group");
  const dots = () => [...near.querySelectorAll(".stories-dots i")].map((d) => d.className);
  expect(dots()).toEqual(["on", "", ""]);
  const io = observers.find((o) => o.targets.includes(slides[1]))!;
  act(() => io.fire(slides[1]));
  expect(dots()).toEqual(["", "on", ""]);
});

it("loads the YouTube player only on tap, at the moment, from the privacy-enhanced domain", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(within(near).getByRole("button", { name: /נגן ברגע הזה/ }));
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

it("builds only the stories around the one in view and follows the viewer down the feed", async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    id: `r${i}`,
    name_hebrew: `מסעדה ${i}`,
    image_url: photo(`r${i}`),
    location: { city: "תל אביב", lat: 32.081 + i * 0.0005, lng: 34.775 },
    episode_info: { video_id: `vid${i}`, channel_name: "מקור" },
  }));
  (global.fetch as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({ ok: true, json: async () => (String(url).includes("/api/episodes/") ? { mentions: {} } : { restaurants: many }) }),
  );
  await startFromTelAviv();
  await screen.findAllByRole("article");
  const names = () => screen.getAllByRole("article").map((a) => within(a).getByRole("heading").textContent);
  expect(names()).toEqual(["מסעדה 0", "מסעדה 1", "מסעדה 2", "מסעדה 3", "מסעדה 4"]);
  const slots = document.querySelectorAll(".stories-slot");
  expect(slots).toHaveLength(60);
  const feedObserver = observers.filter((o) => o.targets.length >= 60).pop()!;
  act(() => feedObserver.fire(slots[20]));
  await waitFor(() => expect(names()).toEqual(Array.from({ length: 7 }, (_, i) => `מסעדה ${18 + i}`)));
  expect(document.querySelectorAll(".stories-slot")).toHaveLength(60);
  expect(screen.getByText("21/60")).toBeInTheDocument();
});

it("keeps the story in view and the order when a photo fails ahead of or at the current story", async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`,
    name_hebrew: `מסעדה ${i}`,
    image_url: photo(`r${i}`),
    location: { city: "תל אביב", lat: 32.081 + i * 0.0005, lng: 34.775 },
    episode_info: { video_id: `vid${i}`, channel_name: "מקור" },
  }));
  (global.fetch as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({ ok: true, json: async () => (String(url).includes("/api/episodes/") ? { mentions: {} } : { restaurants: many }) }),
  );
  await startFromTelAviv();
  await screen.findAllByRole("article");
  const names = () => screen.getAllByRole("article").map((a) => within(a).getByRole("heading").textContent);
  const feedObserver = observers.filter((o) => o.targets.length >= 30).pop()!;
  act(() => feedObserver.fire(document.querySelectorAll(".stories-slot")[5]));
  await waitFor(() => expect(screen.getByText("6/30")).toBeInTheDocument());
  expect(names()).toEqual(Array.from({ length: 7 }, (_, i) => `מסעדה ${3 + i}`));

  // A photo-less story ahead is dropped: nothing before it moves, nothing repeats or is skipped.
  fireEvent.error(document.querySelector<HTMLImageElement>(`img[src="${photo("r7")}"]`)!);
  await waitFor(() => expect(document.querySelectorAll(".stories-slot")).toHaveLength(29));
  expect(screen.getByText("6/29")).toBeInTheDocument();
  const after = names();
  expect(new Set(after).size).toBe(after.length);
  expect(after).toEqual(["מסעדה 3", "מסעדה 4", "מסעדה 5", "מסעדה 6", "מסעדה 8", "מסעדה 9", "מסעדה 10"]);

  // A photo that fails at the story in view or behind keeps its place (shown without a photo).
  fireEvent.error(document.querySelector<HTMLImageElement>(`img[src="${photo("r5")}"]`)!);
  await waitFor(() => expect(document.querySelectorAll(".stories-slot")).toHaveLength(29));
  expect(names()).toEqual(after);
  expect(screen.getByText("6/29")).toBeInTheDocument();
});

it("reopens a rebuilt story on its photo without moving the feed to it", async () => {
  const many = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`,
    name_hebrew: `מסעדה ${i}`,
    image_url: photo(`r${i}`),
    location: { city: "תל אביב", lat: 32.081 + i * 0.0005, lng: 34.775 },
    episode_info: { video_id: `vid${i}`, channel_name: "מקור" },
    ...(i === 0
      ? {
          google_places: { place_id: "P0" },
          photos: [
            { photo_reference: "places/P0/photos/a", photo_url: "", width: 1, height: 1 },
            { photo_reference: "places/P0/photos/b", photo_url: "", width: 1, height: 1 },
          ],
        }
      : {}),
  }));
  (global.fetch as jest.Mock).mockImplementation((url: string) =>
    Promise.resolve({ ok: true, json: async () => (String(url).includes("/api/episodes/") ? { mentions: {} } : { restaurants: many }) }),
  );
  await startFromTelAviv();
  const first = (await screen.findAllByRole("article"))[0];
  const frames = within(first).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  const slots = document.querySelectorAll(".stories-slot");
  const feed = () => observers.filter((o) => o.targets.length >= 30).pop()!;
  act(() => feed().fire(slots[5])); // story 0 is now out of the built window
  await waitFor(() => expect(screen.queryByRole("article", { name: "מסעדה 0" })).toBeNull());
  const scroll = Element.prototype.scrollIntoView as jest.Mock;
  scroll.mockClear();
  act(() => feed().fire(slots[2])); // story 0 is rebuilt, still off-screen
  await screen.findByRole("article", { name: "מסעדה 0" });
  // scrollIntoView would also scroll the vertical feed and yank the viewer back to story 0.
  expect(scroll).not.toHaveBeenCalled();
});

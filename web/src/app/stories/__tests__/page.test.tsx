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
    published_at: "2026-11-10",
    name_hebrew: "רחוקה בחיפה",
    image_url: photo("far"),
    location: { city: "חיפה", lat: 32.8, lng: 34.98 },
    episode_info: { video_id: "vidFAR", channel_name: "מקור", title: "פרק" },
    mention_timestamp_seconds: 50,
  },
  {
    id: "near",
    published_at: "2026-01-10",
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
  Element.prototype.scrollBy = jest.fn();
  Element.prototype.scrollTo = jest.fn();
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

// Most tests drive the start screen (pin button); the opening flow is tested separately.
const renderPage = (limit?: number) =>
  render(
    <FavoritesProvider>
      <StoriesView extraPhotoLimit={limit ?? 40} autoStart={false} />
    </FavoritesProvider>,
  );

async function startFromTelAviv(limit?: number) {
  renderPage(limit);
  const preset = await screen.findByRole("button", { name: /תל אביב/ });
  await waitFor(() => expect(preset).toBeEnabled());
  fireEvent.click(preset);
}

it("shows no 'n of M' counter over the stories", async () => {
  await startFromTelAviv();
  await screen.findAllByRole("article");
  expect(document.querySelector(".stories-count")).toBeNull();
  expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull();
  // The top bar holds only the location and exit buttons.
  expect(document.querySelector(".stories-top")!.textContent).toBe("");
});

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

  fireEvent.click(screen.getByRole("button", { name: "בחירת מיקום" }));
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
  fireEvent.click(within(near).getByRole("button", { name: /כל הסקירות \(2\)/ }));
  const reviews = document.querySelector("dialog.stories-reviews")!;
  expect(reviews.querySelectorAll("li")).toHaveLength(2);
  expect(reviews.textContent).toContain("יוצר אחר");
  expect(within(reviews as HTMLElement).getAllByRole("button", { name: "נגן" })).toHaveLength(2);
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

it("prefetches the next two photos once the photo in view has loaded", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  expect(paidImages()).toEqual([]);
  fireEvent.load(near.querySelector<HTMLImageElement>(`img[src="${photo("near")}"]`)!);
  // The next two photos load on the phone ahead of the taps, one after the other.
  expect(paidImages()).toEqual([expect.stringContaining("/api/photos/places/PN/photos/ref1?maxwidth=900")]);
  fireEvent.load(near.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
  expect(paidImages()).toEqual([
    expect.stringContaining("/api/photos/places/PN/photos/ref1?maxwidth=900"),
    expect.stringContaining("/api/photos/places/PN/photos/ref2?maxwidth=900"),
  ]);
});

it("prefetching counts toward the visit limit", async () => {
  await startFromTelAviv(1);
  const [near] = await screen.findAllByRole("article");
  fireEvent.load(near.querySelector<HTMLImageElement>(`img[src="${photo("near")}"]`)!);
  expect(paidImages()).toEqual([expect.stringContaining("ref1")]);
  const frames = within(near).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  fireEvent.load(near.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
  expect(paidImages()).toEqual([expect.stringContaining("ref1")]);
});

it("stops loading paid photos at the visit limit, showing the story's own photo instead", async () => {
  await startFromTelAviv(1);
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
  expect(paidImages()).toHaveLength(1);
  expect(near.querySelector(`img[src="${photo("near")}"]`)).not.toBeNull();
});

it("keeps a failed paid slot stable without granting the next reference", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  fireEvent.error(near.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
  expect(within(near).getAllByRole("group")).toHaveLength(3);
  // Even another observer notification for the same slot cannot grant REF2.
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  expect(paidImages()).toEqual([]);
  expect(near.querySelector(`img[src="${photo("near")}"]`)).not.toBeNull();
  expect(within(near).getByRole("button", { name: /נגן ברגע הזה/ })).toBeInTheDocument();
  // A deliberate next transition can reach the next paid photo.
  fireEvent.click(within(frames[1]).getByRole("button", { name: "התמונה הבאה" }));
  act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
  expect(paidImages()).toEqual([expect.stringContaining("ref2")]);
  // Reverse to the failed slot: no retry and no different reference substituted.
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  expect(paidImages()).toEqual([]);
});

it("moves to the next photo when the side of the photo is tapped", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  const strip = near.querySelector(".stories-frames")!;
  const pan = Element.prototype.scrollBy as jest.Mock;
  const jump = Element.prototype.scrollIntoView as jest.Mock;
  pan.mockClear();
  jump.mockClear();
  fireEvent.click(within(frames[0]).getByRole("button", { name: "התמונה הבאה" }));
  // Only the photo strip moves; scrollIntoView could also scroll the vertical feed.
  expect(pan.mock.contexts[0]).toBe(strip);
  expect(jump).not.toHaveBeenCalled();
});

describe("Instagram-style taps", () => {
  const storyJumps = (index: number) =>
    (Element.prototype.scrollIntoView as jest.Mock).mock.contexts.filter(
      (el) => el === document.querySelector(`[data-index="${index}"]`),
    );

  it("tapping forward on a place's last photo moves to the next restaurant", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    const frames = within(near).getAllByRole("group");
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    fireEvent.click(within(frames[frames.length - 1]).getByRole("button", { name: "התמונה הבאה" }));
    expect(storyJumps(1)).toHaveLength(1);
  });

  it("a tap on the back strip of a place's first photo never returns to the previous restaurant", async () => {
    // Seen on a phone: a right-thumb tap on the second place went back to the first.
    await startFromTelAviv();
    const articles = await screen.findAllByRole("article");
    const far = articles[articles.length - 1]; // one photo only
    const slot = far.closest("[data-index]")!;
    act(() => observers.filter((o) => o.targets.includes(slot)).pop()!.fire(slot));
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    fireEvent.click(within(far).getByRole("button", { name: "התמונה הקודמת" }));
    const prevIndex = Number(slot.getAttribute("data-index")) - 1;
    expect(storyJumps(prevIndex)).toHaveLength(0);
  });

  it("a tap on the back strip of a place's first photo moves forward like any tap", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    const frames = within(near).getAllByRole("group");
    expect(frames.length).toBeGreaterThan(1);
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    fireEvent.click(within(frames[0]).getByRole("button", { name: "התמונה הקודמת" }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledTimes(1);
    expect(storyJumps(0)).toHaveLength(0);
  });

  it("the back strip still goes to the previous photo of the same place", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    const frames = within(near).getAllByRole("group");
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    fireEvent.click(within(frames[1]).getByRole("button", { name: "התמונה הקודמת" }));
    expect(Element.prototype.scrollBy).toHaveBeenCalledTimes(1);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("a tap at the end of a long hold does not move (holding only pauses)", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    const frames = within(near).getAllByRole("group");
    const now = jest.spyOn(Date, "now");
    try {
      now.mockReturnValue(1_000);
      fireEvent.touchStart(screen.getByLabelText("סטוריז מסעדות"));
      now.mockReturnValue(1_900); // held for 0.9 s
      fireEvent.touchEnd(screen.getByLabelText("סטוריז מסעדות"));
      (Element.prototype.scrollBy as jest.Mock).mockClear();
      fireEvent.click(within(frames[0]).getByRole("button", { name: "התמונה הבאה" }));
      expect(Element.prototype.scrollBy).not.toHaveBeenCalled();
      // A later activation without a press (keyboard Enter) works again.
      fireEvent.click(within(frames[0]).getByRole("button", { name: "התמונה הבאה" }));
      expect(Element.prototype.scrollBy).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  });
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
  const dots = () => [...near.querySelectorAll(".stories-dots i")].map((d) => (d.classList.contains("on") ? "on" : ""));
  expect(dots()).toEqual(["on", "", ""]);
  const io = observers.find((o) => o.targets.includes(slides[1]))!;
  act(() => io.fire(slides[1]));
  expect(dots()).toEqual(["", "on", ""]);
});

it("fills the bars of photos already seen, like Instagram", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const slides = within(near).getAllByRole("group");
  const bars = () =>
    [...near.querySelectorAll(".stories-dots i")].map((d) =>
      d.classList.contains("on") ? "on" : d.classList.contains("seen") ? "seen" : "",
    );
  expect(bars()).toEqual(["on", "", ""]);
  act(() => observers.find((o) => o.targets.includes(slides[2]))!.fire(slides[2]));
  expect(bars()).toEqual(["seen", "seen", "on"]);
  // Going back empties the bars after the photo in view.
  act(() => observers.find((o) => o.targets.includes(slides[1]))!.fire(slides[1]));
  expect(bars()).toEqual(["seen", "on", ""]);
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

it("keeps a story whose only photo fails to load and shows an intentional fallback", async () => {
  await startFromTelAviv();
  await screen.findAllByRole("article");
  const before = screen.getAllByRole("article").length;
  const farImg = document.querySelector<HTMLImageElement>(`img[src="${photo("far")}"]`)!;
  const farArticle = farImg.closest("article")!;
  fireEvent.error(farImg);
  await waitFor(() => expect(farArticle.querySelector(".stories-bg.fallback")).not.toBeNull());
  expect(screen.getAllByRole("article")).toHaveLength(before);
  expect(within(farArticle).getByRole("heading")).toBeInTheDocument();
  expect(document.querySelector(`img[src="${photo("far")}"]`)).toBeNull();
});

it("tries the place's own Google photo (saved after first load) before the fallback card", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  fireEvent.error(near.querySelector<HTMLImageElement>(`img[src="${photo("near")}"]`)!);
  const google = await waitFor(() => {
    const img = near.querySelector<HTMLImageElement>("img.stories-bg");
    expect(img?.getAttribute("src")).toContain("/api/photos/places/PN/photos/ref1");
    return img!;
  });
  expect(near.querySelector(".stories-bg.fallback")).toBeNull();
  fireEvent.error(google);
  await waitFor(() => expect(near.querySelector(".stories-bg.fallback")).not.toBeNull());
});

it("goes straight to the fallback card when extra Google photos are turned off", async () => {
  await startFromTelAviv(0);
  const [near] = await screen.findAllByRole("article");
  fireEvent.error(near.querySelector<HTMLImageElement>(`img[src="${photo("near")}"]`)!);
  await waitFor(() => expect(near.querySelector(".stories-bg.fallback")).not.toBeNull());
  expect(document.querySelector('img[src*="/api/photos/"]')).toBeNull();
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
  expect(screen.queryByText(/^\d+\/\d+$/)).toBeNull(); // no "n/M" counter
});

it("keeps every story and the order when a photo fails, trying the next free image first", async () => {
  const alt = "https://owner.example/uploads/dish.jpg";
  const many = Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`,
    name_hebrew: `מסעדה ${i}`,
    image_url: photo(`r${i}`),
    ...(i === 7 ? { og_image_url: alt } : {}),
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
  await waitFor(() => expect(names()).toEqual(Array.from({ length: 7 }, (_, i) => `מסעדה ${3 + i}`)));
  const before = names();

  // A failed photo ahead moves to the same place's next free image; nothing is dropped.
  fireEvent.error(document.querySelector<HTMLImageElement>(`img[src="${photo("r7")}"]`)!);
  await waitFor(() => expect(document.querySelector(`img[src="${alt}"]`)).not.toBeNull());
  expect(document.querySelector(`img[src="${photo("r7")}"]`)).toBeNull();
  expect(document.querySelectorAll(".stories-slot")).toHaveLength(30);
  expect(names()).toEqual(before);

  // The alternate fails too, and a story with no other image fails: both stay with a fallback.
  fireEvent.error(document.querySelector<HTMLImageElement>(`img[src="${alt}"]`)!);
  fireEvent.error(document.querySelector<HTMLImageElement>(`img[src="${photo("r5")}"]`)!);
  await waitFor(() => expect(document.querySelectorAll(".stories-bg.fallback")).toHaveLength(2));
  expect(document.querySelectorAll(".stories-slot")).toHaveLength(30);
  expect(names()).toEqual(before);
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


describe("autoplay", () => {
  const feedEl = () => screen.getByLabelText("סטוריז מסעדות");
  const nextStoryCalls = () =>
    (Element.prototype.scrollIntoView as jest.Mock).mock.contexts.filter((el) => el === document.querySelector('[data-index="1"]'));
  const stripMoves = (article: HTMLElement) =>
    [...(Element.prototype.scrollBy as jest.Mock).mock.contexts, ...(Element.prototype.scrollTo as jest.Mock).mock.contexts].filter((el) => el === article.querySelector(".stories-frames"));

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps rotating photos when a place's main photo failed and a backup is shown", async () => {
    // Real case: the stored main image is a dead link, a free backup (og image) shows instead,
    // and the place has another free photo. The rotation must not stop on the first slot.
    const dead = "https://example.co.il/dead-main.jpg";
    const backup = "https://example.co.il/og-photo.jpg";
    const second = "https://example.co.il/dish-2.jpg";
    const rows = [
      {
        id: "p1",
        name_hebrew: "מקום עם גיבוי",
        image_url: dead,
        og_image_url: backup,
        photos: [{ photo_url: second, width: 1, height: 1 }],
        location: { city: "תל אביב", lat: 32.081, lng: 34.775 },
        episode_info: { video_id: "vidP1", channel_name: "מקור" },
      },
    ];
    (global.fetch as jest.Mock).mockImplementation((url: string) =>
      Promise.resolve({ ok: true, json: async () => (String(url).includes("/api/episodes/") ? { mentions: {} } : { restaurants: rows }) }),
    );
    await startFromTelAviv();
    const [place] = await screen.findAllByRole("article");
    fireEvent.error(place.querySelector<HTMLImageElement>(`img[src="${dead}"]`)!);
    await waitFor(() => expect(place.querySelector(`img[src="${backup}"]`)).not.toBeNull());
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(4_100));
    expect(stripMoves(place)).toHaveLength(1);
  });

  it("skips a photo slot that failed instead of stopping there (to the next free photo)", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    const frames = within(near).getAllByRole("group");
    // Reach the second photo (a Google photo) and let it fail.
    act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
    fireEvent.error(near.querySelector<HTMLImageElement>('img[src*="/api/photos/"]')!);
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(1_000));
    expect(stripMoves(near)).toHaveLength(1);
  });

  it("never rotates back onto a known failed slot over the primary backdrop", async () => {
    const single = { ...restaurants[1], photos: [restaurants[1].photos![0]] };
    (global.fetch as jest.Mock).mockImplementation((url: string) => Promise.resolve({
      ok: true, json: async () => String(url).includes('/api/episodes/') ? episode : { restaurants: [single] },
    }));
    await startFromTelAviv();
    const [article] = await screen.findAllByRole('article');
    const frames = within(article).getAllByRole('group');
    act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
    fireEvent.error(article.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(710));
    expect(stripMoves(article)).toHaveLength(1); // one safe return to primary
    act(() => observers.find((o) => o.targets.includes(frames[0]))!.fire(frames[0]));
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(8_500));
    expect(stripMoves(article)).toHaveLength(0); // no 0 -> failed1 -> 0 cycle
    expect(paidImages()).toEqual([]);
    expect(within(article).getAllByRole('group')).toHaveLength(2);
    expect(within(frames[0]).getByRole('button', { name: 'התמונה הבאה' })).toBeEnabled();
  });

  it("does not let a hidden fallback alias redirect autoplay onto a failed paid slot", async () => {
    const direct = 'https://lh3.googleusercontent.com/maayan=s4800-w800';
    const single = { ...restaurants[1], image_url: direct, og_image_url: 'https://owner.test/primary.jpg',
      photos: [1, 2].map((i) => ({ photo_reference: `places/PN/photos/mixed${i}`,
        resolved_url: i === 1 ? direct : 'https://owner.test/other.jpg', photo_url: '', width: 800, height: 600 })),
    };
    (global.fetch as jest.Mock).mockImplementation((url: string) => Promise.resolve({
      ok: true, json: async () => String(url).includes('/api/episodes/') ? episode : { restaurants: [single] },
    }));
    await startFromTelAviv();
    const [article] = await screen.findAllByRole('article');
    const frames = within(article).getAllByRole('group');
    fireEvent.error(article.querySelector<HTMLImageElement>('img[src="https://owner.test/primary.jpg"]')!);
    await waitFor(() => expect(frames[1]).toHaveAttribute('hidden'));
    // A stale intersection for the hidden alias may not grant its paid reference.
    act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[1]));
    expect(paidImages()).toEqual([]);
    act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
    fireEvent.error(article.querySelector<HTMLImageElement>('img[src*="mixed2"]')!);
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(710));
    expect(stripMoves(article)).toHaveLength(1);
    act(() => observers.find((o) => o.targets.includes(frames[0]))!.fire(frames[0]));
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(8_500));
    expect(stripMoves(article)).toHaveLength(0);
    expect(paidImages()).toEqual([]);
    expect(within(article).getAllByRole('group')).toHaveLength(2);
  });

  it("atomically skips failed intermediate geometry rather than smooth-crossing it", async () => {
    await startFromTelAviv();
    const [article] = await screen.findAllByRole('article');
    const frames = within(article).getAllByRole('group');
    const observer = () => observers.find((o) => o.targets.includes(frames[1]))!;
    act(() => observer().fire(frames[1]));
    fireEvent.error(article.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
    act(() => jest.advanceTimersByTime(710));
    expect((Element.prototype.scrollTo as jest.Mock).mock.calls.at(-1)[0].behavior).toBe('instant');
    act(() => observer().fire(frames[0]));
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    const strip = article.querySelector<HTMLElement>('.stories-frames')!;
    Object.defineProperty(strip, 'scrollLeft', { value: -390, writable: true, configurable: true });
    strip.getBoundingClientRect = () => ({ left: 0 } as DOMRect);
    (frames[2] as HTMLElement).getBoundingClientRect = () => ({ left: -780 } as DOMRect);
    act(() => jest.advanceTimersByTime(4_010));
    expect((Element.prototype.scrollTo as jest.Mock).mock.calls.at(-1)[0].left).toBe(-1170);
    // Target is original2, crossing original1. Browser must not smooth-scroll
    // through the failed slot and report its intermediate69%intersection.
    expect((Element.prototype.scrollTo as jest.Mock).mock.calls.at(-1)[0].behavior).toBe('instant');
    // Deliver a late intermediate failed-slot record AFTER the automatic jump.
    // It must not replace the pending destination or arm another recovery.
    act(() => observer().fire(frames[1]));
    expect(paidImages()).toEqual([]);
    act(() => observer().fire(frames[2]));
    expect(paidImages()).toEqual([expect.stringContaining('ref2')]);
    expect(paidImages().some((u) => u.includes('ref1'))).toBe(false);
    // Manual reverse remains smooth and can deliberately visit the failed slot.
    fireEvent.click(within(frames[2]).getByRole('button', { name: 'התמונה הקודמת' }));
    expect((Element.prototype.scrollBy as jest.Mock).mock.calls.at(-1)[0].behavior).toBe('smooth');
  });

  it("moves to the next place every 10 seconds", async () => {
    await startFromTelAviv();
    await screen.findAllByRole("article");
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(9_900));
    expect(nextStoryCalls()).toHaveLength(0);
    act(() => jest.advanceTimersByTime(200));
    expect(nextStoryCalls()).toHaveLength(1);
  });

  it("changes the place's photo every 4 seconds", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(3_900));
    expect(stripMoves(near)).toHaveLength(0);
    act(() => jest.advanceTimersByTime(200));
    expect(stripMoves(near)).toHaveLength(1);
  });

  it("after a paid photo fails, autoplay never moves on into another paid photo; a tap still can", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    const frames = within(near).getAllByRole("group");
    act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
    fireEvent.error(near.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(8_500));
    // It goes back to the free first photo instead of stalling, and requests nothing paid.
    expect(stripMoves(near).length).toBeGreaterThan(0);
    expect(paidImages()).toEqual([]);
    expect(within(near).getAllByRole("group")[1]).toBe(frames[1]);
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    fireEvent.click(within(frames[1]).getByRole("button", { name: "התמונה הבאה" }));
    expect(stripMoves(near)).toHaveLength(1);
    act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
    expect(paidImages()).toEqual([expect.stringContaining("ref2")]);
  });

  it("holds while a finger is on the screen and resumes after it lifts", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    (Element.prototype.scrollBy as jest.Mock).mockClear();
    (Element.prototype.scrollTo as jest.Mock).mockClear();
    fireEvent.touchStart(feedEl());
    act(() => jest.advanceTimersByTime(300)); // the finger stays down: now it is a hold
    act(() => jest.advanceTimersByTime(15_000));
    expect(nextStoryCalls()).toHaveLength(0);
    expect(stripMoves(near)).toHaveLength(0);
    fireEvent.touchEnd(feedEl());
    act(() => jest.advanceTimersByTime(10_100));
    expect(nextStoryCalls()).toHaveLength(1);
  });

  it("a quick tap does not pause, so the running bar never restarts (no empty flash)", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    act(() => jest.advanceTimersByTime(1_000));
    const bar = near.querySelector(".stories-dots i.run");
    expect(bar).not.toBeNull();
    const seen: string[] = [];
    const watch = new MutationObserver(() => seen.push(bar!.className));
    watch.observe(bar!, { attributes: true });
    fireEvent.touchStart(feedEl());
    act(() => jest.advanceTimersByTime(120));
    fireEvent.touchEnd(feedEl());
    act(() => jest.advanceTimersByTime(50));
    watch.disconnect();
    // Same element, still running: not swapped for a paused bar and remounted from empty.
    expect(near.querySelector(".stories-dots i.run")).toBe(bar);
    expect(bar!.isConnected).toBe(true);
    expect(seen.every((c) => c.includes("run"))).toBe(true);
  });

  it("a finger kept down pauses once it is a hold", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    fireEvent.touchStart(feedEl());
    act(() => jest.advanceTimersByTime(400));
    expect(near.querySelector(".stories-dots i.run")).toBeNull();
    fireEvent.touchEnd(feedEl());
    act(() => jest.advanceTimersByTime(50));
    expect(near.querySelector(".stories-dots i.run")).not.toBeNull();
  });

  it("holds while the video player is open", async () => {
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    fireEvent.click(within(near).getByRole("button", { name: /נגן ברגע הזה/ }));
    (Element.prototype.scrollIntoView as jest.Mock).mockClear();
    act(() => jest.advanceTimersByTime(15_000));
    expect(nextStoryCalls()).toHaveLength(0);
  });

  it("does not move on its own for people who prefer reduced motion", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes("prefers-reduced-motion") })) as typeof window.matchMedia;
    try {
      await startFromTelAviv();
      await screen.findAllByRole("article");
      (Element.prototype.scrollIntoView as jest.Mock).mockClear();
      act(() => jest.advanceTimersByTime(15_000));
      expect(nextStoryCalls()).toHaveLength(0);
    } finally {
      window.matchMedia = original;
    }
  });
});


describe("opening the site starts with the stories", () => {
  const openSite = () =>
    render(
      <FavoritesProvider>
        <StoriesPage />
      </FavoritesProvider>,
    );
  const headings = async () =>
    (await screen.findAllByRole("article")).map((a) => within(a).getByRole("heading").textContent);

  it("is the site's front page", async () => {
    const { default: FrontPage } = await import("../../page");
    expect(FrontPage).toBe(StoriesPage);
  });

  it("asks for the location on open and orders by distance when it is allowed", async () => {
    mockLocate.mockResolvedValueOnce({ lat: 32.081, lng: 34.775 });
    openSite();
    expect(await headings()).toEqual(["קרובה", "רחוקה בחיפה"]);
    expect(mockLocate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/מחוץ ל-50 ק״מ/)).toBeInTheDocument();
  });

  it("shows the newest places first when the location is refused", async () => {
    mockLocate.mockRejectedValueOnce(new Error("denied"));
    openSite();
    expect(await headings()).toEqual(["רחוקה בחיפה", "קרובה"]);
    expect(screen.queryByText(/מחוץ ל-/)).toBeNull();
    expect(screen.queryByText(/ק״מ|מ׳/)).toBeNull(); // no distances without a location
  });

  it("shows the newest places when the location question is not answered in time", async () => {
    jest.useFakeTimers();
    try {
      mockLocate.mockReturnValueOnce(new Promise(() => {}));
      openSite();
      expect(screen.getByText(/מחפשים מסעדות קרובות/)).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(8_100));
      expect(await headings()).toEqual(["רחוקה בחיפה", "קרובה"]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("lets the viewer skip the location and see the newest right away", async () => {
    mockLocate.mockReturnValueOnce(new Promise(() => {}));
    openSite();
    fireEvent.click(screen.getByRole("button", { name: /הכי חדשות/ }));
    expect(await headings()).toEqual(["רחוקה בחיפה", "קרובה"]);
  });

  it("leaves to the main page with X", async () => {
    mockLocate.mockRejectedValueOnce(new Error("denied"));
    openSite();
    await headings();
    expect(screen.getByRole("link", { name: "יציאה" })).toHaveAttribute("href", "/home");
  });
});


it("loads two free photos ahead, after current loads, never every reached photo", async () => {
  const single = { ...restaurants[1],
    stored_photos: Array.from({ length: 8 }, (_, i) => ({ path: `/api/place-photos/free${i}.jpg` })),
  };
  (global.fetch as jest.Mock).mockImplementation((url: string) => Promise.resolve({
    ok: true, json: async () => String(url).includes("/api/episodes/") ? episode : { restaurants: [single] },
  }));
  await startFromTelAviv();
  const article = (await screen.findAllByRole("article"))[0];
  const images = () => [...article.querySelectorAll<HTMLImageElement>("img")];
  const has = (n: number) => images().some((i) => i.src.includes(`free${n}.jpg`));
  expect(images().map((i) => i.src)).toHaveLength(1);
  fireEvent.load(images()[0]);
  await waitFor(() => expect(has(1)).toBe(true));
  expect(has(2)).toBe(false); // in order: the second one ahead waits for the first
  fireEvent.load(images().find((i) => i.src.includes("free1.jpg"))!);
  await waitFor(() => expect(has(2)).toBe(true));
  expect(has(3)).toBe(false);
  expect(paidImages()).toEqual([]);
  const frames = within(article).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[3]))!.fire(frames[3]));
  const current = images().find((i) => i.src.includes("free3.jpg"))!;
  fireEvent.load(current);
  await waitFor(() => expect(has(4)).toBe(true));
  fireEvent.load(images().find((i) => i.src.includes("free4.jpg"))!);
  await waitFor(() => expect(has(5)).toBe(true));
  expect(has(1)).toBe(false);
  expect(has(6)).toBe(false);
  // Own backdrop + previous/current/next two, rather than every reached photo.
  expect(images().length).toBeLessThanOrEqual(5);
  expect(paidImages()).toEqual([]);
});


it("keeps the visit cap after failure and an explicit next transition", async () => {
  await startFromTelAviv(1);
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  act(() => observers.find((o) => o.targets.includes(frames[1]))!.fire(frames[1]));
  fireEvent.error(near.querySelector<HTMLImageElement>('img[src*="ref1"]')!);
  act(() => observers.find((o) => o.targets.includes(frames[2]))!.fire(frames[2]));
  expect(paidImages()).toEqual([]);
  expect(within(near).getAllByRole("group")).toHaveLength(3);
});

it("keeps successful paid slots distinct on forward and reverse transitions", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  const frames = within(near).getAllByRole("group");
  for (const index of [1, 2, 1]) {
    act(() => observers.find((o) => o.targets.includes(frames[index]))!.fire(frames[index]));
    const image = near.querySelector<HTMLImageElement>(`img[src*="ref${index}"]`)!;
    expect(image).not.toBeNull();
    fireEvent.load(image);
    // The photo in view plus at most its neighbour (kept or prefetched), never duplicated.
    const loaded = paidImages();
    expect(new Set(loaded).size).toBe(loaded.length);
    expect(loaded.length).toBeLessThanOrEqual(2);
    expect(loaded).toContainEqual(expect.stringContaining(`ref${index}`));
  }
  expect(within(near).getAllByRole("group")).toHaveLength(3);
});

describe("sharing a story", () => {
  afterEach(() => {
    delete (navigator as { share?: unknown }).share;
    window.history.replaceState({}, "", "/");
  });

  it("opens the phone's share menu with a link to this place and a short message", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    fireEvent.click(within(near).getByRole("button", { name: /שיתוף/ }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = share.mock.calls[0][0];
    expect(arg.url).toBe(`${window.location.origin}/?story=near`);
    expect(arg.text).toContain("קרובה");
    expect(arg.text).toContain("מצאתי ב-Where2Eat");
  });

  it("copies the link when the browser has no share menu", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await startFromTelAviv();
    const [near] = await screen.findAllByRole("article");
    fireEvent.click(within(near).getByRole("button", { name: /שיתוף/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?story=near`));
    expect(await screen.findByText("הקישור הועתק")).toBeInTheDocument();
  });

  it("a shared link opens with that place first", async () => {
    window.history.replaceState({}, "", "/?story=far");
    await startFromTelAviv();
    const stories = await screen.findAllByRole("article");
    expect(within(stories[0]).getByRole("heading").textContent).toBe("רחוקה בחיפה");
  });

  it("autoplay waits while the share menu is open", async () => {
    jest.useFakeTimers();
    try {
      Object.defineProperty(navigator, "share", { value: jest.fn(() => new Promise(() => {})), configurable: true });
      await startFromTelAviv();
      const [near] = await screen.findAllByRole("article");
      fireEvent.click(within(near).getByRole("button", { name: /שיתוף/ }));
      (Element.prototype.scrollIntoView as jest.Mock).mockClear();
      act(() => jest.advanceTimersByTime(15_000));
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

it("deduplicates the runtime fallback alias without shifting the next paid slot", async () => {
  const direct = 'https://lh3.googleusercontent.com/maayan=s4800-w800';
  const single = { ...restaurants[1], image_url: direct, og_image_url: 'https://owner.test/primary.jpg',
    photos: [1, 2, 3, 4, 5].map((i) => ({ photo_reference: `places/PN/photos/alias${i}`,
      resolved_url: i === 1 ? direct : `https://owner.test/other${i}.jpg`, photo_url: '', width: 800, height: 600 })),
  };
  (global.fetch as jest.Mock).mockImplementation((url: string) => Promise.resolve({
    ok: true, json: async () => String(url).includes('/api/episodes/') ? episode : { restaurants: [single] },
  }));
  await startFromTelAviv();
  const article = (await screen.findAllByRole('article'))[0];
  const original = within(article).getAllByRole('group');
  expect(original).toHaveLength(6); // og primary is distinct before it fails
  fireEvent.error(article.querySelector<HTMLImageElement>('img[src="https://owner.test/primary.jpg"]')!);
  await waitFor(() => expect(article.querySelector(`img[src="${direct}"]`)).not.toBeNull());
  expect(within(article).getAllByRole('group')).toHaveLength(5);
  expect(original[1]).toHaveAttribute('hidden');
  expect(original[2]).toHaveAttribute('data-slide', '2'); // identity was NOT shifted
  expect(paidImages()).toEqual([]);
  act(() => observers.find((o) => o.targets.includes(original[2]))!.fire(original[2]));
  expect(paidImages()).toEqual([expect.stringContaining('alias2')]);
  expect(within(article).getByRole('button', { name: /נגן ברגע הזה/ })).toBeInTheDocument();
});


it("shows source-matched review thumbnails, an honest failure state and unchanged playback moments", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  expect(document.querySelectorAll(".stories-review-thumbnail img")).toHaveLength(0);
  fireEvent.click(within(near).getByRole("button", { name: /כל הסקירות/ }));
  const reviews = document.querySelector<HTMLElement>("dialog.stories-reviews")!;
  const entries = within(reviews).getAllByRole("listitem");
  const first = within(entries[0]).getByRole("img");
  expect(first).toHaveAttribute("src", "https://img.youtube.com/vi/vidNEAR/hqdefault.jpg");
  expect(within(entries[1]).getByRole("img")).toHaveAttribute("src", "https://img.youtube.com/vi/vidOTHER/hqdefault.jpg");
  expect(first).toHaveAttribute("loading", "lazy");
  fireEvent.error(first);
  expect(within(entries[0]).queryByRole("img")).toBeNull();
  expect(within(entries[0]).getByText("תמונה לא זמינה")).toBeInTheDocument();
  expect(within(entries[1]).getByRole("img")).toBeInTheDocument();
  fireEvent.click(within(entries[1]).getByRole("button", { name: "נגן" }));
  expect(document.querySelector("iframe")!.src).toBe("https://www.youtube-nocookie.com/embed/vidOTHER?start=27&autoplay=1&playsinline=1&rel=0");
});

it("plays a review from its video cover too", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  fireEvent.click(within(near).getByRole("button", { name: /כל הסקירות/ }));
  const reviews = document.querySelector<HTMLElement>("dialog.stories-reviews")!;
  const entries = within(reviews).getAllByRole("listitem");
  fireEvent.click(within(entries[1]).getByRole("button", { name: /נגן את הסרטון של יוצר אחר/ }));
  expect(document.querySelector("iframe")!.src).toBe("https://www.youtube-nocookie.com/embed/vidOTHER?start=27&autoplay=1&playsinline=1&rel=0");
});

it("puts a review's source on one line and its month and moment on the next, never a lone separator", async () => {
  await startFromTelAviv();
  const [near] = await screen.findAllByRole("article");
  fireEvent.click(within(near).getByRole("button", { name: /כל הסקירות/ }));
  const reviews = document.querySelector<HTMLElement>("dialog.stories-reviews")!;
  const entry = reviews.querySelectorAll("li")[1];
  expect(entry.querySelector(".stories-review-src strong")!.textContent).toBe("יוצר אחר");
  const when = entry.querySelector(".stories-review-when")!.textContent!;
  expect(when).toContain("0:30");
  expect(when.trim().startsWith("·")).toBe(false);
  expect(when.trim().endsWith("·")).toBe(false);
  expect(entry.querySelector(".stories-review-src")!.textContent).not.toMatch(/·\s*$/);
});

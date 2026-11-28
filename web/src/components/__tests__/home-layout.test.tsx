import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { HomePageNew } from "../HomePageNew";
import { LocationFilterProvider } from "@/contexts/location-filter-context";
import { FavoritesProvider } from "@/contexts/favorites-context";
import { SettingsProvider } from "@/contexts/settings-context";
import { LanguageProvider } from "@/contexts/LanguageContext";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const place = (id: string, video: string) => ({
  id, name_hebrew: `מקום ${id}`, image_url: `https://x.test/api/venue-images/${id}.jpg`,
  location: { city: "תל אביב", lat: 32.08, lng: 34.78 },
  episode_info: { video_id: video, video_url: "", channel_name: "ערוץ", title: `פרק ${video}`, published_at: "2026-11-20" },
});

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({ restaurants: [place("a", "e1"), place("b", "e1")], total: 2 }) }),
  ) as jest.Mock;
});

function renderHome() {
  return render(
    <LanguageProvider>
    <SettingsProvider>
      <FavoritesProvider>
        <LocationFilterProvider>
          <HomePageNew />
        </LocationFilterProvider>
      </FavoritesProvider>
    </SettingsProvider>
    </LanguageProvider>,
  );
}

it("puts the episode circles at the top of the home page, above the heading", async () => {
  renderHome();
  const circles = await screen.findByRole("navigation", { name: "סטוריז לפי פרק" });
  const heading = screen.getByRole("heading", { level: 1 });
  expect(circles.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("has no scrolling slogan strip", async () => {
  renderHome();
  await screen.findByRole("navigation", { name: "סטוריז לפי פרק" });
  await waitFor(() => expect(document.querySelector(".marquee-strip")).toBeNull());
  expect(screen.queryByText(/אפס פספוסים/)).toBeNull();
});

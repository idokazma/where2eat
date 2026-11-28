import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { EpisodeCircles } from "../stories/EpisodeCircles";
import type { Restaurant } from "@/types/restaurant";

const r = (id: string, video: string, title: string, date: string) =>
  ({
    id, name_hebrew: id, image_url: `https://x.test/api/venue-images/${id}.jpg`,
    location: { city: "תל אביב", lat: 32.08, lng: 34.78 },
    episode_info: { video_id: video, video_url: "", channel_name: "ערוץ", title, published_at: date },
  }) as unknown as Restaurant;

beforeEach(() => localStorage.clear());

it("shows a circle per episode, newest first, linking to that episode's stories", () => {
  render(<EpisodeCircles restaurants={[r("a", "old", "ישן", "2026-11-01"), r("a2", "old", "ישן", "2026-11-01"), r("b", "new", "חדש", "2026-11-25"), r("b2", "new", "חדש", "2026-11-25")]} />);
  const links = screen.getAllByRole("link");
  expect(links.map((l) => l.getAttribute("href"))).toEqual(["/stories?episode=new", "/stories?episode=old"]);
  expect(links[0]).toHaveAccessibleName("חדש, 2 מסעדות, חדש");
});

it("marks an opened episode as seen", () => {
  render(<EpisodeCircles restaurants={[r("a", "e1", "פרק", "2026-11-01"), r("a2", "e1", "פרק", "2026-11-01")]} />);
  const link = screen.getByRole("link");
  expect(link).not.toHaveClass("seen");
  fireEvent.click(link);
  expect(JSON.parse(localStorage.getItem("w2e-seen-episode-stories")!)).toEqual(["e1"]);
});

it("leaves out a video with a single restaurant", () => {
  const { container } = render(<EpisodeCircles restaurants={[r("a", "short", "שורט", "2026-11-01")]} />);
  expect(container).toBeEmptyDOMElement();
});

it("renders nothing when no episode has a story-able restaurant", () => {
  const { container } = render(<EpisodeCircles restaurants={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("falls back to the next photo of the episode when one fails to load", () => {
  const a = r("a", "e1", "פרק", "2026-11-01");
  const b = r("b", "e1", "פרק", "2026-11-01");
  render(<EpisodeCircles restaurants={[a, b]} />);
  const img = document.querySelector("img")!;
  const first = img.getAttribute("src");
  fireEvent.error(img);
  expect(document.querySelector("img")!.getAttribute("src")).not.toBe(first);
});

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SavedPage from "../page";
import { FavoritesProvider } from "@/contexts/favorites-context";

jest.mock("@/components/layout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
jest.mock("@/components/restaurant", () => ({
  RestaurantCardNew: ({ restaurant }: { restaurant: { name_hebrew: string } }) => <h3>{restaurant.name_hebrew}</h3>,
}));

const restaurants = [
  { id: "saved1", name_hebrew: "השמורה שלי" },
  { id: "other", name_hebrew: "לא שמורה" },
];

const openSaved = () =>
  render(
    <FavoritesProvider>
      <SavedPage />
    </FavoritesProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ restaurants }) });
});

it("shows saved restaurants when /saved is opened directly (reload, installed app, shared link)", async () => {
  localStorage.setItem("where2eat-favorites", JSON.stringify(["saved1"]));
  openSaved();
  expect(await screen.findByRole("heading", { name: "השמורה שלי" })).toBeInTheDocument();
  expect(screen.queryByText("לא שמורה")).toBeNull();
  expect(screen.queryByText("עדיין לא שמרת מסעדות")).toBeNull();
});

it("does not load anything when nothing is saved", async () => {
  openSaved();
  expect(screen.getByText("עדיין לא שמרת מסעדות")).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

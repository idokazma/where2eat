import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MapPage from "../page";
import { FavoritesProvider } from "@/contexts/favorites-context";
import type { Restaurant } from "@/types/restaurant";

jest.mock("@/components/layout", () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
jest.mock(
  "next/dynamic",
  () => () =>
    function MockMap({
      restaurants,
      onMarkerClick,
    }: {
      restaurants: Restaurant[];
      onMarkerClick: (id: string) => void;
    }) {
      return (
        <div>
          {restaurants.map((r) => (
            <button key={r.id} onClick={() => onMarkerClick(r.id!)}>
              {r.name_hebrew}
            </button>
          ))}
        </div>
      );
    },
);
const mockLocate = jest.fn(() => Promise.resolve(null));
jest.mock("@/hooks/useGeolocation", () => ({
  useGeolocation: () => ({
    coords: null,
    accuracy: null,
    loading: false,
    getCurrentPosition: mockLocate,
  }),
}));
const data = [
  {
    id: "a",
    name_hebrew: "מסעדה א",
    location: { lat: 32, lng: 35 },
    cuisine_type: "יפני",
    episode_info: { channel_name: "מקור א" },
  },
  {
    id: "b",
    name_hebrew: "מסעדה ב",
    location: { lat: 33, lng: 35 },
    cuisine_type: "איטלקי",
    episode_info: { channel_name: "מקור ב" },
  },
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ restaurants: data }) });
});
const renderPage = () =>
  render(
    <FavoritesProvider>
      <MapPage />
    </FavoritesProvider>,
  );
it("preserves the capped three-month query and does not request GPS at startup", async () => {
  renderPage();
  await screen.findByText(/2 על המפה/);
  const url = new URL(
    (global.fetch as jest.Mock).mock.calls[0][0],
    "https://test.example",
  );
  expect(url.searchParams.get("limit")).toBe("100");
  expect(url.searchParams.get("sort_by")).toBe("published_at");
  expect(url.searchParams.get("sort_direction")).toBe("desc");
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  expect(url.searchParams.get("date_start")).toBe(
    cutoff.toISOString().split("T")[0],
  );
  expect(mockLocate).not.toHaveBeenCalled();
});
it("selects one preview, saves persistently, and filters saved restaurants", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "מסעדה א" }));
  expect(screen.getAllByRole("region")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "שמירת המסעדה" }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem("where2eat-favorites")!)).toEqual([
      "a",
    ]),
  );
  fireEvent.click(screen.getByLabelText("סינון מסעדות"));
  fireEvent.click(screen.getByLabelText("רק מסעדות ששמרתי"));
  expect(screen.getByText(/1 על המפה/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "מסעדה ב" }),
  ).not.toBeInTheDocument();
});
it("combines source/cuisine/search filters and recovers from empty results", async () => {
  renderPage();
  await screen.findByText(/2 על המפה/);
  fireEvent.click(screen.getByLabelText("סינון מסעדות"));
  fireEvent.change(screen.getByLabelText("מקור", { exact: true }), {
    target: { value: "מקור א" },
  });
  fireEvent.change(screen.getByLabelText("מטבח", { exact: true }), {
    target: { value: "איטלקי" },
  });
  expect(screen.getByText("אין תוצאות לסינון הזה")).toBeInTheDocument();
  fireEvent.click(screen.getByText("ניקוי הכל"));
  expect(screen.getByText(/2 על המפה/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("חיפוש מסעדה או מטבח"), {
    target: { value: "לא קיים" },
  });
  expect(screen.getByText("אין תוצאות לסינון הזה")).toBeInTheDocument();
});
it("shows a load failure rather than an empty successful map", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "שגיאה בטעינת המסעדות",
  );
});

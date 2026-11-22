import {
  filterMapRestaurants,
  restaurantSources,
  groupMapPoints,
  isSaved,
  getMapPreviewImage,
  getRestaurantInstagramUrl,
} from "../map-discovery";
import type { Restaurant } from "@/types/restaurant";
const make = (id: string, lat: number, lng: number): Restaurant => ({
  id,
  name_hebrew: `מסעדה ${id}`,
  cuisine_type: "איטלקי",
  location: {
    lat,
    lng,
    city: "חיפה",
    neighborhood: null,
    address: null,
    region: "North",
  },
  episode_info: {
    video_id: "video",
    video_url: "https://www.youtube.com/watch?v=video",
    channel_name: "מקור א",
  },
});
const project = (lat: number, lng: number) => ({ x: lat, y: lng });

describe("map discovery", () => {
  it("combines search, source, cuisine, saved and coordinate filters", () => {
    const a = make("a", 32, 35);
    const b = { ...make("b", 32, 35), cuisine_type: "יפני" };
    expect(
      filterMapRestaurants(
        [a, b, { name_hebrew: "ללא מיקום" }],
        "חיפה",
        "מקור א",
        "איטלקי",
        true,
        ["a"],
      ),
    ).toEqual([a]);
    expect(filterMapRestaurants([a], "", "אחר", "", false, [])).toEqual([]);
    expect(filterMapRestaurants([a], "לא קיים", "", "", false, [])).toEqual([]);
  });
  it("recognizes canonical and legacy favorites", () => {
    const r = { ...make("a", 32, 35), google_places: { place_id: "place" } };
    expect(isSaved(r, ["a"])).toBe(true);
    expect(isSaved(r, ["place"])).toBe(true);
    expect(isSaved(r, [])).toBe(false);
  });
  it("clusters nearby points and splits them when projected farther apart", () => {
    const items = [
      make("a", 32, 35),
      make("b", 32.01, 35.01),
      make("c", 100, 150),
    ];
    expect(groupMapPoints(items, project).map((g) => g.items.length)).toEqual([
      2, 1,
    ]);
    expect(
      groupMapPoints(items, (lat, lng) => ({ x: lat * 10000, y: lng * 10000 })),
    ).toHaveLength(3);
  });
  it("keeps selected and coincident restaurants individually reachable", () => {
    const items = [make("a", 32, 35), make("b", 32, 35), make("c", 32, 35)];
    const groups = groupMapPoints(items, project, "b");
    expect(
      groups.find((g) => g.items.some((r) => r.id === "b"))?.items,
    ).toHaveLength(1);
    expect(groups.flatMap((g) => g.items)).toHaveLength(3);
  });
  it("skips missing coordinates and keeps every valid restaurant exactly once", () => {
    const items = Array.from({ length: 100 }, (_, i) =>
      make(String(i), 30 + i / 100, 35),
    );
    const groups = groupMapPoints([...items, { name_hebrew: "ללא" }], project);
    expect(new Set(groups.flatMap((g) => g.items.map((r) => r.id))).size).toBe(
      100,
    );
  });
});

it("uses only stored direct images, never a paid Places request", () => {
  expect(
    getMapPreviewImage({
      name_hebrew: "א",
      image_url: "places/123/photos/abc",
    }),
  ).toBeNull();
  expect(
    getMapPreviewImage({
      name_hebrew: "א",
      image_url: "https://app.example/api/photos/abc",
    }),
  ).toBeNull();
  expect(
    getMapPreviewImage({
      name_hebrew: "א",
      image_url: "https://places.googleapis.com/v1/places/a/photos/b/media",
    }),
  ).toBeNull();
  expect(
    getMapPreviewImage({
      name_hebrew: "א",
      image_url: "https://app.example/api/venue-images/a.jpg",
    }),
  ).toBe("https://app.example/api/venue-images/a.jpg");
});

describe("restaurant sources", () => {
  it("includes the main episode's source and every extra mention's source", () => {
    const r = {
      name_hebrew: "x",
      episode_info: { channel_name: "מקור א" },
      mentions: [{ channel_name: "מקור ב" }, { channel_name: "מקור א" }, {}],
    } as unknown as Restaurant;
    expect(restaurantSources(r).sort()).toEqual(["מקור א", "מקור ב"]);
  });
  it("matches the source filter on an extra mention", () => {
    const r = {
      id: "m",
      name_hebrew: "x",
      location: { lat: 32, lng: 35 },
      episode_info: { channel_name: "מקור א" },
      mentions: [{ channel_name: "מקור ב" }],
    } as unknown as Restaurant;
    expect(filterMapRestaurants([r], "", "מקור ב", "", false, [])).toEqual([r]);
  });
});

describe("restaurant Instagram profile URLs", () => {
  it.each([
    "https://www.instagram.com/example_restaurant/",
    "https://instagram.com/example.restaurant",
  ])(
    "accepts the stored profile %s without inventing a handle",
    (instagram_url) => {
      expect(
        getRestaurantInstagramUrl({ name_hebrew: "דוגמה", instagram_url }),
      ).toBe(instagram_url);
    },
  );
  it("drops tracking parameters and fragments", () => {
    expect(
      getRestaurantInstagramUrl({
        name_hebrew: "דוגמה",
        instagram_url:
          " https://www.instagram.com/example/?igsh=tracking#fragment ",
      }),
    ).toBe("https://www.instagram.com/example/");
  });
  it.each([
    undefined,
    null,
    "",
    "@example",
    "javascript:alert(1)",
    "http://instagram.com/example/",
    "https://instagram.com.evil.test/example/",
    "https://evil.test/example/",
    "https://www.instagram.com/",
    "https://www.instagram.com/p/post/",
    "https://www.instagram.com/reel/video/",
    "https://www.instagram.com/stories/example/123/",
    "https://www.instagram.com/accounts/",
    "https://user:pass@instagram.com/example/",
    "https://instagram.com:8443/example/",
  ])("rejects a missing, unsafe or non-profile URL: %s", (instagram_url) => {
    expect(
      getRestaurantInstagramUrl({ name_hebrew: "דוגמה", instagram_url }),
    ).toBeNull();
  });
});

describe("getMapPreviewImage with stored photos", () => {
  it("prefers the first stored photo over a direct image link", () => {
    const r = {
      name_hebrew: "x",
      image_url: "https://lh3.googleusercontent.com/expired",
      stored_photos: [{ path: "/api/place-photos/aaa.jpg", width: 1, height: 1, credit: null }],
    } as unknown as Restaurant;
    expect(getMapPreviewImage(r)).toBe("/api/place-photos/aaa.jpg");
  });
});

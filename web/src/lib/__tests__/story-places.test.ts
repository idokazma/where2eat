import { normalizePlaceQuery, searchStoryPlaces } from "../story-places";
import places from "@/data/israel-places.json";

it("matches Hebrew punctuation, niqqud, hyphens and aliases", () => {
  expect(normalizePlaceQuery("  רַעֲנָנָה  ")).toBe("רעננה");
  expect(searchStoryPlaces(places, "רַעֲנָנָה")[0].id).toBe("293807");
  expect(searchStoryPlaces(places, "גולן")[0].id).toBe("173708");
  expect(searchStoryPlaces(places, "תל אביב יפו")[0].id).toBe("293397");
  expect(searchStoryPlaces(places, "RAANANA")[0].id).toBe("293807");
});

it("never invents a match and limits suggestions", () => {
  expect(searchStoryPlaces(places, "א")).toEqual([]);
  expect(searchStoryPlaces(places, "איןכזהמקוםבדיקה")).toEqual([]);
  expect(searchStoryPlaces(places, "בית").length).toBeLessThanOrEqual(8);
});

it("contains unique IDs, qualified coordinates and the user's two requested examples", () => {
  expect(new Set(places.map(p => p.id)).size).toBe(places.length);
  for (const p of places) {
    expect(p.lat).toBeGreaterThan(29);
    expect(p.lat).toBeLessThan(34);
    expect(p.lng).toBeGreaterThan(34);
    expect(p.lng).toBeLessThan(36.5);
    expect(p.name).toMatch(/[א-ת]/);
  }
  expect(searchStoryPlaces(places, "רמת הגולן")[0]).toMatchObject({ kind: "region", lat: 32.90485, lng: 35.80725 });
  expect(searchStoryPlaces(places, "רעננה")[0]).toMatchObject({ kind: "locality", lat: 32.1836, lng: 34.87386 });
});

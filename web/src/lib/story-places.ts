export interface StoryPlace {
  id: string;
  name: string;
  aliases: string[];
  kind: string;
  lat: number;
  lng: number;
}

/** Match spelling, not meaning: no invented coordinates or guessed first result. */
export function normalizePlaceQuery(value: string): string {
  return value.normalize("NFKD").replace(/[\u0591-\u05c7]/g, "")
    .toLowerCase().replace(/["'׳״‘’“”]/g, "").replace(/[-־–]/g, " ")
    .replace(/[^a-z0-9א-ת\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function searchStoryPlaces(places: StoryPlace[], query: string): StoryPlace[] {
  const q = normalizePlaceQuery(query);
  if (q.length < 2) return [];
  const tokens = q.split(" ");
  return places.map((place) => {
    const names = [place.name, ...place.aliases].map(normalizePlaceQuery);
    const rank = Math.min(...names.map((name) => name === q ? 0 : name.startsWith(q) ? 1
      : tokens.every((token) => name.split(" ").some((word) => word.startsWith(token))) ? 2
      : name.includes(q) ? 3 : 99));
    return { place, rank };
  }).filter(({ rank }) => rank < 99)
    .sort((a, b) => a.rank - b.rank || a.place.name.localeCompare(b.place.name, "he"))
    .slice(0, 8).map(({ place }) => place);
}

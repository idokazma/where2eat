import type { EpisodeDetail, Restaurant } from "@/types/restaurant";
import {
  buildStories,
  distanceBand,
  publishedAtMs,
  DISTANCE_BANDS_KM,
  storyFrames,
  excerpt,
  momentStart,
  quoteFromEpisode,
  sourceLabel,
  storySlides,
  storyAlternateImages,
  storyGoogleFallback,
  youtubeEmbedUrl,
  youtubeMomentUrl,
} from "../stories";

const TLV = { lat: 32.08, lng: 34.78 };
const photo = (id: string) => `https://where2eat-production.up.railway.app/api/venue-images/${id}.jpg`;

function rest(id: string, over: Partial<Record<keyof Restaurant, unknown>> = {}): Restaurant {
  return {
    id,
    name_hebrew: `מסעדה ${id}`,
    image_url: photo(id),
    location: { city: "תל אביב", lat: 32.08, lng: 34.78 },
    episode_info: {
      video_id: `vid_${id}`,
      video_url: "",
      channel_name: "מקור",
      title: "פרק",
    },
    mention_timestamp_seconds: 100,
    mention_level: "נטעם",
    ...over,
  } as unknown as Restaurant;
}

describe("excerpt", () => {
  it("keeps at most two sentences", () => {
    expect(excerpt("אחת. שתיים! שלוש?")).toBe("אחת. שתיים!");
  });
  it("caps long text at the limit on a word boundary with an ellipsis", () => {
    const out = excerpt("מילה ".repeat(80))!;
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out.endsWith("…")).toBe(true);
  });
  it("strips surrounding quote marks and returns null for empty text", () => {
    expect(excerpt('"טעים"')).toBe("טעים");
    expect(excerpt("   ")).toBeNull();
    expect(excerpt(undefined)).toBeNull();
  });
});

describe("storySlides", () => {
  it("makes one slide per distinct mention, tasted first", () => {
    const r = rest("a", {
      mentions: [
        { video_id: "v1", timestamp_seconds: 10, mention_level: "הוזכר", channel_name: "א" },
        { video_id: "v1", timestamp_seconds: 10, mention_level: "הוזכר", channel_name: "א" },
        { video_id: "v2", timestamp_seconds: 20, mention_level: "נטעם", channel_name: "ב" },
      ],
    });
    const slides = storySlides(r);
    expect(slides.map((s) => s.videoId)).toEqual(["v2", "v1"]);
    expect(slides[0].tasted).toBe(true);
  });
  it("falls back to the main episode when there are no mentions", () => {
    const [s] = storySlides(rest("a"));
    expect(s).toMatchObject({ videoId: "vid_a", seconds: 100, tasted: true, channel: "מקור" });
  });
  it("uses the main episode's channel when a mention has none", () => {
    const r = rest("a", { mentions: [{ video_id: "v1", timestamp_seconds: 5 }] });
    expect(storySlides(r)[0].channel).toBe("מקור");
  });
});

describe("buildStories", () => {
  it("orders nearby restaurants by distance and puts far ones after, by city", () => {
    const near2 = rest("near2", { location: { city: "רמת גן", lat: 32.09, lng: 34.82 } });
    const near1 = rest("near1", { location: { city: "תל אביב", lat: 32.081, lng: 34.781 } });
    const farB = rest("farB", { location: { city: "חיפה", lat: 32.8, lng: 34.98 } });
    const farA = rest("farA", { location: { city: "באר שבע", lat: 31.25, lng: 34.79 } });
    const feed = buildStories([farB, near2, farA, near1], TLV, { radiusKm: 50 });
    expect(feed.near.map((s) => s.restaurant.id)).toEqual(["near1", "near2"]);
    expect(feed.far.map((s) => s.restaurant.id)).toEqual(["farA", "farB"]);
    expect(feed.near[0].distanceKm).toBeLessThan(1);
  });
  it("skips hidden, closed, coordinate-less and photo-less restaurants", () => {
    const feed = buildStories(
      [
        rest("ok"),
        rest("hidden", { is_hidden: true }),
        rest("closed", { status: "closed" }),
        rest("nowhere", { location: { city: "תל אביב" } }),
        rest("nophoto", { image_url: null }),
        rest("proxy", { image_url: "https://x.up.railway.app/api/photos/places/P/photos/Q" }),
      ],
      TLV,
    );
    expect([...feed.near, ...feed.far].map((s) => s.restaurant.id)).toEqual(["ok"]);
  });
  it("merges a restaurant stored twice (same photo) into one story with both mentions", () => {
    const a = rest("a", { location: { city: "תל אביב", lat: 32.081, lng: 34.781 } });
    const dup = rest("dup", {
      image_url: photo("a"),
      location: { city: "תל אביב", lat: 32.0812, lng: 34.7812 },
      episode_info: { video_id: "vid_dup", video_url: "", channel_name: "מקור" },
    });
    const feed = buildStories([a, dup], TLV);
    expect(feed.near).toHaveLength(1);
    expect(feed.near[0].restaurant.id).toBe("a");
    expect(feed.near[0].slides.map((s) => s.videoId).sort()).toEqual(["vid_a", "vid_dup"]);
  });
  it("keeps branches apart: same photo but different Google places", () => {
    const rehovot = rest("rehovot", {
      image_url: photo("chain"),
      google_places: { place_id: "PLACE_REHOVOT" },
      location: { city: "רחובות", lat: 31.894, lng: 34.811 },
    });
    const nessZiona = rest("ness", {
      image_url: photo("chain"),
      google_places: { place_id: "PLACE_NESS" },
      location: { city: "נס ציונה", lat: 31.93, lng: 34.8 },
    });
    const feed = buildStories([rehovot, nessZiona], TLV, { radiusKm: 100 });
    expect(feed.near.map((s) => s.restaurant.id).sort()).toEqual(["ness", "rehovot"]);
  });
  it("keeps apart same-photo records more than 100 m apart even without Google places", () => {
    const a = rest("a", { image_url: photo("x"), location: { city: "תל אביב", lat: 32.08, lng: 34.78 } });
    const b = rest("b", { image_url: photo("x"), location: { city: "תל אביב", lat: 32.082, lng: 34.78 } });
    expect(buildStories([a, b], TLV).near).toHaveLength(2);
  });
  it("merges a same-place record when only one side has a Google place", () => {
    const a = rest("a", { image_url: photo("x"), google_places: { place_id: "P" } });
    const b = rest("b", { image_url: photo("x"), episode_info: { video_id: "vid_b", video_url: "", channel_name: "מקור" } });
    const feed = buildStories([a, b], TLV);
    expect(feed.near).toHaveLength(1);
    expect(feed.near[0].slides).toHaveLength(2);
  });
  it("filters by source across all of a restaurant's mentions", () => {
    const a = rest("a", { mentions: [{ video_id: "v", channel_name: "יוצר" }] });
    const b = rest("b");
    const feed = buildStories([a, b], TLV, { source: "יוצר" });
    expect(feed.near.map((s) => s.restaurant.id)).toEqual(["a"]);
    expect(feed.near[0].slides.map((s) => s.channel)).toEqual(["יוצר"]);
  });
});

describe("quoteFromEpisode", () => {
  const detail = (m: object[]) =>
    ({ episode: {}, mentions: { tasted: m, mentioned: [], reference_only: [] } }) as unknown as EpisodeDetail;

  it("prefers a verified quote and marks it verified", () => {
    const q = quoteFromEpisode(
      detail([{ linked_restaurant_id: "a", host_quotes: ["לא זה"], verified_quote: { text: "זה. בדיוק זה." } }]),
      "a",
    );
    expect(q).toEqual({ text: "זה. בדיוק זה.", verified: true });
  });
  it("falls back to the first transcript quote, unverified", () => {
    const q = quoteFromEpisode(detail([{ restaurant_id: "a", host_quotes: ["טעים מאוד"] }]), "a");
    expect(q).toEqual({ text: "טעים מאוד", verified: false });
  });
  it("returns null when the restaurant has no quote in the episode", () => {
    expect(quoteFromEpisode(detail([{ restaurant_id: "other", host_quotes: ["x"] }]), "a")).toBeNull();
  });
});

describe("moments and labels", () => {
  it("starts three seconds before the mention, never below zero", () => {
    expect(momentStart(100)).toBe(97);
    expect(momentStart(1)).toBe(0);
    expect(momentStart(null)).toBe(0);
  });
  it("builds privacy-enhanced embed and watch URLs at the moment", () => {
    expect(youtubeEmbedUrl("abc_DEF-123", 97)).toBe(
      "https://www.youtube-nocookie.com/embed/abc_DEF-123?start=97&autoplay=1&playsinline=1&rel=0",
    );
    expect(youtubeMomentUrl("abc_DEF-123", 97)).toBe("https://www.youtube.com/watch?v=abc_DEF-123&t=97s");
    expect(youtubeMomentUrl("abc_DEF-123", 0)).toBe("https://www.youtube.com/watch?v=abc_DEF-123");
  });
  it("labels a numbered episode by its number and trims the podium suffix", () => {
    expect(sourceLabel({ channel: "מדברים מהבטן - הפודיום", episodeTitle: "מדברים מהבטן 176 | אורח" })).toBe(
      "מדברים מהבטן 176",
    );
    expect(sourceLabel({ channel: "מדברים מהבטן - הפודיום", episodeTitle: "משהו אחר" })).toBe("מדברים מהבטן");
    expect(sourceLabel({ channel: null, episodeTitle: null })).toBe("מקור לא ידוע");
  });
});

describe("storyFrames", () => {
  const ref = (n: number, place = "P1") => ({ photo_reference: `places/${place}/photos/ref${n}`, photo_url: "", width: 1, height: 1 });
  const mention = (v: string, ch: string) => ({ video_id: v, timestamp_seconds: 10, channel_name: ch });

  it("pages through the place's photos only", () => {
    const r = rest("a", {
      google_places: { place_id: "P1" },
      photos: [ref(1), ref(2), ref(3)],
      mentions: [mention("v1", "יוצר א"), mention("v2", "יוצר ב")],
    });
    const frames = storyFrames(buildStories([r], TLV).near[0]);
    expect(frames).toHaveLength(4);
    expect(frames[0].photo).toEqual({ url: photo("a"), paid: false });
    expect(frames[1].photo.url).toMatch(/\/api\/photos\/places\/P1\/photos\/ref1\?maxwidth=/);
    expect(frames.every((f, i) => i === 0 || f.photo.paid)).toBe(true);
    // Reviews do not add pages: 4 distinct photos, 2 mentions stay on the story.
    expect(buildStories([r], TLV).near[0].slides).toHaveLength(2);
  });

  it("never repeats a photo for more reviews: a place with one photo and two reviews has one page", () => {
    const r = rest("a", { mentions: [mention("v1", "א"), mention("v2", "ב")] });
    const story = buildStories([r], TLV).near[0];
    expect(story.slides).toHaveLength(2);
    expect(storyFrames(story).map((f) => f.photo.url)).toEqual([photo("a")]);
  });

  it("skips photos of a different place (stale match) and can leave out paid photos entirely", () => {
    const r = rest("a", { google_places: { place_id: "P1" }, photos: [ref(1), ref(2, "OTHER")] });
    const story = buildStories([r], TLV).near[0];
    expect(storyFrames(story)).toHaveLength(2);
    expect(storyFrames(story, { extraPhotos: false })).toHaveLength(1);
  });
});

describe("storyFrames with stored photos", () => {
  it("pages through stored photos for free and never adds paid Google photos", () => {
    const r = rest("a", {
      image_url: null,
      google_places: { place_id: "P1" },
      photos: [{ photo_reference: "places/P1/photos/g1", photo_url: "", width: 1, height: 1 }],
      stored_photos: [
        { path: "/api/place-photos/s1.jpg", width: 1, height: 1, credit: "א" },
        { path: "/api/place-photos/s2.jpg", width: 1, height: 1, credit: "ב" },
      ],
    });
    const frames = storyFrames(buildStories([r], TLV).near[0]);
    expect(frames.map((f) => f.photo)).toEqual([
      { url: "/api/place-photos/s1.jpg", paid: false },
      { url: "/api/place-photos/s2.jpg", paid: false },
    ]);
  });
});

describe("distance bands with recency", () => {
  const at = (id: string, dLat: number, published?: string | null, episode?: string) =>
    rest(id, {
      location: { city: "תל אביב", lat: 32.08 + dLat, lng: 34.78 },
      published_at: published,
      episode_info: { video_id: `vid_${id}`, video_url: "", channel_name: "מקור", title: "פרק", published_at: episode },
    });

  it("bands are 1, 3, 10 and 50 km", () => {
    expect(DISTANCE_BANDS_KM).toEqual([1, 3, 10, 50]);
    expect([0.5, 1, 1.01, 3, 9.9, 10.1, 50, 60].map((k) => distanceBand(k))).toEqual([0, 0, 1, 1, 2, 3, 3, 4]);
  });

  it("sorts bands nearest first and the newest episode first inside a band", () => {
    const oldClose = at("oldClose", 0.001, "2026-01-01T00:00:00Z");
    const newFarther = at("newFarther", 0.007, "2026-09-01T00:00:00Z"); // ~0.8 km, same band
    const midBand = at("midBand", 0.03, "2026-11-01T00:00:00Z"); // ~3.3 km, band 2
    const feed = buildStories([midBand, oldClose, newFarther], TLV);
    expect(feed.near.map((s) => s.restaurant.id)).toEqual(["newFarther", "oldClose", "midBand"]);
  });

  it("uses the episode upload date, falls back to the episode record, and puts unknown dates last in the band", () => {
    expect(publishedAtMs(at("a", 0, "2026-05-01T00:00:00Z", "2026-01-01T00:00:00Z"))).toBe(Date.parse("2026-05-01T00:00:00Z"));
    expect(publishedAtMs(at("b", 0, null, "2026-01-01T00:00:00Z"))).toBe(Date.parse("2026-01-01T00:00:00Z"));
    expect(publishedAtMs(at("c", 0))).toBe(0);
    const feed = buildStories([at("unknown", 0.001), at("dated", 0.002, "2026-02-01T00:00:00Z")], TLV);
    expect(feed.near.map((s) => s.restaurant.id)).toEqual(["dated", "unknown"]);
  });

  it("merged twins keep the newest date", () => {
    const a = at("a", 0, "2026-01-01T00:00:00Z");
    const dup = { ...at("dup", 0, "2026-08-01T00:00:00Z"), image_url: a.image_url } as Restaurant;
    const feed = buildStories([a, dup], TLV);
    expect(feed.near).toHaveLength(1);
    expect(feed.near[0].publishedAt).toBe(Date.parse("2026-08-01T00:00:00Z"));
  });
});

describe("buildStories without a location (newest first)", () => {
  it("orders every listed place with a photo by its newest episode, with no distance and no far group", () => {
    const old = rest("old", { published_at: "2026-01-01" });
    const fresh = rest("fresh", { published_at: "2026-11-01", location: { city: "חיפה", lat: 32.8, lng: 34.98 } });
    const mid = rest("mid", { published_at: "2026-06-01" });
    const noCoords = rest("nocoords", { published_at: "2026-09-01", location: { city: "תל אביב" } });
    const hidden = rest("hidden", { published_at: "2026-11-20", is_hidden: true });
    const feed = buildStories([old, fresh, mid, noCoords, hidden], null);
    expect(feed.near.map((s) => s.restaurant.id)).toEqual(["fresh", "nocoords", "mid", "old"]);
    expect(feed.far).toEqual([]);
    expect(feed.near.every((s) => s.distanceKm === null)).toBe(true);
  });
});

describe("storyAlternateImages", () => {
  const G = "https://lh3.googleusercontent.com/place-photos/AG9N-dead=s4800-w800";
  const OWN = "https://example.co.il/uploads/dish.jpg";

  it("lists other free direct images of the same place, in order, without the primary", () => {
    const r = rest("a", { image_url: G, og_image_url: OWN, photos: [{ photo_url: "https://example.co.il/uploads/room.jpg" }] });
    expect(storyAlternateImages(r, G)).toEqual([OWN, "https://example.co.il/uploads/room.jpg"]);
  });

  it("skips logos, the paid photo proxy, Places URLs and non-http values", () => {
    const r = rest("a", {
      image_url: G,
      og_image_url: "https://example.co.il/uploads/2021/12/logo_white.png",
      photos: [
        { photo_reference: "places/X/photos/Y", photo_url: "https://example.co.il/should-not-be-used.jpg" },
        { photo_url: "https://where2eat-production.up.railway.app/api/photos/places/X/photos/Y?maxwidth=800" },
        { photo_url: "https://places.googleapis.com/v1/places/X/photos/Y/media" },
        { photo_url: "data:image/png;base64,AAAA" },
      ],
    });
    expect(storyAlternateImages(r, G)).toEqual([]);
  });

  it("keeps a photo stored under a folder named icons (Ontopo venue covers), judging the file name only", () => {
    const cover = "https://ros-prd-il-resources.s3.amazonaws.com/organization/icons/9246292ae66837cd9342b74941e14290";
    const r = rest("a", { image_url: G, og_image_url: cover });
    expect(storyAlternateImages(r, G)).toEqual([cover]);
  });

  it("is attached to each story by buildStories and never repeats the primary", () => {
    const r = rest("a", { image_url: G, og_image_url: OWN });
    const feed = buildStories([r], TLV);
    expect(feed.near[0].image).toBe(G);
    expect(feed.near[0].alternates).toEqual([OWN]);
  });
});

describe("storyGoogleFallback", () => {
  it("offers the place's first Google photo through the saving photo route", () => {
    const r = rest("a", {
      google_places: { place_id: "P1" },
      photos: [
        { photo_reference: "places/OTHER/photos/x", photo_url: "", width: 1, height: 1 },
        { photo_reference: "places/P1/photos/g1", photo_url: "", width: 1, height: 1 },
      ],
    });
    const [story] = buildStories([r], TLV).near;
    expect(storyGoogleFallback(story)).toEqual([expect.stringMatching(/\/api\/photos\/places\/P1\/photos\/g1\?maxwidth=900$/)]);
  });

  it("offers nothing when the place has no Google photos", () => {
    const [story] = buildStories([rest("a")], TLV).near;
    expect(storyGoogleFallback(story)).toEqual([]);
  });
});

import type { EpisodeDetail, Restaurant } from "@/types/restaurant";
import {
  buildStories,
  excerpt,
  momentStart,
  quoteFromEpisode,
  sourceLabel,
  storySlides,
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
      location: { city: "תל אביב", lat: 32.09, lng: 34.79 },
      episode_info: { video_id: "vid_dup", video_url: "", channel_name: "מקור" },
    });
    const feed = buildStories([a, dup], TLV);
    expect(feed.near).toHaveLength(1);
    expect(feed.near[0].restaurant.id).toBe("a");
    expect(feed.near[0].slides.map((s) => s.videoId).sort()).toEqual(["vid_a", "vid_dup"]);
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

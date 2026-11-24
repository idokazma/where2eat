"use client";
/* eslint-disable @next/next/no-img-element -- Direct URLs and the existing photo proxy; no image optimizer. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Navigation, Play, Share2, X, Loader2, UtensilsCrossed } from "lucide-react";
import { endpoints } from "@/lib/config";
import { fetchEpisodeDetail } from "@/lib/api/episodes";
import { useFavorites } from "@/contexts/favorites-context";
import { useGeolocation } from "@/hooks/useGeolocation";
import { favoriteKey, isSaved } from "@/lib/map-discovery";
import { formatDistance, type GeoCoords } from "@/lib/geo-utils";
import { getCoordinates, type EpisodeDetail, type Restaurant } from "@/types/restaurant";
import {
  buildStories,
  excerpt,
  formatClock,
  momentStart,
  quoteFromEpisode,
  sourceLabel,
  storyFrames,
  storyShareText,
  storyShareUrl,
  pinStory,
  storyPhotoKey,
  visibleStoryFrameIndices,
  shouldLoadStoryFrame,
  needsPlacePhotoCount,
  placePhotoCountUrl,
  PREFETCH_AHEAD,
  storyGoogleFallback,
  youtubeEmbedUrl,
  youtubeMomentUrl,
  type Story,
  type StoryFrame,
  type StoryQuote,
  type StorySlide,
} from "@/lib/stories";
import "./stories.css";
import { PlaceAutocomplete } from "./PlaceAutocomplete";

/** A source-video cover, never a restaurant photo or a frame at the review time. */
function ReviewThumbnail({ slide, onPlay }: { slide: StorySlide; onPlay: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button className="stories-review-thumbnail" onClick={onPlay} aria-label={`נגן את הסרטון של ${sourceLabel(slide)}`}>
      {failed ? (
        <span className="stories-review-thumbnail-fallback">
          <Play size={20} aria-hidden="true" />
          תמונה לא זמינה
        </span>
      ) : (
        <img
          src={`https://img.youtube.com/vi/${encodeURIComponent(slide.videoId)}/hqdefault.jpg`}
          alt={`תמונת הסרטון של ${sourceLabel(slide)}`}
          width={480}
          height={360}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </button>
  );
}

const RADIUS_KM = 50;
// Stories are placed by distance, but only the ones around the one in view are
// built. The rest stay as empty full-height slots, so scrolling, snapping and
// the count keep working while the page holds a handful of stories, not all.
const MOUNT_BEHIND = 2;
const MOUNT_AHEAD = 4;
// Autoplay: next place every 10 s, next photo of the place every 4 s. A finger on
// the screen, the open player or a background tab holds both; reduced motion turns
// autoplay off.
const STORY_MS = 10_000;
// Opening the site asks for the location; without an answer by then, newest first.
const LOCATE_WAIT_MS = 8_000;
const PHOTO_MS = 4_000;
// A photo slot that failed is skipped after this pause instead of stopping the rotation.
const SKIP_FAILED_MS = 700;
const PRESETS: [string, number, number][] = [
  ["תל אביב · דיזנגוף", 32.0809, 34.774],
  ["תל אביב · שוק הכרמל", 32.068683, 34.769047],
  ["תל אביב · שוק לוינסקי", 32.0594379, 34.7728971],
  ["ירושלים · מחנה יהודה", 31.7852, 35.212],
  ["חיפה · המושבה הגרמנית", 32.8193, 34.9877],
  ["חיפה · ואדי ניסנאס", 32.816496, 34.99608449999999],
  ["הרצליה", 32.1663, 34.8433],
  ["באר שבע", 31.252, 34.7915],
  ["נצרת", 32.7019, 35.2971],
];

type Item = { kind: "story"; story: Story } | { kind: "divider"; count: number };

export function StoriesView({
  extraPhotoLimit,
  autoStart = true,
}: {
  extraPhotoLimit: number;
  /** Open straight into stories: by location when allowed, otherwise newest first. */
  autoStart?: boolean;
}) {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // coords null: no location, newest first.
  const [origin, setOrigin] = useState<{ coords: GeoCoords | null; fromDevice: boolean } | null>(null);
  const [autoLocating, setAutoLocating] = useState(autoStart);
  const [source, setSource] = useState("");
  const [locError, setLocError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  // Image URLs that failed to load, kept for the whole visit so none is requested twice.
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [episodes, setEpisodes] = useState<Record<string, EpisodeDetail | null>>({});
  const [slideAt, setSlideAt] = useState<Record<string, number>>({});
  // Paid Google photos granted this visit: only ones the viewer moved to, up to the limit.
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<{ story: Story; slide: StorySlide } | null>(null);
  // All reviews of one place, opened from its card. Separate from the photo strip.
  const [reviewsFor, setReviewsFor] = useState<Story | null>(null);
  const reviewsRef = useRef<HTMLDialogElement>(null);
  const [hint, setHint] = useState(false);
  const [held, setHeld] = useState(false);
  // Sharing: a link with ?story=<id> opens with that place first.
  const [sharedId] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("story"),
  );
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Holding pauses; a tap that ends a long hold is not a tap (Instagram behaviour).
  // Decided when the press ends and used once, so a keyboard activation (no press) is
  // never mistaken for the end of an earlier hold.
  const pressStart = useRef(0);
  const lastPressWasLong = useRef(false);
  const LONG_PRESS_MS = 350;
  // Pause only once a finger stays down: pausing on every touch restarted the running
  // bar on release, so a quick tap flashed the bar empty before the next photo came in.
  const HOLD_DELAY_MS = 200;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = () => {
    pressStart.current = Date.now();
    lastPressWasLong.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => setHeld(true), HOLD_DELAY_MS);
  };
  const release = () => {
    if (pressStart.current) lastPressWasLong.current = Date.now() - pressStart.current > LONG_PRESS_MS;
    pressStart.current = 0;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeld(false);
  };
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);
  const wasLongPress = () => {
    const long = lastPressWasLong.current;
    lastPressWasLong.current = false;
    return long;
  };
  const [tabHidden, setTabHidden] = useState(false);
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
  );
  const requested = useRef(new Set<string>());
  const feedRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { loading: locating, getCurrentPosition } = useGeolocation({
    enableHighAccuracy: false,
    timeout: LOCATE_WAIT_MS,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoints.restaurants.search({ page: "1", limit: "500", sort_by: "published_at", sort_direction: "desc" }), {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => setRestaurants(data.restaurants || []))
      .catch((e) => {
        if (e.name !== "AbortError") setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of restaurants ?? []) {
      if (!getCoordinates(r.location)) continue;
      const names = new Set([r.episode_info?.channel_name, ...(r.mentions ?? []).map((m) => m.channel_name)]);
      for (const n of names) if (n?.trim()) counts.set(n.trim(), (counts.get(n.trim()) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  }, [restaurants]);

  const feed = useMemo(() => {
    if (!origin || !restaurants) return null;
    const built = buildStories(restaurants, origin.coords, { radiusKm: RADIUS_KM, source });
    return sharedId ? pinStory(built, sharedId) : built;
  }, [origin, restaurants, source, sharedId]);

  const items: Item[] = useMemo(() => {
    if (!feed) return [];
    const { near, far } = feed;
    return [
      ...near.map((story) => ({ kind: "story" as const, story })),
      ...(far.length ? [{ kind: "divider" as const, count: far.length }] : []),
      ...far.map((story) => ({ kind: "story" as const, story })),
    ];
  }, [feed]);

  // Track the story in view.
  useEffect(() => {
    const root = feedRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // Places with a Google ID but no saved photo list: ask how many photos each has (the API
  // asks Google once per place and saves the list), for the story in view and the next one,
  // so the story shows exactly that many photos and never guessed empty slots.
  const [placeCounts, setPlaceCounts] = useState<Record<string, number>>({});
  const countsRequested = useRef(new Set<string>());
  useEffect(() => {
    if (extraPhotoLimit <= 0) return;
    for (const item of items.slice(current, current + 2)) {
      if (item.kind !== "story") continue;
      const r = item.story.restaurant;
      const placeId = r.google_place_id;
      if (!placeId || !needsPlacePhotoCount(r) || countsRequested.current.has(placeId)) continue;
      countsRequested.current.add(placeId);
      fetch(placePhotoCountUrl(placeId))
        .then(async (res) => (res.ok ? Number((await res.json())?.count) || 0 : 0))
        .catch(() => 0)
        .then((count) => setPlaceCounts((prev) => ({ ...prev, [placeId]: count })));
    }
  }, [items, current, extraPhotoLimit]);

  // Quotes come from the episode pages, loaded only for the stories in and just after view.
  useEffect(() => {
    for (const item of items.slice(current, current + 3)) {
      if (item.kind !== "story") continue;
      for (const s of item.story.slides) {
        if (requested.current.has(s.videoId)) continue;
        requested.current.add(s.videoId);
        fetchEpisodeDetail(s.videoId)
          .then((d) => setEpisodes((prev) => ({ ...prev, [s.videoId]: d })))
          .catch(() => setEpisodes((prev) => ({ ...prev, [s.videoId]: null })));
      }
    }
  }, [items, current]);

  const quoteFor = (story: Story, slide: StorySlide): StoryQuote | null => {
    if (!(slide.videoId in episodes)) return null;
    const detail = episodes[slide.videoId];
    const fromEpisode = detail ? quoteFromEpisode(detail, slide.restaurantId) : null;
    if (fromEpisode) return fromEpisode;
    const summary = slide.videoId === story.restaurant.episode_info?.video_id ? excerpt(story.restaurant.engaging_quote) : null;
    return summary ? { text: summary, verified: false } : null;
  };

  const begin = (coords: GeoCoords | null, fromDevice: boolean) => {
    setAutoLocating(false);
    setOrigin({ coords, fromDevice });
    setCurrent(0);
    setSlideAt({});
    setHint(true);
    feedRef.current?.scrollTo?.({ top: 0 });
  };

  const locate = async () => {
    setLocError(null);
    try {
      const coords = await getCurrentPosition();
      if (coords) begin(coords, true);
    } catch {
      setLocError("לא הצלחנו לאתר מיקום. בחרו נקודה למטה.");
    }
  };

  // Open straight into stories: ask for the location once; if it is refused, unavailable
  // or not answered in time, show the newest places instead. A late answer is ignored
  // so the feed does not reorder under the viewer (the pin button changes it).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    let settled = false;
    const settle = (coords: GeoCoords | null) => {
      if (settled) return;
      settled = true;
      begin(coords, !!coords);
    };
    const t = setTimeout(() => settle(null), LOCATE_WAIT_MS);
    getCurrentPosition()
      .then((coords) => settle(coords ?? null))
      .catch(() => settle(null));
    return () => clearTimeout(t);
    // begin and getCurrentPosition are stable enough for a one-time start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 2800);
    return () => clearTimeout(t);
  }, [hint]);

  // A story whose photo fails moves on to its next free image, then to an intentional
  // fallback background. It is never dropped from the feed or left blank.
  const onImageError = (url: string) => setFailedImages((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  // Paid photos allowed this visit, up to the limit: ones the viewer reached, and the
  // next one on the active story (prefetched once the photo in view loaded).
  const grant = (url: string) =>
    setGranted((prev) => (prev.has(url) || prev.size >= extraPhotoLimit ? prev : new Set(prev).add(url)));
  const reach = (id: string, i: number, frames: StoryFrame[]) => {
    setSlideAt((prev) => (prev[id] === i ? prev : { ...prev, [id]: i }));
    const f = frames[i];
    if (f?.photo.paid) grant(f.photo.url);
  };

  const goStory = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(items.length - 1, current + delta));
      feedRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ behavior: "smooth" });
    },
    [items.length, current],
  );

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const autoplay = !!origin && !held && !player && !reviewsFor && !sharing && !tabHidden && !reducedMotion;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  // The phone's share menu (WhatsApp, Instagram, Messages…); otherwise copy the link;
  // if that fails too, open WhatsApp with the message ready.
  const shareStory = async (story: Story) => {
    const url = storyShareUrl(window.location.origin, story.restaurant.id!);
    const lead = story.slides[0];
    const text = storyShareText(story.restaurant, lead ? quoteFor(story, lead)?.text : null);
    if (typeof navigator.share === "function") {
      setSharing(true);
      try {
        await navigator.share({ title: story.restaurant.name_hebrew || "Where2Eat", text, url });
      } catch {
        // Closed without sharing.
      } finally {
        setSharing(false);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("הקישור הועתק");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
    }
  };
  // A new place in view (by hand or on its own) or a released finger restarts the count.
  useEffect(() => {
    if (!autoplay || current >= items.length - 1) return;
    const t = setTimeout(() => goStory(1), STORY_MS);
    return () => clearTimeout(t);
  }, [autoplay, current, items.length, goStory]);

  const openPlayer = (story: Story, slide: StorySlide) => {
    setPlayer({ story, slide });
    dialogRef.current?.showModal();
  };
  const openReviews = (story: Story) => {
    setReviewsFor(story);
    reviewsRef.current?.showModal();
  };
  const closeReviews = () => {
    reviewsRef.current?.close();
    setReviewsFor(null);
  };
  const playFromReviews = (story: Story, slide: StorySlide) => {
    closeReviews();
    openPlayer(story, slide);
  };
  const closePlayer = () => {
    dialogRef.current?.close();
    setPlayer(null);
  };

  useEffect(() => {
    if (!origin) return;
    const onKey = (e: KeyboardEvent) => {
      if (player || reviewsFor) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goStory(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goStory(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [origin, player, reviewsFor, goStory]);

  if (autoLocating || (origin && !restaurants && !loadError)) {
    return (
      <main className="stories-app">
        <section className="stories-locating" role="status">
          <span className="stories-logo">Where2Eat</span>
          <Loader2 size={34} className="animate-spin" aria-hidden="true" />
          <p>{autoLocating ? "מחפשים מסעדות קרובות אליך…" : "טוען מסעדות…"}</p>
          {autoLocating && (
            <button className="stories-pill" onClick={() => begin(null, false)}>
              דלגו: הכי חדשות
            </button>
          )}
          <Link href="/home" className="stories-pill" aria-label="יציאה">
            <X size={16} aria-hidden="true" /> לעמוד הראשי
          </Link>
        </section>
      </main>
    );
  }

  if (!origin) {
    return (
      <main className="stories-app">
        <section className="stories-start">
          <Link href="/home" className="stories-logo">
            Where2Eat
          </Link>
          <h1>
            איפה אוכלים <span className="stories-hl">ליד?</span>
          </h1>
          <p className="stories-lead">
            ביקורות מהפודקאסטים, מהקרוב לרחוק. הקישו על התמונה לתמונה הבאה, והחליקו למעלה למסעדה הבאה.
          </p>
          <div className="stories-card">
            <button className="stories-pill teal big" onClick={locate} disabled={locating || !restaurants}>
              <MapPin size={18} aria-hidden="true" /> {locating ? "מאתר…" : "לפי המיקום שלי"}
            </button>
            {locError && <p className="stories-err">{locError}</p>}
            <p className="stories-note">המיקום נשאר בדפדפן: המיון נעשה כאן ושום דבר לא נשלח לשרת.</p>
          </div>
          <div className="stories-card">
            <PlaceAutocomplete disabled={!restaurants} onSelect={(coords) => begin(coords, false)} />
          </div>
          <div className="stories-card">
            <h2>או להתחיל מנקודה</h2>
            <div className="stories-grid">
              {PRESETS.map(([name, lat, lng]) => (
                <button
                  key={name}
                  className="stories-pill"
                  disabled={!restaurants}
                  onClick={() => begin({ lat, lng }, false)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="stories-card">
            <button className="stories-pill big" disabled={!restaurants} onClick={() => begin(null, false)}>
              החדשות ביותר
            </button>
          </div>
          <p className="stories-note stories-data-sources"><Link href="/data-sources">מקורות מידע</Link></p>
          {sources.length > 1 && (
            <div className="stories-card">
              <label className="stories-row">
                <span>מקור</span>
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  <option value="">כל המקורות</option>
                  {sources.map(([name, n]) => (
                    <option key={name} value={name}>
                      {name} ({n})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!restaurants && !loadError && (
            <p className="stories-note" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> טוען מסעדות…
            </p>
          )}
          {loadError && <p className="stories-err">לא הצלחנו לטעון את המסעדות. נסו לרענן.</p>}
        </section>
      </main>
    );
  }


  return (
    <main className="stories-app">
      <div className="stories-top">
        <button className="stories-pill" onClick={() => setOrigin(null)} aria-label="בחירת מיקום">
          <MapPin size={16} aria-hidden="true" />
        </button>
        <Link href="/home" className="stories-pill" aria-label="יציאה">
          <X size={16} aria-hidden="true" />
        </Link>
      </div>
      {toast && (
        <div className="stories-toast" role="status">
          {toast}
        </div>
      )}
      {hint && <div className="stories-hint">הקשה: תמונה הבאה · החלקה למעלה: מסעדה · החזקה: עצירה</div>}
      <div
        className="stories-feed"
        ref={feedRef}
        tabIndex={0}
        aria-label="סטוריז מסעדות"
        onTouchStart={press}
        onTouchEnd={(e) => e.touches.length === 0 && release()}
        onTouchCancel={release}
        onMouseDown={press}
        onMouseUp={release}
        onMouseLeave={() => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          holdTimer.current = null;
          setHeld(false);
        }}
      >
        {!items.length && (
          <section className="stories-divider" data-index={0}>
            <div>
              <h2>אין תוצאות</h2>
              <p className="stories-note">נסו מקור אחר.</p>
            </div>
          </section>
        )}
        {items.map((item, index) =>
          item.kind === "divider" ? (
            <section key="divider" className="stories-divider" data-index={index}>
              <div>
                <span className="stories-pill sun">{item.count} מסעדות</span>
                <h2>מחוץ ל-{RADIUS_KM} ק״מ</h2>
                <p className="stories-note">מקובצות לפי עיר.</p>
              </div>
            </section>
          ) : (
            <section key={item.story.restaurant.id} className="stories-slot" data-index={index}>
              {index >= current - MOUNT_BEHIND && index <= current + MOUNT_AHEAD && (
            <StoryView
              story={item.story}
              near={index >= current - 1 && index <= current + 3}
              active={index === current}
              failedImages={failedImages}
              saved={isSaved(item.story.restaurant, favorites)}
              slideIndex={slideAt[item.story.restaurant.id!] ?? 0}
              autoplay={autoplay && index === current}
              smooth={!reducedMotion}
              extraPhotos={extraPhotoLimit > 0}
              placePhotoCount={placeCounts[item.story.restaurant.google_place_id ?? ""] ?? 0}
              granted={granted}
              quoteFor={quoteFor}
              onSlide={(i, frames) => reach(item.story.restaurant.id!, i, frames)}
              onPrefetch={grant}
              onImageError={onImageError}
              onPlay={(slide) => openPlayer(item.story, slide)}
              onReviews={() => openReviews(item.story)}
              onShare={() => shareStory(item.story)}
              onNextStory={() => goStory(1)}
              ignoreTap={wasLongPress}
              onSave={() => {
                const key = favoriteKey(item.story.restaurant);
                if (isSaved(item.story.restaurant, favorites)) removeFavorite(key);
                else addFavorite(key);
              }}
            />
              )}
            </section>
          ),
        )}
      </div>
      <dialog ref={reviewsRef} className="stories-sheet stories-reviews" onClose={() => setReviewsFor(null)} aria-label="כל הסקירות">
        {reviewsFor && (
          <>
            <header>
              <h2>
                {reviewsFor.restaurant.name_hebrew} · {reviewsFor.slides.length} סקירות
              </h2>
              <button className="stories-x" onClick={closeReviews} aria-label="סגירה">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <ul className="stories-review-list">
              {reviewsFor.slides.map((slide) => {
                const q = quoteFor(reviewsFor, slide);
                const published = episodes[slide.videoId]?.episode?.published_at;
                const date = published && !Number.isNaN(Date.parse(published))
                  ? new Date(published).toLocaleDateString("he-IL", { year: "numeric", month: "long" })
                  : null;
                return (
                  <li key={`${slide.videoId}@${slide.seconds ?? ""}`} className="stories-review">
                    <div className="stories-review-heading">
                      <ReviewThumbnail slide={slide} onPlay={() => playFromReviews(reviewsFor, slide)} />
                      {/* Source on one line, month and moment on the next: a narrow screen never
                          leaves a separator at the start or end of a line. */}
                      <div className="stories-review-meta">
                        <p className="stories-review-src">
                          {slide.tasted && <span className="stories-tick">נטעם</span>}
                          <strong className="stories-review-part">{sourceLabel(slide)}</strong>
                        </p>
                        {(date || formatClock(slide.seconds)) && (
                          <p className="stories-review-when">
                            {[date, formatClock(slide.seconds)].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="stories-review-quote">
                      {q ? (q.verified ? `״${q.text}״` : q.text) : "אין ציטוט זמין לסקירה הזו"}
                    </p>
                    <button className="stories-pill sun" onClick={() => playFromReviews(reviewsFor, slide)}>
                      <Play size={14} aria-hidden="true" /> נגן
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </dialog>
      <dialog ref={dialogRef} className="stories-sheet" onClose={() => setPlayer(null)} aria-label="נגן">
        {player && (
          <>
            <header>
              <h2>
                {player.story.restaurant.name_hebrew} · {formatClock(momentStart(player.slide.seconds)) ?? "מההתחלה"}
              </h2>
              <button className="stories-x" onClick={closePlayer} aria-label="סגירה">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="stories-player">
              <iframe
                src={youtubeEmbedUrl(player.slide.videoId, momentStart(player.slide.seconds))}
                title="YouTube"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <a
              className="stories-pill"
              href={youtubeMomentUrl(player.slide.videoId, momentStart(player.slide.seconds))}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ פתיחה ביוטיוב ברגע הזה
            </a>
          </>
        )}
      </dialog>
    </main>
  );
}

function StoryView({
  story: base,
  near,
  active,
  failedImages,
  saved,
  slideIndex,
  autoplay,
  smooth,
  extraPhotos,
  placePhotoCount,
  granted,
  quoteFor,
  onSlide,
  onPrefetch,
  onImageError,
  onPlay,
  onReviews,
  onSave,
  onNextStory,
  ignoreTap,
  onShare,
}: {
  story: Story;
  near: boolean;
  active: boolean;
  failedImages: Set<string>;
  saved: boolean;
  slideIndex: number;
  autoplay: boolean;
  smooth: boolean;
  extraPhotos: boolean;
  placePhotoCount: number;
  granted: Set<string>;
  quoteFor: (story: Story, slide: StorySlide) => StoryQuote | null;
  onSlide: (i: number, frames: StoryFrame[]) => void;
  onPrefetch: (url: string) => void;
  onImageError: (url: string) => void;
  onPlay: (slide: StorySlide) => void;
  onReviews: () => void;
  onSave: () => void;
  onNextStory: () => void;
  ignoreTap: () => boolean;
  onShare: () => void;
}) {
  // The story's own photo, or the next free image of the same place when it failed.
  const image =
    [base.image, ...base.alternates, ...(extraPhotos ? storyGoogleFallback(base) : [])].find(
      (u) => !failedImages.has(u),
    ) ?? null;
  const story = useMemo(() => (image ? { ...base, image } : base), [base, image]);
  const r = story.restaurant;
  const c = getCoordinates(r.location);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  // Keep slot identities stable on errors. Removing a failed frame would move the
  // next paid reference into the observed slot and grant it without a new gesture.
  // The primary/free backdrop and source remain visible beneath a failed slot.
  const frames = useMemo(() => storyFrames(base, { extraPhotos, placePhotoCount }), [base, extraPhotos, placePhotoCount]);
  // What a slot actually shows: the first slot shows the story's image, which may be a
  // working backup when the stored main photo failed.
  const slotUrl = (i: number) => (i === 0 && image ? image : frames[i]?.photo.url);
  const slotFailed = (i: number) => {
    const url = slotUrl(i);
    return !!url && (failed.has(url) || failedImages.has(url));
  };
  const currentFailed = slotFailed(slideIndex);
  const allFailed = frames.every((_, i) => slotFailed(i));
  const visible = useMemo(() => visibleStoryFrameIndices(frames, image, r), [frames, image, r]);
  const visibleKey = visible.join(",");
  const n = frames.length;
  const framesRef = useRef<HTMLDivElement>(null);
  // If the displayed backup aliases the active proxy slot, return to its free
  // representative without reindexing or granting a different paid reference.
  useEffect(() => {
    if (visible.includes(slideIndex)) return;
    onSlide(0, frames);
    const root = framesRef.current;
    const first = root?.querySelector<HTMLElement>('[data-slide="0"]');
    if (root && first) root.scrollLeft += first.getBoundingClientRect().left - root.getBoundingClientRect().left;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, slideIndex]);
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const imageLoaded = (url: string) => setLoaded((old) => old.has(url) ? old : new Set(old).add(url));
  // Once the photo in view has loaded on the active story, allow the next two photos to load
  // ahead (Google ones included, within the visit's limit), so a tap shows them at once.
  const currentReady = loaded.has(slotUrl(slideIndex) ?? "");
  const nextSlot = visible[visible.indexOf(slideIndex) + 1];
  const nextReady = nextSlot !== undefined && loaded.has(slotUrl(nextSlot) ?? "");
  useEffect(() => {
    if (!active || !currentReady) return;
    const at = visible.indexOf(slideIndex);
    for (const next of visible.slice(at + 1, at + 1 + PREFETCH_AHEAD)) {
      if (slotFailed(next)) continue;
      const photo = frames[next].photo;
      if (photo.paid) onPrefetch(photo.url);
    }
    // onPrefetch and slotFailed are recreated each render; these are the inputs that matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, currentReady, slideIndex, visibleKey, frames]);
  // An atomic automatic skip owns its destination until that slot intersects.
  // Late observer records for crossed slots must not restart failure recovery.
  const settlingAt = useRef<number | null>(null);
  // Sideways pages are photos. The review (best source first) stays on the story.
  const primary = story.slides[0] ?? null;
  const primaryQuote = primary ? quoteFor(story, primary) : null;
  // A story rebuilt after scrolling away reopens on the photo the viewer had reached.
  // Scroll only the photo strip: scrollIntoView would also scroll the vertical feed
  // and pull the viewer back to this story while it is still off-screen. A relative
  // move works whichever sign the browser gives scrollLeft in right-to-left strips.
  useEffect(() => {
    const root = framesRef.current;
    const target = root?.querySelector<HTMLElement>(`[data-slide="${slideIndex}"]`);
    if (!root || !target || slideIndex === 0) return;
    root.scrollLeft += target.getBoundingClientRect().left - root.getBoundingClientRect().left;
    // Only on mount: later slide changes come from the viewer's own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Which photo is in view, from intersection rather than scrollLeft: browsers
  // disagree on the sign of scrollLeft in right-to-left scrollers.
  useEffect(() => {
    const root = framesRef.current;
    if (!root || n < 2 || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting && visible.includes(Number((e.target as HTMLElement).dataset.slide))) {
            const index = Number((e.target as HTMLElement).dataset.slide);
            if (settlingAt.current !== null && settlingAt.current !== index) continue;
            settlingAt.current = null;
            onSlide(index, frames);
          }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll<HTMLElement>("[data-slide]").forEach((el) => { if (!el.hidden) io.observe(el); });
    return () => io.disconnect();
    // onSlide is recreated each render; the observed frames only change with the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, n, visibleKey]);
  // A tap moves by VISIBLE position (a hidden alias slot is never a stop). Taps never go
  // back to the previous place (a right-thumb tap on the back strip did exactly that): on
  // the first visible photo the back strip moves forward like any tap. Swiping down
  // returns to the previous place. Past the last visible photo a tap moves to the next one.
  const tap = (slot: number, dir: 1 | -1) => {
    if (ignoreTap()) return;
    const pos = visible.indexOf(slot);
    if (pos < 0) return;
    if (dir < 0 && pos > 0) go(visible[pos - 1]);
    else if (pos >= visible.length - 1) onNextStory();
    else go(visible[pos + 1]);
  };
  // Move only the photo strip: scrollIntoView could also scroll the vertical feed.
  const go = (i: number, instant = false) => {
    const root = framesRef.current;
    const direction = i >= slideIndex ? 1 : -1;
    const requested = Math.max(0, Math.min(n - 1, i));
    const targetIndex = visible.includes(requested) ? requested :
      (direction > 0 ? visible.find((j) => j > requested) : [...visible].reverse().find((j) => j < requested));
    if (targetIndex === undefined) return;
    const target = root?.querySelector<HTMLElement>(`[data-slide="${targetIndex}"]`);
    if (!root || !target) return;
    settlingAt.current = instant ? targetIndex : null;
    const delta = target.getBoundingClientRect().left - root.getBoundingClientRect().left;
    if (instant) {
      // Relative scrollBy is a directional scroll: scroll-snap-stop:always can
      // trap it at an intervening failed slot. Absolute endpoint navigation
      // targets the requested snap area, preserving ordinary gesture snapping.
      root.scrollTo?.({ left: root.scrollLeft + delta, behavior: "instant" as ScrollBehavior });
    } else {
      root.scrollBy?.({ left: delta, behavior: smooth ? "smooth" : "instant" as ScrollBehavior });
    }
  };
  // Next photo every few seconds while this place is in view, back to the first after the last.
  useEffect(() => {
    if (!autoplay || visible.length < 2 || allFailed) return;
    if (!currentFailed) {
      // Never rotate back onto a known failed slot. If only this working image
      // remains, hold it rather than animate a fake change over the same backdrop.
      const next = Array.from({ length: n - 1 }, (_, k) => (slideIndex + 1 + k) % n).find(
        (j) => visible.includes(j) && !slotFailed(j),
      );
      if (next === undefined) return;
      // A smooth jump across failed slots would make the observer report an
      // intermediate failed slot as current, whose recovery interrupts the jump.
      // Skip those slots atomically; keep ordinary adjacent/manual moves smooth.
      const crossesFailed = Array.from({ length: (next - slideIndex + n) % n }, (_, k) =>
        (slideIndex + 1 + k) % n).some((j) => visible.includes(j) && slotFailed(j));
      const t = setTimeout(() => go(next, crossesFailed), PHOTO_MS);
      return () => clearTimeout(t);
    }
    // A failed slot: skip ahead to the next free photo that has not failed (wrapping to
    // the place's own photo). Never move on into a paid photo after a failure: expired
    // Google references fail in chains, and each attempt is a paid request. A tap on
    // "next" still opens one deliberately.
    const next = Array.from({ length: n - 1 }, (_, k) => (slideIndex + 1 + k) % n).find(
      (j) => visible.includes(j) && !frames[j].photo.paid && !slotFailed(j),
    );
    if (next === undefined) return;
    const t = setTimeout(() => go(next, true), SKIP_FAILED_MS);
    return () => clearTimeout(t);
    // go only reads refs and n.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, slideIndex, n, currentFailed, allFailed, visibleKey, failed, failedImages]);

  return (
    <article className="stories-story" aria-label={r.name_hebrew} onPointerDown={() => { settlingAt.current = null; }}>
      {near && image ? (
        <img className="stories-bg" src={image} alt="" onLoad={() => imageLoaded(image)} onError={() => onImageError(image)} />
      ) : near ? (
        <div className="stories-bg empty fallback" aria-hidden="true">
          <UtensilsCrossed size={88} strokeWidth={1.1} />
        </div>
      ) : (
        <div className="stories-bg empty" aria-hidden="true" />
      )}
      <div className="stories-frames" ref={framesRef}>
        {frames.map((frame, i) => {
          // Keep a small decoded-image window. Only the active story gets a free
          // next image, after the current image loaded. Paid frames never preload.
          const own = frame.photo.url === image;
          const show =
            near && visible.includes(i) && !own && !failed.has(frame.photo.url) && !failedImages.has(frame.photo.url) && shouldLoadStoryFrame(
              visible.map((j) => frames[j]), visible.indexOf(i), visible.indexOf(slideIndex), active,
              loaded.has(slotUrl(slideIndex)), granted, nextReady,
            );
          return (
            <div
              key={storyPhotoKey(frame.photo.url)}
              className="stories-frame"
              data-slide={i}
              hidden={!visible.includes(i)}
              style={!visible.includes(i) ? { display: "none" } : undefined}
              role="group"
              aria-roledescription="תמונה"
              aria-label={`תמונה ${visible.indexOf(i) + 1} מתוך ${visible.length}`}
            >
              {show && (
                <img
                  className="stories-bg"
                  src={frame.photo.url}
                  alt=""
                  onLoad={() => imageLoaded(frame.photo.url)}
                  onError={() => setFailed((prev) => new Set(prev).add(frame.photo.url))}
                />
              )}
              <div className="stories-shade" />
              {/* Instagram-style: a tap goes to the next photo; only a narrow strip at the
                  right edge (the start side in Hebrew) goes back to the previous photo of the
                  same place. Past the last photo a tap moves to the next restaurant. */}
              <button className="stories-tap prev" onClick={() => tap(i, -1)} aria-label="התמונה הקודמת" />
              <button className="stories-tap next" onClick={() => tap(i, 1)} aria-label="התמונה הבאה" />
            </div>
          );
        })}
      </div>
      {primary && (
        <div className="stories-frame-text">
          {primaryQuote && (
            <p className="stories-quote">{primaryQuote.verified ? `״${primaryQuote.text}״` : primaryQuote.text}</p>
          )}
          <p className="stories-src">
            {primary.tasted && <span className="stories-tick">נטעם</span>}
            <span>
              {sourceLabel(primary)}
              {formatClock(primary.seconds) ? ` · ${formatClock(primary.seconds)}` : ""}
            </span>
          </p>
          <button className="stories-pill sun" onClick={() => onPlay(primary)}>
            <Play size={16} aria-hidden="true" /> נגן ברגע הזה
          </button>
          {story.slides.length > 1 && (
            <div className="stories-more">
              <button className="stories-chip" onClick={onReviews}>
                כל הסקירות ({story.slides.length})
              </button>
            </div>
          )}
        </div>
      )}
      {visible.length > 1 && (
        <div className="stories-dots" aria-hidden="true">
          {visible.map((i, pos) => (
            <i
              key={i === slideIndex && autoplay ? `run-${slideIndex}` : i}
              // Like Instagram: photos already passed keep a full bar.
              className={
                i === slideIndex ? (autoplay ? "on run" : "on") : pos < visible.indexOf(slideIndex) ? "seen" : ""
              }
            />
          ))}
        </div>
      )}
      <div className="stories-content">
        <h2 className="stories-name">{r.name_hebrew}</h2>
        <p className="stories-meta">
          {story.distanceKm !== null && <b>{formatDistance(story.distanceKm)}</b>}
          {[r.location?.city, r.cuisine_type]
            .filter(Boolean)
            .map((v, i) => (i === 0 && story.distanceKm === null ? v : ` · ${v}`))}
        </p>
        <div className="stories-actions">
          <button
            className={`stories-round ${saved ? "on" : ""}`}
            onClick={onSave}
            aria-pressed={saved}
            aria-label={`שמירה של ${r.name_hebrew}`}
          >
            <Heart size={20} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          </button>
          {c && (
            <a
              className="stories-round"
              href={`https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`ניווט אל ${r.name_hebrew}`}
            >
              <Navigation size={20} aria-hidden="true" />
            </a>
          )}
          <button className="stories-round" onClick={onShare} aria-label={`שיתוף של ${r.name_hebrew}`}>
            <Share2 size={20} aria-hidden="true" />
          </button>
          <Link className="stories-pill" href={`/restaurant/${encodeURIComponent(r.id!)}`}>
            לביקורת ↗
          </Link>
        </div>
      </div>
    </article>
  );
}

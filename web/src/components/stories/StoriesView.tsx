"use client";
/* eslint-disable @next/next/no-img-element -- Direct URLs and the existing photo proxy; no image optimizer. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart, MapPin, Navigation, Play, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
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
  youtubeEmbedUrl,
  youtubeMomentUrl,
  type Story,
  type StoryFrame,
  type StoryQuote,
  type StorySlide,
} from "@/lib/stories";
import "./stories.css";

const RADIUS_KM = 50;
// Stories are placed by distance, but only the ones around the one in view are
// built. The rest stay as empty full-height slots, so scrolling, snapping and
// the count keep working while the page holds a handful of stories, not all.
const MOUNT_BEHIND = 2;
const MOUNT_AHEAD = 4;
const PRESETS: [string, number, number][] = [
  ["תל אביב · דיזנגוף", 32.0809, 34.774],
  ["ירושלים · מחנה יהודה", 31.7852, 35.212],
  ["חיפה · המושבה הגרמנית", 32.8193, 34.9877],
  ["הרצליה", 32.1663, 34.8433],
  ["באר שבע", 31.252, 34.7915],
  ["נצרת", 32.7019, 35.2971],
];

type Item = { kind: "story"; story: Story } | { kind: "divider"; count: number };

export function StoriesView({ extraPhotoLimit }: { extraPhotoLimit: number }) {
  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [origin, setOrigin] = useState<{ coords: GeoCoords; fromDevice: boolean } | null>(null);
  const [source, setSource] = useState("");
  const [locError, setLocError] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [episodes, setEpisodes] = useState<Record<string, EpisodeDetail | null>>({});
  const [slideAt, setSlideAt] = useState<Record<string, number>>({});
  // Paid Google photos granted this visit: only ones the viewer moved to, up to the limit.
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [player, setPlayer] = useState<{ story: Story; slide: StorySlide } | null>(null);
  const [hint, setHint] = useState(false);
  const requested = useRef(new Set<string>());
  const feedRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { loading: locating, getCurrentPosition } = useGeolocation({ enableHighAccuracy: false });

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

  const feed = useMemo(
    () => (origin && restaurants ? buildStories(restaurants, origin.coords, { radiusKm: RADIUS_KM, source }) : null),
    [origin, restaurants, source],
  );

  const items: Item[] = useMemo(() => {
    if (!feed) return [];
    const keep = (s: Story) => !removed.has(s.restaurant.id!);
    const near = feed.near.filter(keep);
    const far = feed.far.filter(keep);
    return [
      ...near.map((story) => ({ kind: "story" as const, story })),
      ...(far.length ? [{ kind: "divider" as const, count: far.length }] : []),
      ...far.map((story) => ({ kind: "story" as const, story })),
    ];
  }, [feed, removed]);
  const storyCount = items.filter((i) => i.kind === "story").length;

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

  const begin = (coords: GeoCoords, fromDevice: boolean) => {
    setOrigin({ coords, fromDevice });
    setCurrent(0);
    setRemoved(new Set());
    setBroken(new Set());
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

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 2800);
    return () => clearTimeout(t);
  }, [hint]);

  const onImageError = (id: string, index: number) => {
    // Photo-less cards read as a feed, not stories: drop them before they are reached.
    if (index > current) setRemoved((prev) => new Set(prev).add(id));
    else setBroken((prev) => new Set(prev).add(id));
  };

  const reach = (id: string, i: number, frames: StoryFrame[]) => {
    setSlideAt((prev) => (prev[id] === i ? prev : { ...prev, [id]: i }));
    setGranted((prev) => {
      let next = prev;
      for (const f of frames.slice(0, i + 1)) {
        if (!f.photo.paid || next.has(f.photo.url)) continue;
        if (next.size >= extraPhotoLimit) break;
        if (next === prev) next = new Set(prev);
        next.add(f.photo.url);
      }
      return next;
    });
  };

  const goStory = useCallback(
    (delta: number) => {
      const next = Math.max(0, Math.min(items.length - 1, current + delta));
      feedRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ behavior: "smooth" });
    },
    [items.length, current],
  );

  const openPlayer = (story: Story, slide: StorySlide) => {
    setPlayer({ story, slide });
    dialogRef.current?.showModal();
  };
  const closePlayer = () => {
    dialogRef.current?.close();
    setPlayer(null);
  };

  useEffect(() => {
    if (!origin) return;
    const onKey = (e: KeyboardEvent) => {
      if (player) return;
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
  }, [origin, player, goStory]);

  if (!origin) {
    return (
      <main className="stories-app">
        <section className="stories-start">
          <Link href="/" className="stories-logo">
            Where2Eat
          </Link>
          <h1>
            איפה אוכלים <span className="stories-hl">ליד?</span>
          </h1>
          <p className="stories-lead">
            ביקורות מהפודקאסטים, מהקרוב לרחוק. החליקו למעלה למסעדה הבאה, והצידה לאזכור הבא שלה.
          </p>
          <div className="stories-card">
            <button className="stories-pill teal big" onClick={locate} disabled={locating || !restaurants}>
              <MapPin size={18} aria-hidden="true" /> {locating ? "מאתר…" : "לפי המיקום שלי"}
            </button>
            {locError && <p className="stories-err">{locError}</p>}
            <p className="stories-note">המיקום נשאר בדפדפן: המיון נעשה כאן ושום דבר לא נשלח לשרת.</p>
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

  const storyPos = items.slice(0, current + 1).filter((i) => i.kind === "story").length;
  const currentItem = items[current];

  return (
    <main className="stories-app">
      <div className="stories-top">
        <button className="stories-pill" onClick={() => setOrigin(null)} aria-label="חזרה לנקודת ההתחלה">
          <MapPin size={16} aria-hidden="true" />
        </button>
        <span className="stories-count" aria-live="polite">
          {currentItem?.kind === "story" ? `${storyPos}/${storyCount}` : `${storyCount} מסעדות`}
        </span>
        <Link href="/" className="stories-pill" aria-label="יציאה">
          <X size={16} aria-hidden="true" />
        </Link>
      </div>
      {hint && <div className="stories-hint">↕ מסעדה הבאה · ↔ אזכור הבא</div>}
      <div className="stories-feed" ref={feedRef} tabIndex={0} aria-label="סטוריז מסעדות">
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
              broken={broken.has(item.story.restaurant.id!)}
              saved={isSaved(item.story.restaurant, favorites)}
              slideIndex={slideAt[item.story.restaurant.id!] ?? 0}
              extraPhotos={extraPhotoLimit > 0}
              granted={granted}
              quoteFor={quoteFor}
              onSlide={(i, frames) => reach(item.story.restaurant.id!, i, frames)}
              onImageError={() => onImageError(item.story.restaurant.id!, index)}
              onPlay={(slide) => openPlayer(item.story, slide)}
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
  story,
  near,
  broken,
  saved,
  slideIndex,
  extraPhotos,
  granted,
  quoteFor,
  onSlide,
  onImageError,
  onPlay,
  onSave,
}: {
  story: Story;
  near: boolean;
  broken: boolean;
  saved: boolean;
  slideIndex: number;
  extraPhotos: boolean;
  granted: Set<string>;
  quoteFor: (story: Story, slide: StorySlide) => StoryQuote | null;
  onSlide: (i: number, frames: StoryFrame[]) => void;
  onImageError: () => void;
  onPlay: (slide: StorySlide) => void;
  onSave: () => void;
}) {
  const r = story.restaurant;
  const c = getCoordinates(r.location);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  // A photo that fails to load (expired Google references are common) is skipped,
  // unless it carries a creator quote: then the quote stays, over the story's photo.
  const frames = useMemo(
    () => storyFrames(story, { extraPhotos }).filter((f) => f.mention || !failed.has(f.photo.url)),
    [story, extraPhotos, failed],
  );
  const n = frames.length;
  const framesRef = useRef<HTMLDivElement>(null);
  // A story rebuilt after scrolling away reopens on the photo the viewer had reached.
  useEffect(() => {
    if (slideIndex > 0)
      framesRef.current
        ?.querySelector(`[data-slide="${slideIndex}"]`)
        ?.scrollIntoView?.({ block: "nearest", inline: "start" });
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
          if (e.isIntersecting) onSlide(Number((e.target as HTMLElement).dataset.slide), frames);
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-slide]").forEach((el) => io.observe(el));
    return () => io.disconnect();
    // onSlide is recreated each render; the observed frames only change with the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, n]);
  const go = (i: number) =>
    framesRef.current
      ?.querySelector(`[data-slide="${Math.max(0, Math.min(n - 1, i))}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });

  return (
    <article className="stories-story" aria-label={r.name_hebrew}>
      {near && !broken ? (
        <img className="stories-bg" src={story.image} alt="" onError={onImageError} />
      ) : (
        <div className="stories-bg empty" aria-hidden="true" />
      )}
      <div className="stories-frames" ref={framesRef}>
        {frames.map((frame, i) => {
          const m = frame.mention;
          const q = m ? quoteFor(story, m) : null;
          const clock = m ? formatClock(m.seconds) : null;
          // The story's own photo is already underneath. Other photos load only
          // once reached; paid ones only when granted within the visit limit.
          const own = frame.photo.url === story.image;
          const show =
            near && !own && !failed.has(frame.photo.url) && (frame.photo.paid ? granted.has(frame.photo.url) : i <= slideIndex + 1);
          return (
            <div
              key={i}
              className="stories-frame"
              data-slide={i}
              role="group"
              aria-roledescription="תמונה"
              aria-label={`תמונה ${i + 1} מתוך ${n}`}
            >
              {show && (
                <img
                  className="stories-bg"
                  src={frame.photo.url}
                  alt=""
                  onError={() => setFailed((prev) => new Set(prev).add(frame.photo.url))}
                />
              )}
              <div className="stories-shade" />
              {n > 1 && (
                <>
                  <button
                    className="stories-tap prev"
                    onClick={() => go(i - 1)}
                    aria-label="התמונה הקודמת"
                    disabled={i === 0}
                  >
                    <ChevronRight size={22} aria-hidden="true" />
                  </button>
                  <button
                    className="stories-tap next"
                    onClick={() => go(i + 1)}
                    aria-label="התמונה הבאה"
                    disabled={i === n - 1}
                  >
                    <ChevronLeft size={22} aria-hidden="true" />
                  </button>
                </>
              )}
              {m && (
                <div className="stories-frame-text">
                  {q && <p className="stories-quote">{q.verified ? `״${q.text}״` : q.text}</p>}
                  <p className="stories-src">
                    {m.tasted && <span className="stories-tick">נטעם</span>}
                    <span>
                      {sourceLabel(m)}
                      {clock ? ` · ${clock}` : ""}
                    </span>
                  </p>
                  <button className="stories-pill sun" onClick={() => onPlay(m)}>
                    <Play size={16} aria-hidden="true" /> נגן ברגע הזה
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="stories-dots" aria-hidden="true">
          {frames.map((_, i) => (
            <i key={i} className={i === slideIndex ? "on" : ""} />
          ))}
        </div>
      )}
      <div className="stories-content">
        <h2 className="stories-name">{r.name_hebrew}</h2>
        <p className="stories-meta">
          <b>{formatDistance(story.distanceKm)}</b>
          {[r.location?.city, r.cuisine_type].filter(Boolean).map((v) => ` · ${v}`)}
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
          <Link className="stories-pill" href={`/restaurant/${encodeURIComponent(r.id!)}`}>
            לביקורת ↗
          </Link>
        </div>
      </div>
    </article>
  );
}

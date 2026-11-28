"use client";
/* eslint-disable @next/next/no-img-element -- Direct URLs from our storage or the place's own image; no image optimizer. */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Restaurant } from "@/types/restaurant";
import { buildEpisodeCircles, markEpisodeSeen, readSeenEpisodes, saveHomePosition, takeHomePosition } from "@/lib/stories";

const subscribeNothing = () => () => {};
const seenSnapshot = () => [...readSeenEpisodes(window.localStorage)].join("|");

/**
 * Instagram-style row at the top of the home page: one circle per episode, newest
 * first. A tap opens that episode's restaurants as stories. A ring marks episodes
 * not opened yet in this browser.
 */
export function EpisodeCircles({ restaurants }: { restaurants: Restaurant[] }) {
  const circles = useMemo(() => buildEpisodeCircles(restaurants), [restaurants]);
  // Read from this browser after hydration; the server render has nothing seen.
  const seenRaw = useSyncExternalStore(subscribeNothing, () => seenSnapshot(), () => "");
  const seen = useMemo(() => new Set<string>(seenRaw ? seenRaw.split("|") : []), [seenRaw]);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const posRef = useRef<{ y: number; x: number } | null | undefined>(undefined);
  const hasCircles = circles.length > 0;
  // Coming back from a story: put the page and the row where they were.
  useEffect(() => {
    if (!hasCircles) return;
    // Kept in a ref: development strict mode runs this effect twice, and the saved
    // position is removed on first read.
    if (posRef.current === undefined) posRef.current = takeHomePosition(window.sessionStorage);
    const pos = posRef.current;
    if (!pos) return;
    if (listRef.current) listRef.current.scrollLeft = pos.x;
    // The router and the feed's own layout can still move the page just after mount, so
    // put it back a few times, and stop as soon as the viewer scrolls on their own.
    let touched = false;
    const onUser = () => { touched = true; };
    window.addEventListener("wheel", onUser, { passive: true });
    window.addEventListener("touchstart", onUser, { passive: true });
    const timers = [0, 80, 250, 600, 1200, 2000].map((ms) => window.setTimeout(() => { if (!touched) window.scrollTo(0, pos.y); }, ms));
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("wheel", onUser);
      window.removeEventListener("touchstart", onUser);
    };
  }, [hasCircles]);
  if (!circles.length) return null;
  return (
    <nav className="episode-circles" aria-label="סטוריז לפי פרק">
      <ul ref={listRef}>
        {circles.map((c) => {
          const isSeen = seen.has(c.videoId);
          const src = [c.image, ...c.alternates].find((u) => !failed.has(u));
          return (
            <li key={c.videoId}>
              <Link
                href={`/stories?episode=${encodeURIComponent(c.videoId)}`}
                className={`episode-circle${isSeen ? " seen" : ""}`}
                onClick={() => {
                  markEpisodeSeen(window.localStorage, c.videoId);
                  saveHomePosition(window.sessionStorage, { y: window.scrollY, x: listRef.current?.scrollLeft ?? 0 });
                }}
                aria-label={`${c.title}, ${c.count === 1 ? "מסעדה אחת" : `${c.count} מסעדות`}${isSeen ? "" : ", חדש"}`}
              >
                <span className="episode-circle-ring">
                  {!src ? (
                    <span className="episode-circle-fallback" aria-hidden="true">🍽</span>
                  ) : (
                    <img
                      key={src}
                      src={src}
                      alt=""
                      width={64}
                      height={64}
                      loading="lazy"
                      onError={() => setFailed((p) => new Set(p).add(src))}
                    />
                  )}
                </span>
                <span className="episode-circle-title">{c.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

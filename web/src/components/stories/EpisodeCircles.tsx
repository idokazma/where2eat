"use client";
/* eslint-disable @next/next/no-img-element -- Direct URLs from our storage or the place's own image; no image optimizer. */

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Restaurant } from "@/types/restaurant";
import { buildEpisodeCircles, markEpisodeSeen, readSeenEpisodes } from "@/lib/stories";

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
  if (!circles.length) return null;
  return (
    <nav className="episode-circles" aria-label="סטוריז לפי פרק">
      <ul>
        {circles.map((c) => {
          const isSeen = seen.has(c.videoId);
          const src = [c.image, ...c.alternates].find((u) => !failed.has(u));
          return (
            <li key={c.videoId}>
              <Link
                href={`/stories?episode=${encodeURIComponent(c.videoId)}`}
                className={`episode-circle${isSeen ? " seen" : ""}`}
                onClick={() => markEpisodeSeen(window.localStorage, c.videoId)}
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

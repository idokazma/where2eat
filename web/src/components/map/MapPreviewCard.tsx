"use client";

/* eslint-disable @next/next/no-img-element -- Stored direct URLs only, no image optimizer or paid photo proxy. */

import { useState } from "react";
import Link from "next/link";
import {
  Heart,
  X,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  Radio,
} from "lucide-react";
import type { Restaurant } from "@/types/restaurant";
import { getMapPreviewImage } from "@/lib/map-discovery";

interface Props {
  restaurant: Restaurant;
  saved: boolean;
  onSave: () => void;
  onDismiss: () => void;
  onPrevious: () => void;
  onNext: () => void;
  count: number;
  position: number;
  distance?: string;
}

export function MapPreviewCard({
  restaurant: r,
  saved,
  onSave,
  onDismiss,
  onPrevious,
  onNext,
  count,
  position,
  distance,
}: Props) {
  const image = getMapPreviewImage(r);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const sameEpisode =
    r.mentions?.filter((m) => m.video_id === r.episode_info?.video_id) || [];
  const mention =
    sameEpisode.find(
      (m) =>
        (m.timestamp_seconds ?? null) === (r.mention_timestamp_seconds ?? null),
    ) || (sameEpisode.length === 1 ? sameEpisode[0] : undefined);
  const speaker = mention?.speaker;
  const source = r.episode_info?.channel_name || mention?.channel_name;
  const quote = r.engaging_quote || r.host_quotes?.[0];
  const navId = r.google_places?.place_id || r.id;
  return (
    <section
      className="discovery-preview"
      aria-label={`פרטי ${r.name_hebrew}`}
      dir="rtl"
    >
      <div className="discovery-preview-handle" />
      <div className="discovery-card-tools">
        <span className="discovery-pager">
          <button
            aria-label="המסעדה הקודמת"
            onClick={onPrevious}
            disabled={count < 2}
          >
            <ChevronRight size={18} />
          </button>
          <span aria-live="polite">
            {position + 1}/{count}
          </span>
          <button
            aria-label="המסעדה הבאה"
            onClick={onNext}
            disabled={count < 2}
          >
            <ChevronLeft size={18} />
          </button>
        </span>
        <button onClick={onDismiss} aria-label="סגירת פרטי המסעדה">
          <X size={18} />
        </button>
      </div>
      <div className="discovery-card-main">
        <div className="discovery-photo">
          {/* Existing image URL, no new optimization service or image charge. */}
          {image && failedImage !== image ? (
            <img
              src={image}
              alt={r.name_hebrew}
              onError={() => setFailedImage(image)}
            />
          ) : (
            <div>
              <UtensilsCrossed size={30} />
              <small>אין תמונה זמינה</small>
            </div>
          )}
        </div>
        <div className="discovery-card-copy">
          <h2>{r.name_hebrew || r.name_english}</h2>
          <p className="discovery-meta">
            {[r.cuisine_type, r.location?.city, distance]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {quote && <p className="discovery-quote">&quot;{quote}&quot;</p>}
          {!quote && r.host_comments && (
            <p className="discovery-quote">{r.host_comments}</p>
          )}
        </div>
      </div>
      <div className="discovery-card-footer">
        <div className="discovery-credit">
          {/* No verified person portrait exists in the current API. A source icon
            must not be presented as a photograph of the reviewer. */}
          <span
            className="discovery-avatar"
            aria-label={speaker ? "סמל ממליץ, לא תמונה" : "סמל מקור"}
          >
            {speaker ? speaker.trim().slice(0, 1) : <Radio size={20} />}
          </span>
          <div>
            {speaker && <b>{speaker}</b>}
            <span>{source || "מקור לא צוין"}</span>
            {r.episode_info?.title && <small>{r.episode_info.title}</small>}
          </div>
        </div>
        <button
          className={`discovery-save ${saved ? "is-saved" : ""}`}
          onClick={onSave}
          aria-label={saved ? "הסרה מהשמורים" : "שמירת המסעדה"}
          aria-pressed={saved}
        >
          <Heart size={21} fill={saved ? "currentColor" : "none"} />
        </button>
        {navId && (
          <Link
            className="discovery-review"
            href={`/restaurant/${encodeURIComponent(navId)}`}
          >
            לביקורת ↗
          </Link>
        )}
      </div>
    </section>
  );
}

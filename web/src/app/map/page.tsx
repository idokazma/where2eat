"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Loader2,
  List,
} from "lucide-react";
import { PageLayout } from "@/components/layout";
import { endpoints } from "@/lib/config";
import { useFavorites } from "@/contexts/favorites-context";
import { useGeolocation } from "@/hooks/useGeolocation";
import { isListed } from "@/lib/restaurant-visibility";
import type { Restaurant } from "@/types/restaurant";
import { getCoordinates } from "@/types/restaurant";
import {
  favoriteKey,
  filterMapRestaurants,
  restaurantSources,
  isSaved,
  mapId,
} from "@/lib/map-discovery";
import { formatDistance, haversineDistance } from "@/lib/geo-utils";
import { MapPreviewCard } from "@/components/map/MapPreviewCard";
import "./map.css";

const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="discovery-loading">
      <Loader2 className="animate-spin" />
      <span>טוען מפה…</span>
    </div>
  ),
});

export default function MapPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"filters" | "list">("filters");
  const [clusterItems, setClusterItems] = useState<Restaurant[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const { favorites, setAllRestaurants, addFavorite, removeFavorite } =
    useFavorites();
  const {
    coords,
    accuracy,
    loading: locating,
    error: locationError,
    getCurrentPosition,
  } = useGeolocation();

  useEffect(() => {
    const controller = new AbortController();
    // The same full list as the home page, newest first.
    fetch(
      endpoints.restaurants.search({
        page: "1",
        limit: "500",
        sort_by: "published_at",
        sort_direction: "desc",
      }),
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data) => {
        setRestaurants(data.restaurants || []);
        setAllRestaurants(data.restaurants || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError("שגיאה בטעינת המסעדות. נסו לרענן את העמוד.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [setAllRestaurants]);

  const mappable = useMemo(
    () => restaurants.filter((r) => isListed(r) && getCoordinates(r.location)),
    [restaurants],
  );
  const displayed = useMemo(() => {
    const filtered = filterMapRestaurants(
      mappable,
      query,
      source,
      cuisine,
      savedOnly,
      favorites,
    );
    if (!coords) return filtered;
    const distanceTo = (r: Restaurant) => {
      const c = getCoordinates(r.location)!;
      return haversineDistance(coords, { lat: c.latitude, lng: c.longitude });
    };
    return filtered.sort((a, b) => distanceTo(a) - distanceTo(b));
  }, [mappable, query, source, cuisine, savedOnly, favorites, coords]);
  const favoriteIds = useMemo(() => new Set(favorites), [favorites]);
  const sources = useMemo(
    () =>
      [
        ...new Set(
          mappable.flatMap(restaurantSources),
        ),
      ].sort(),
    [mappable],
  );
  const cuisines = useMemo(
    () =>
      [
        ...new Set(
          mappable.map((r) => r.cuisine_type).filter((s): s is string => !!s),
        ),
      ].sort(),
    [mappable],
  );
  const selectedIndex = displayed.findIndex((r) => mapId(r) === selectedId);
  const selected = displayed[selectedIndex];
  const activeFilters =
    Number(!!source) + Number(!!cuisine) + Number(savedOnly);
  const openPanel = (
    next: "filters" | "list",
    items: Restaurant[] | null = null,
  ) => {
    setPanel(next);
    setClusterItems(items);
    dialog.current?.showModal();
  };
  const reset = () => {
    setQuery("");
    setSource("");
    setCuisine("");
    setSavedOnly(false);
  };
  const move = (delta: number) =>
    setSelectedId(
      mapId(
        displayed[
          (selectedIndex + delta + displayed.length) % displayed.length
        ],
      ),
    );
  const save = (r: Restaurant) => {
    if (isSaved(r, favorites)) {
      removeFavorite(favoriteKey(r));
      const oldKey = r.google_places?.place_id || r.name_hebrew;
      if (oldKey !== favoriteKey(r)) removeFavorite(oldKey);
    } else addFavorite(favoriteKey(r));
  };
  const point = selected && getCoordinates(selected.location);
  const distance =
    point && coords
      ? formatDistance(
          haversineDistance(coords, {
            lat: point.latitude,
            lng: point.longitude,
          }),
        )
      : undefined;

  return (
    <PageLayout showHeader={false} showBottomNav className="discovery-layout">
      <div
        className={`discovery-shell ${selected ? "has-preview" : ""}`}
        dir="rtl"
      >
        <h1 className="sr-only">מפת המסעדות</h1>
        {loading ? (
          <div className="discovery-loading" role="status">
            <Loader2 className="animate-spin" />
            <span>טוען מסעדות…</span>
          </div>
        ) : error ? (
          <div className="discovery-loading" role="alert">
            <MapPin />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <MapView
              restaurants={displayed}
              favoriteIds={favoriteIds}
              userCoords={coords}
              userAccuracy={accuracy}
              locationLoading={locating}
              onLocateMe={() => {
                getCurrentPosition().catch(() => {});
              }}
              selectedRestaurantId={selected ? mapId(selected) : null}
              onMarkerClick={setSelectedId}
              onDismiss={() => setSelectedId(null)}
              onClusterSelect={(items) => openPanel("list", items)}
            />
            <div className="discovery-top">
              <div className="discovery-search-row">
                <label className="discovery-search">
                  <Search size={22} />
                  <input
                    aria-label="חיפוש מסעדה או מטבח"
                    placeholder="חיפוש מסעדה או מטבח"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="ניקוי חיפוש"
                      onClick={() => setQuery("")}
                    >
                      <X size={17} />
                    </button>
                  )}
                </label>
                <button
                  className="discovery-filter-button"
                  aria-label="סינון מסעדות"
                  onClick={() => openPanel("filters")}
                >
                  <SlidersHorizontal size={22} />
                  {activeFilters > 0 && <b>{activeFilters}</b>}
                </button>
              </div>
              <p className="discovery-scope" role="status">
                {displayed.length} על המפה
                {activeFilters > 0 || query ? " · מסונן" : ""}
              </p>
            </div>
            {locationError && (
              <p className="discovery-location-error" role="alert">
                {locationError}
              </p>
            )}
            {!displayed.length && (
              <div className="discovery-empty">
                <MapPin />
                <h2>
                  {mappable.length
                    ? "אין תוצאות לסינון הזה"
                    : "אין מסעדות עם נתוני מיקום"}
                </h2>
                {mappable.length > 0 && (
                  <button onClick={reset}>ניקוי הסינון</button>
                )}
              </div>
            )}
            {selected ? (
              <MapPreviewCard
                key={mapId(selected)}
                restaurant={selected}
                saved={isSaved(selected, favorites)}
                onSave={() => save(selected)}
                onDismiss={() => setSelectedId(null)}
                onPrevious={() => move(-1)}
                onNext={() => move(1)}
                count={displayed.length}
                position={selectedIndex}
                distance={distance}
              />
            ) : (
              displayed.length > 0 && (
                <button
                  className="discovery-list-button"
                  onClick={() => openPanel("list")}
                >
                  <List size={18} /> רשימת המסעדות ({displayed.length})
                </button>
              )
            )}
          </>
        )}
        <dialog
          ref={dialog}
          className="discovery-dialog"
          aria-labelledby="discovery-panel-title"
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current.close();
          }}
        >
          <div className="discovery-dialog-content" dir="rtl">
            <header>
              <h2 id="discovery-panel-title">
                {panel === "filters"
                  ? "מה מתחשק לך?"
                  : clusterItems
                    ? "מסעדות בנקודה הזו"
                    : "המסעדות במפה"}
              </h2>
              <button
                aria-label="סגירה"
                onClick={() => dialog.current?.close()}
              >
                <X />
              </button>
            </header>
            {panel === "filters" ? (
              <>
                <label className="discovery-field">
                  מקור
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="">כל המקורות</option>
                    {sources.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="discovery-field">
                  מטבח
                  <select
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                  >
                    <option value="">כל המטבחים</option>
                    {cuisines.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="discovery-saved-toggle">
                  <span>רק מסעדות ששמרתי</span>
                  <input
                    type="checkbox"
                    checked={savedOnly}
                    onChange={(e) => setSavedOnly(e.target.checked)}
                  />
                </label>
                <div className="discovery-dialog-actions">
                  <button onClick={reset}>ניקוי הכל</button>
                  <button
                    className="discovery-primary"
                    onClick={() => dialog.current?.close()}
                  >
                    הצגת {displayed.length} מסעדות
                  </button>
                </div>
              </>
            ) : (
              <ul className="discovery-results">
                {(clusterItems || displayed).map((r) => (
                  <li key={mapId(r)}>
                    <button
                      onClick={() => {
                        setSelectedId(mapId(r));
                        dialog.current?.close();
                      }}
                    >
                      <b>{r.name_hebrew}</b>
                      <span>
                        {[
                          r.cuisine_type,
                          r.location?.city,
                          r.episode_info?.channel_name,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </dialog>
      </div>
    </PageLayout>
  );
}

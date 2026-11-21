"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Restaurant } from "@/types/restaurant";
import { getCoordinates } from "@/types/restaurant";
import { UserLocationMarker } from "./UserLocationMarker";
import { groupMapPoints, mapId } from "@/lib/map-discovery";
import { haversineDistance, type GeoCoords } from "@/lib/geo-utils";

export type MapRestaurant = Restaurant;

interface MapViewProps {
  restaurants: Restaurant[];
  favoriteIds?: Set<string>;
  userCoords?: GeoCoords | null;
  userAccuracy?: number | null;
  selectedRestaurantId?: string | null;
  onMarkerClick?: (id: string) => void;
  onDismiss?: () => void;
  onClusterSelect?: (restaurants: Restaurant[]) => void;
  locationLoading?: boolean;
  onLocateMe?: () => void;
}

function DiscoveryLayers({
  restaurants,
  favoriteIds,
  userCoords,
  userAccuracy,
  selectedRestaurantId,
  onMarkerClick,
  onDismiss,
  onClusterSelect,
}: MapViewProps) {
  const [, setRevision] = useState(0);
  const locatedAt = useRef<GeoCoords | null>(null);
  const map = useMapEvents({
    zoomend: () => setRevision((n) => n + 1),
    moveend: () => setRevision((n) => n + 1),
    click: () => onDismiss?.(),
  });
  // Recompute screen-space groups after map movement, not on every pointer move.
  const groups = groupMapPoints(
    restaurants,
    (lat, lng) => map.project([lat, lng], map.getZoom()),
    selectedRestaurantId,
  );

  useEffect(() => {
    if (!userCoords || locatedAt.current === userCoords) return;
    locatedAt.current = userCoords;
    const nearest = restaurants
      .map((r) => getCoordinates(r.location))
      .filter((c): c is { latitude: number; longitude: number } => c !== null)
      .sort(
        (a, b) =>
          haversineDistance(userCoords, { lat: a.latitude, lng: a.longitude }) -
          haversineDistance(userCoords, { lat: b.latitude, lng: b.longitude }),
      )
      .slice(0, 10);
    if (!nearest.length) {
      map.flyTo([userCoords.lat, userCoords.lng], 14);
      return;
    }
    map.fitBounds(
      L.latLngBounds([
        [userCoords.lat, userCoords.lng],
        ...nearest.map((c) => [c.latitude, c.longitude] as [number, number]),
      ]),
      { paddingTopLeft: [55, 120], paddingBottomRight: [55, 180], maxZoom: 16 },
    );
  }, [userCoords, restaurants, map]);

  useEffect(() => {
    const r = restaurants.find((r) => mapId(r) === selectedRestaurantId);
    const c = r && getCoordinates(r.location);
    if (!c) return;
    // Keep the pin in the exposed area above the preview card.
    const point = map.project([c.latitude, c.longitude], map.getZoom());
    map.panTo(map.unproject(point.add([0, 100]), map.getZoom()), {
      animate: true,
    });
  }, [selectedRestaurantId, restaurants, map]);

  return (
    <>
      {userCoords && (
        <UserLocationMarker coords={userCoords} accuracy={userAccuracy} />
      )}
      {groups.map((group) => {
        const restaurant = group.items[0];
        const id = mapId(restaurant);
        const cluster = group.items.length > 1;
        const selected = id === selectedRestaurantId;
        const saved =
          favoriteIds?.has(
            restaurant.id ||
              restaurant.google_places?.place_id ||
              restaurant.name_hebrew,
          ) ||
          favoriteIds?.has(
            restaurant.google_places?.place_id || restaurant.name_hebrew,
          );
        const size = cluster ? 42 : 28;
        const icon = L.divIcon({
          html: `<span class="discovery-dot ${cluster ? "discovery-cluster" : ""} ${selected ? "discovery-selected" : ""} ${saved && !cluster ? "discovery-saved" : ""}">${cluster ? group.items.length : ""}</span>`,
          className: "discovery-marker",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        return (
          <Marker
            key={group.items.map(mapId).join("|")}
            position={[group.lat, group.lng]}
            icon={icon}
            title={
              cluster
                ? `${group.items.length} מסעדות, לחצו להתקרבות`
                : restaurant.name_hebrew
            }
            alt={
              cluster ? `${group.items.length} מסעדות` : restaurant.name_hebrew
            }
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{
              click: () => {
                if (!cluster) {
                  onMarkerClick?.(id);
                  return;
                }
                if (map.getZoom() >= map.getMaxZoom()) {
                  onClusterSelect?.(group.items);
                  return;
                }
                map.fitBounds(
                  L.latLngBounds(
                    group.items.map((r) => {
                      const c = getCoordinates(r.location)!;
                      return [c.latitude, c.longitude] as [number, number];
                    }),
                  ),
                  {
                    paddingTopLeft: [55, 110],
                    paddingBottomRight: [55, 110],
                    maxZoom: Math.min(map.getZoom() + 3, map.getMaxZoom()),
                  },
                );
              },
            }}
          >
            {!cluster && (selected || map.getZoom() >= 16) && (
              <Tooltip
                permanent
                direction="bottom"
                className="discovery-label"
                offset={[0, 14]}
              >
                {restaurant.name_hebrew}
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </>
  );
}

function ZoomControls({ onLocateMe, locationLoading }: MapViewProps) {
  const map = useMap();
  return (
    <div className="discovery-map-controls">
      <button
        aria-label="המיקום שלי"
        disabled={locationLoading}
        onClick={onLocateMe}
      >
        {locationLoading ? "…" : "◎"}
      </button>
      <div>
        <button aria-label="התקרבות" onClick={() => map.zoomIn()}>
          +
        </button>
        <button aria-label="התרחקות" onClick={() => map.zoomOut()}>
          −
        </button>
      </div>
    </div>
  );
}

export default function MapView(props: MapViewProps) {
  return (
    <MapContainer
      center={[32.0853, 34.7818]}
      zoom={13}
      className="w-full h-full discovery-map"
      zoomControl={false}
      scrollWheelZoom
    >
      {/* Keep the existing OSM provider and visible attribution. No new tile service. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <DiscoveryLayers {...props} />
      <ZoomControls {...props} />
    </MapContainer>
  );
}

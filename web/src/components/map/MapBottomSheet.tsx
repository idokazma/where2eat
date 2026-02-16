'use client';

import { useRef, useCallback, useEffect, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { List, useListRef } from 'react-window';
import type { CSSProperties } from 'react';
import { RestaurantListItem } from './RestaurantListItem';
import { WithDistance } from '@/lib/geo-utils';
import { triggerHaptic } from '@/lib/haptics';
import { ChevronUp } from 'lucide-react';

// Snap positions
const SNAP_COLLAPSED = 80; // px from bottom
const SNAP_HALF_RATIO = 0.4;
const SNAP_FULL_RATIO = 0.85;
const ITEM_HEIGHT = 72;

interface MapRestaurant {
  id?: string;
  name_hebrew: string;
  cuisine_type?: string | null;
  location?: {
    city?: string | null;
    [key: string]: unknown;
  };
  rating?: {
    google_rating?: number;
    total_reviews?: number;
  };
  google_places?: {
    place_id?: string;
    google_name?: string;
  };
  host_opinion?: string | null;
  episode_info?: { published_at?: string };
}

interface MapBottomSheetProps {
  restaurants: WithDistance<MapRestaurant>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  favoriteIds?: Set<string>;
  heatColors?: Map<string, string>;
}

export interface MapBottomSheetHandle {
  scrollToId: (id: string) => void;
  expandHalf: () => void;
}

function getRestaurantId(r: MapRestaurant): string {
  return r.google_places?.place_id || r.id || r.name_hebrew;
}

interface RowExtraProps {
  restaurants: WithDistance<MapRestaurant>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  favoriteIds?: Set<string>;
  heatColors?: Map<string, string>;
}

function RowRenderer({
  index,
  style,
  restaurants,
  selectedId,
  onSelect,
  favoriteIds,
  heatColors,
}: RowExtraProps & {
  index: number;
  style: CSSProperties;
  ariaAttributes: Record<string, unknown>;
}) {
  const entry = restaurants[index];
  if (!entry) return <div style={style} />;
  const r = entry.item;
  const id = getRestaurantId(r);

  return (
    <div style={style}>
      <RestaurantListItem
        name={r.google_places?.google_name || r.name_hebrew}
        cuisineType={r.cuisine_type}
        city={r.location?.city as string | undefined}
        googleRating={r.rating?.google_rating}
        totalReviews={r.rating?.total_reviews}
        distance={entry.distance}
        heatColor={heatColors?.get(id)}
        isFavorite={favoriteIds?.has(r.google_places?.place_id || r.name_hebrew)}
        isHighlighted={selectedId === id}
        onClick={() => onSelect(id)}
      />
    </div>
  );
}

export const MapBottomSheet = forwardRef<MapBottomSheetHandle, MapBottomSheetProps>(
  function MapBottomSheet({ restaurants, selectedId, onSelect, favoriteIds, heatColors }, ref) {
    const listRef = useListRef(null);
    const scrollOffsetRef = useRef(0);
    const lastFocusedIdRef = useRef<string | null>(null);
    const [viewportHeight, setViewportHeight] = useState(
      typeof window !== 'undefined' ? window.innerHeight : 800
    );

    const snapHalf = viewportHeight * SNAP_HALF_RATIO;
    const snapFull = viewportHeight * SNAP_FULL_RATIO;

    const sheetHeight = useMotionValue(SNAP_COLLAPSED);

    const [snapState, setSnapState] = useState<'collapsed' | 'half' | 'full'>('collapsed');

    useEffect(() => {
      const onResize = () => setViewportHeight(window.innerHeight);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);

    const snapTo = useCallback(
      (target: number) => {
        animate(sheetHeight, target, {
          type: 'spring',
          stiffness: 400,
          damping: 35,
        });
        if (target <= SNAP_COLLAPSED + 10) setSnapState('collapsed');
        else if (target < (snapHalf + snapFull) / 2) setSnapState('half');
        else setSnapState('full');
      },
      [sheetHeight, snapHalf, snapFull]
    );

    useImperativeHandle(ref, () => ({
      scrollToId(id: string) {
        const idx = restaurants.findIndex((r) => getRestaurantId(r.item) === id);
        if (idx >= 0 && listRef.current) {
          listRef.current.scrollToRow({ index: idx, align: 'center' });
        }
      },
      expandHalf() {
        snapTo(snapHalf);
      },
    }), [restaurants, snapTo, snapHalf, listRef]);

    // When selectedId changes externally (map marker tap), scroll list into view
    // and expand sheet if collapsed. Uses requestAnimationFrame to avoid
    // synchronous setState inside effect (react-hooks/set-state-in-effect).
    useEffect(() => {
      if (selectedId) {
        const idx = restaurants.findIndex((r) => getRestaurantId(r.item) === selectedId);
        if (idx >= 0 && listRef.current) {
          listRef.current.scrollToRow({ index: idx, align: 'center' });
        }
        if (snapState === 'collapsed') {
          requestAnimationFrame(() => snapTo(snapHalf));
        }
      }
    }, [selectedId, restaurants, snapState, snapTo, snapHalf, listRef]);

    const handleDragEnd = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const currentHeight = sheetHeight.get();
        const velocity = -info.velocity.y;

        let target: number;
        if (velocity > 500) {
          target = currentHeight < snapHalf ? snapHalf : snapFull;
        } else if (velocity < -500) {
          target = currentHeight > snapHalf ? snapHalf : SNAP_COLLAPSED;
        } else {
          const distances = [
            { pos: SNAP_COLLAPSED, dist: Math.abs(currentHeight - SNAP_COLLAPSED) },
            { pos: snapHalf, dist: Math.abs(currentHeight - snapHalf) },
            { pos: snapFull, dist: Math.abs(currentHeight - snapFull) },
          ];
          distances.sort((a, b) => a.dist - b.dist);
          target = distances[0].pos;
        }

        snapTo(target);
      },
      [sheetHeight, snapHalf, snapFull, snapTo]
    );

    // Haptic feedback when visible row range changes
    const handleRowsRendered = useCallback(
      (visibleRows: { startIndex: number; stopIndex: number }) => {
        const centerIndex = Math.floor((visibleRows.startIndex + visibleRows.stopIndex) / 2);
        if (centerIndex >= 0 && centerIndex < restaurants.length) {
          const id = getRestaurantId(restaurants[centerIndex].item);
          if (id !== lastFocusedIdRef.current) {
            lastFocusedIdRef.current = id;
            triggerHaptic('light');
            onSelect(id);
          }
        }
      },
      [restaurants, onSelect]
    );

    const translateY = useTransform(sheetHeight, (h: number) => viewportHeight - h);

    const listHeight = Math.max(100, sheetHeight.get() - 48);

    // Row props for react-window v2
    const rowProps = useMemo(() => ({
      restaurants,
      selectedId,
      onSelect,
      favoriteIds,
      heatColors,
    }), [restaurants, selectedId, onSelect, favoriteIds, heatColors]);

    return (
      <motion.div
        className="absolute inset-x-0 bottom-0 z-[1000] bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
        style={{
          y: translateY,
          height: snapFull + 20,
          touchAction: 'none',
        }}
        drag="y"
        dragConstraints={{ top: viewportHeight - snapFull, bottom: viewportHeight - SNAP_COLLAPSED }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        onDrag={(_, info) => {
          const newHeight = Math.max(SNAP_COLLAPSED, Math.min(snapFull, sheetHeight.get() - info.delta.y));
          sheetHeight.set(newHeight);
        }}
      >
        {/* Drag handle */}
        <div className="flex flex-col items-center pt-2 pb-3 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
          <div className="flex items-center gap-1.5 mt-2" dir="rtl">
            <ChevronUp className="w-4 h-4 text-[var(--color-ink-muted)]" />
            <span className="text-xs font-medium text-[var(--color-ink-muted)]">
              {restaurants.length} מסעדות קרובות
            </span>
          </div>
        </div>

        {/* Virtualized restaurant list */}
        <div
          style={{ height: `calc(100% - 48px)` }}
          onTouchStart={(e) => {
            if (scrollOffsetRef.current > 0) {
              e.stopPropagation();
            }
          }}
        >
          <List<RowExtraProps>
            listRef={listRef}
            rowCount={restaurants.length}
            rowHeight={ITEM_HEIGHT}
            overscanCount={5}
            rowComponent={RowRenderer}
            rowProps={rowProps}
            onRowsRendered={handleRowsRendered}
            style={{ height: listHeight }}
          />
        </div>
      </motion.div>
    );
  }
);

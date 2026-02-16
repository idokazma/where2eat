/**
 * Color utilities for heat-based marker coloring (hot=new, cold=old).
 */

const NEUTRAL_GRAY = '#9ca3af';

/**
 * Interpolate between hot (red) and cold (blue) based on a 0-1 ratio.
 * ratio=1 → newest (red/hot), ratio=0 → oldest (blue/cold).
 * Uses HSL interpolation: hue 0 (red) → 220 (blue).
 */
export function ratioToHeatColor(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  // Invert: ratio=1 (newest) → hue 0 (red), ratio=0 (oldest) → hue 220 (blue)
  const hue = (1 - clamped) * 220;
  const saturation = 75;
  const lightness = 50;
  return hslToHex(hue, saturation, lightness);
}

/**
 * Map a publish date to a heat color given the date range.
 * Returns neutral gray if date is missing or range is invalid.
 */
export function dateToHeatColor(
  publishDate: string | undefined | null,
  minDate: Date,
  maxDate: Date
): string {
  if (!publishDate) return NEUTRAL_GRAY;

  const date = new Date(publishDate);
  if (isNaN(date.getTime())) return NEUTRAL_GRAY;

  const range = maxDate.getTime() - minDate.getTime();
  if (range <= 0) return ratioToHeatColor(1); // Single date → treat as newest

  const ratio = (date.getTime() - minDate.getTime()) / range;
  return ratioToHeatColor(ratio);
}

/**
 * Scan restaurants for min/max published_at dates.
 */
export function getDateRange(
  restaurants: { episode_info?: { published_at?: string } }[]
): { min: Date; max: Date } | null {
  let min = Infinity;
  let max = -Infinity;

  for (const r of restaurants) {
    const dateStr = r.episode_info?.published_at;
    if (!dateStr) continue;
    const t = new Date(dateStr).getTime();
    if (isNaN(t)) continue;
    if (t < min) min = t;
    if (t > max) max = t;
  }

  if (min === Infinity || max === -Infinity) return null;

  return { min: new Date(min), max: new Date(max) };
}

/**
 * Convert HSL values to hex string.
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

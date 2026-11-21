import type { Restaurant } from '@/types/restaurant';

/** A restaurant shown in the feed: not hidden, not closing, not closed. */
export function isListed(r: Restaurant): boolean {
  return !r.is_hidden && !r.is_closing && r.status !== 'closed' && r.status !== 'סגור';
}

/** How many restaurants the feed lists. The headline and source totals both use this. */
export function listedCount(restaurants: Restaurant[]): number {
  return restaurants.filter(isListed).length;
}

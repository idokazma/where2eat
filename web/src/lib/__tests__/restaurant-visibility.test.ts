import { isListed, listedCount } from '../restaurant-visibility';
import type { Restaurant } from '@/types/restaurant';

const r = (over: Partial<Restaurant> & Record<string, unknown> = {}) =>
  ({ name_hebrew: 'x', ...over }) as unknown as Restaurant;

describe('restaurant visibility', () => {
  it('lists an ordinary restaurant', () => {
    expect(isListed(r())).toBe(true);
  });

  it.each([
    ['hidden', { is_hidden: true }],
    ['closing', { is_closing: true }],
    ['closed', { status: 'closed' }],
    ['closed (Hebrew)', { status: 'סגור' }],
  ])('does not list a %s restaurant', (_label, over) => {
    expect(isListed(r(over as Partial<Restaurant>))).toBe(false);
  });

  it('counts only listed restaurants, so the headline matches the source totals', () => {
    expect(listedCount([r(), r({ is_hidden: true } as Partial<Restaurant>), r({ status: 'סגור' }), r()])).toBe(2);
  });
});

import { normalizePriceRange, normalizeStatus, normalizeHostOpinion, normalizeMenuItems, getPriceDisplay } from '../data-normalizer';

describe('normalizePriceRange', () => {
  it('normalizes Hebrew values', () => {
    expect(normalizePriceRange('בינוני')).toBe('mid-range');
    expect(normalizePriceRange('יקר')).toBe('expensive');
    expect(normalizePriceRange('זול')).toBe('budget');
  });
  it('passes through English values', () => {
    expect(normalizePriceRange('budget')).toBe('budget');
  });
  it('handles null', () => {
    expect(normalizePriceRange(null)).toBeNull();
    expect(normalizePriceRange(undefined)).toBeNull();
  });
});

describe('normalizeStatus', () => {
  it('normalizes Hebrew', () => {
    expect(normalizeStatus('פתוח')).toBe('open');
    expect(normalizeStatus('סגור')).toBe('closed');
  });
});

describe('normalizeHostOpinion', () => {
  it('normalizes Hebrew', () => {
    expect(normalizeHostOpinion('חיובית')).toBe('positive');
    expect(normalizeHostOpinion('חיובית מאוד')).toBe('positive');
  });
});

describe('normalizeMenuItems', () => {
  it('converts strings to objects', () => {
    const result = normalizeMenuItems(['pizza']);
    expect(result[0].item_name).toBe('pizza');
  });
  it('handles empty', () => {
    expect(normalizeMenuItems([])).toEqual([]);
  });
});

describe('getPriceDisplay', () => {
  it('returns shekel symbols', () => {
    expect(getPriceDisplay('mid-range')).toBe('₪₪');
    expect(getPriceDisplay('בינוני')).toBe('₪₪');
  });
  it('returns empty for unknown', () => {
    expect(getPriceDisplay(null)).toBe('');
  });
});

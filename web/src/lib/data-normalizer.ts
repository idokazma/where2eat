/**
 * Data normalizer for restaurant data.
 * Handles both English enum values (from normalized backend) and
 * legacy Hebrew values (backward compatibility).
 */

const PRICE_MAP: Record<string, string> = {
  'budget': 'budget', 'mid-range': 'mid-range', 'expensive': 'expensive',
  'זול': 'budget', 'תקציבי': 'budget',
  'בינוני': 'mid-range', 'בינוני-יקר': 'mid-range',
  'יקר': 'expensive', 'יוקרתי': 'expensive',
};

const STATUS_MAP: Record<string, string> = {
  'open': 'open', 'closed': 'closed', 'new_opening': 'new_opening',
  'closing_soon': 'closing_soon', 'reopening': 'reopening',
  'פתוח': 'open', 'סגור': 'closed',
  'חדש': 'new_opening', 'פתיחה חדשה': 'new_opening',
  'נסגר בקרוב': 'closing_soon', 'נפתח מחדש': 'reopening',
};

const OPINION_MAP: Record<string, string> = {
  'positive': 'positive', 'negative': 'negative', 'mixed': 'mixed', 'neutral': 'neutral',
  'חיובית מאוד': 'positive', 'חיובית': 'positive',
  'שלילית': 'negative', 'מעורבת': 'mixed',
  'ניטרלית': 'neutral', 'לא צוין': 'neutral',
};

export function normalizePriceRange(value?: string | null): string | null {
  if (!value) return null;
  return PRICE_MAP[value] ?? null;
}

export function normalizeStatus(value?: string | null): string | null {
  if (!value) return null;
  return STATUS_MAP[value] ?? value;
}

export function normalizeHostOpinion(value?: string | null): string | null {
  if (!value) return null;
  return OPINION_MAP[value] ?? value;
}

export interface MenuItem {
  item_name: string;
  description?: string;
  price?: string | null;
  recommendation_level?: string;
}

export function normalizeMenuItems(items?: unknown[]): MenuItem[] {
  if (!items || items.length === 0) return [];
  return items.map(item => {
    if (typeof item === 'string') {
      return { item_name: item, description: '', price: null, recommendation_level: 'mentioned' };
    }
    return item as MenuItem;
  });
}

export function getPriceDisplay(priceRange?: string | null): string {
  const normalized = normalizePriceRange(priceRange);
  switch (normalized) {
    case 'budget': return '₪';
    case 'mid-range': return '₪₪';
    case 'expensive': return '₪₪₪';
    default: return '';
  }
}

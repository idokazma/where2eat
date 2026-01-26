'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronRight, Check, MapPin } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface City {
  name: string;
  nameHebrew: string;
  neighborhoods: string[];
  restaurantCount?: number;
}

// Israeli cities with common neighborhoods
const CITIES: City[] = [
  {
    name: 'tel-aviv',
    nameHebrew: 'תל אביב',
    neighborhoods: [
      'פלורנטין',
      'נווה צדק',
      'לב העיר',
      'רוטשילד',
      'שרונה',
      'יפו',
      'הצפון הישן',
      'הצפון החדש',
      'נמל תל אביב',
      'כרם התימנים',
      'שוק הכרמל',
      'רמת אביב',
    ],
    restaurantCount: 156,
  },
  {
    name: 'jerusalem',
    nameHebrew: 'ירושלים',
    neighborhoods: [
      'מחנה יהודה',
      'נחלאות',
      'העיר העתיקה',
      'ממילא',
      'רחביה',
      'בקעה',
      'עין כרם',
      'גרמנית מושבה',
      'טלביה',
      'קטמון',
    ],
    restaurantCount: 87,
  },
  {
    name: 'haifa',
    nameHebrew: 'חיפה',
    neighborhoods: [
      'המושבה הגרמנית',
      'כרמל',
      'עיר תחתית',
      'ואדי ניסנאס',
      'דניה',
      'אחוזה',
      'נווה שאנן',
    ],
    restaurantCount: 45,
  },
  {
    name: 'herzliya',
    nameHebrew: 'הרצליה',
    neighborhoods: ['הרצליה פיתוח', 'מרכז העיר', 'חוף הים'],
    restaurantCount: 32,
  },
  {
    name: 'ramat-gan',
    nameHebrew: 'רמת גן',
    neighborhoods: ['בורסה', 'מרכז העיר', 'גני הדר'],
    restaurantCount: 28,
  },
  {
    name: 'petah-tikva',
    nameHebrew: 'פתח תקווה',
    neighborhoods: ['מרכז העיר', 'עין גנים', 'כפר גנים'],
    restaurantCount: 19,
  },
  {
    name: 'beer-sheva',
    nameHebrew: 'באר שבע',
    neighborhoods: ['עיר העתיקה', 'מרכז העיר', 'רמות'],
    restaurantCount: 24,
  },
  {
    name: 'netanya',
    nameHebrew: 'נתניה',
    neighborhoods: ['חוף הים', 'מרכז העיר', 'פולג'],
    restaurantCount: 21,
  },
  {
    name: 'ashdod',
    nameHebrew: 'אשדוד',
    neighborhoods: ['מרינה', 'מרכז העיר', 'רובע ח'],
    restaurantCount: 18,
  },
  {
    name: 'eilat',
    nameHebrew: 'אילת',
    neighborhoods: ['מרכז העיר', 'שחמון', 'אזור המלונות'],
    restaurantCount: 35,
  },
];

interface CityPickerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCity: string | null;
  selectedNeighborhood: string | null;
  lastUsedCity?: string | null;
  lastUsedNeighborhood?: string | null;
  onSelectCity: (city: string, neighborhood: string | null) => void;
}

export function CityPicker({
  isOpen,
  onClose,
  selectedCity,
  selectedNeighborhood,
  lastUsedCity,
  lastUsedNeighborhood,
  onSelectCity,
}: CityPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingCity, setViewingCity] = useState<City | null>(null);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (!searchQuery) return CITIES;
    const query = searchQuery.toLowerCase();
    return CITIES.filter(
      (city) =>
        city.nameHebrew.includes(query) ||
        city.name.includes(query) ||
        city.neighborhoods.some((n) => n.includes(query))
    );
  }, [searchQuery]);

  const handleCityClick = (city: City) => {
    setViewingCity(city);
  };

  const handleNeighborhoodSelect = (neighborhood: string | null) => {
    if (viewingCity) {
      onSelectCity(viewingCity.nameHebrew, neighborhood);
      onClose();
      setViewingCity(null);
      setSearchQuery('');
    }
  };

  const handleSelectAllCity = () => {
    if (viewingCity) {
      onSelectCity(viewingCity.nameHebrew, null);
      onClose();
      setViewingCity(null);
      setSearchQuery('');
    }
  };

  const handleBack = () => {
    setViewingCity(null);
  };

  const handleClose = () => {
    onClose();
    setViewingCity(null);
    setSearchQuery('');
  };

  // Render neighborhood selection view
  if (viewingCity) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} showHandle>
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            className="p-2 -m-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
            aria-label="Back to cities"
          >
            <ChevronRight className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </button>
          <h2 className="text-lg font-bold text-[var(--color-ink)]">
            {viewingCity.nameHebrew}
          </h2>
        </div>

        {/* Neighborhood grid */}
        <div className="space-y-2">
          <p className="text-sm text-[var(--color-ink-muted)] mb-3">שכונות</p>
          <div className="grid grid-cols-2 gap-2">
            {viewingCity.neighborhoods.map((neighborhood) => (
              <button
                key={neighborhood}
                onClick={() => handleNeighborhoodSelect(neighborhood)}
                className={`p-3 rounded-lg text-right text-sm font-medium transition-colors ${
                  selectedNeighborhood === neighborhood && selectedCity === viewingCity.nameHebrew
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                    : 'bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-ink)]'
                }`}
              >
                <span className="flex items-center justify-between">
                  {neighborhood}
                  {selectedNeighborhood === neighborhood && selectedCity === viewingCity.nameHebrew && (
                    <Check className="w-4 h-4" />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Select all city button */}
        <button
          onClick={handleSelectAllCity}
          className="w-full mt-4 p-4 rounded-lg bg-[var(--color-ink)] text-[var(--color-paper)] font-medium transition-colors hover:opacity-90"
        >
          <span className="flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            כל {viewingCity.nameHebrew}
          </span>
        </button>
      </BottomSheet>
    );
  }

  // Render city selection view
  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="בחר מיקום" showHandle>
      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-ink-subtle)]" />
        <input
          type="text"
          placeholder="חפש עיר או שכונה..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pr-10 pl-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
      </div>

      {/* Last used */}
      {lastUsedCity && !searchQuery && (
        <div className="mb-4">
          <button
            onClick={() => onSelectCity(lastUsedCity, lastUsedNeighborhood || null)}
            className="flex items-center gap-2 p-3 w-full rounded-lg bg-[var(--color-gold-subtle)] text-[var(--color-ink)] hover:opacity-90 transition-colors"
          >
            <MapPin className="w-4 h-4 text-[var(--color-gold)]" />
            <span className="text-sm">
              אחרון:{' '}
              <span className="font-medium">
                {lastUsedNeighborhood ? `${lastUsedNeighborhood}, ` : ''}
                {lastUsedCity}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Cities list */}
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-ink-muted)] mb-3">ערים פופולריות</p>
        <div className="grid grid-cols-3 gap-2">
          {filteredCities.slice(0, 9).map((city) => (
            <button
              key={city.name}
              onClick={() => handleCityClick(city)}
              className={`p-3 rounded-lg text-center text-sm font-medium transition-colors ${
                selectedCity === city.nameHebrew
                  ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-ink)]'
              }`}
            >
              {city.nameHebrew}
            </button>
          ))}
        </div>

        {/* More cities if filtered */}
        {filteredCities.length > 9 && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="text-sm text-[var(--color-ink-muted)] mb-3">עוד ערים</p>
            <div className="space-y-1">
              {filteredCities.slice(9).map((city) => (
                <button
                  key={city.name}
                  onClick={() => handleCityClick(city)}
                  className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-[var(--color-surface)] transition-colors"
                >
                  <span className="text-[var(--color-ink)]">{city.nameHebrew}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-ink-muted)] rotate-180" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

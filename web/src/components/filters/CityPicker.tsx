'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronRight, Check, MapPin, X } from 'lucide-react';

interface City {
  name: string;
  nameHebrew: string;
  neighborhoods: string[];
}

const CITIES: City[] = [
  {
    name: 'tel-aviv',
    nameHebrew: 'תל אביב',
    neighborhoods: ['פלורנטין', 'נווה צדק', 'לב העיר', 'רוטשילד', 'שרונה', 'יפו', 'הצפון הישן', 'הצפון החדש', 'נמל תל אביב', 'כרם התימנים', 'שוק הכרמל', 'רמת אביב'],
  },
  {
    name: 'jerusalem',
    nameHebrew: 'ירושלים',
    neighborhoods: ['מחנה יהודה', 'נחלאות', 'העיר העתיקה', 'ממילא', 'רחביה', 'בקעה', 'עין כרם', 'גרמנית מושבה', 'טלביה', 'קטמון'],
  },
  {
    name: 'haifa',
    nameHebrew: 'חיפה',
    neighborhoods: ['המושבה הגרמנית', 'כרמל', 'עיר תחתית', 'ואדי ניסנאס', 'דניה', 'אחוזה', 'נווה שאנן'],
  },
  {
    name: 'herzliya',
    nameHebrew: 'הרצליה',
    neighborhoods: ['הרצליה פיתוח', 'מרכז העיר', 'חוף הים'],
  },
  {
    name: 'ramat-gan',
    nameHebrew: 'רמת גן',
    neighborhoods: ['בורסה', 'מרכז העיר', 'גני הדר'],
  },
  {
    name: 'petah-tikva',
    nameHebrew: 'פתח תקווה',
    neighborhoods: ['מרכז העיר', 'עין גנים', 'כפר גנים'],
  },
  {
    name: 'beer-sheva',
    nameHebrew: 'באר שבע',
    neighborhoods: ['עיר העתיקה', 'מרכז העיר', 'רמות'],
  },
  {
    name: 'netanya',
    nameHebrew: 'נתניה',
    neighborhoods: ['חוף הים', 'מרכז העיר', 'פולג'],
  },
  {
    name: 'ashdod',
    nameHebrew: 'אשדוד',
    neighborhoods: ['מרינה', 'מרכז העיר', 'רובע ח'],
  },
  {
    name: 'eilat',
    nameHebrew: 'אילת',
    neighborhoods: ['מרכז העיר', 'שחמון', 'אזור המלונות'],
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

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setViewingCity(null);
      setSearchQuery('');
    }
  }, [isOpen]);

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
    }
  };

  const handleSelectAllCity = () => {
    if (viewingCity) {
      onSelectCity(viewingCity.nameHebrew, null);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Neighborhood view
  if (viewingCity) {
    return (
      <div className="fixed inset-0 z-[1000] bg-[var(--color-paper)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 border-b border-[var(--color-border)]">
          <button
            onClick={() => setViewingCity(null)}
            className="p-2 -m-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </button>
          <h2 className="text-lg font-bold text-[var(--color-ink)]">{viewingCity.nameHebrew}</h2>
        </div>

        {/* Neighborhoods list */}
        <div className="flex-1 overflow-y-auto">
          {/* All city option */}
          <button
            onClick={handleSelectAllCity}
            className="flex items-center justify-between w-full px-4 py-4 border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <span className="font-medium text-[var(--color-ink)]">כל {viewingCity.nameHebrew}</span>
            {selectedCity === viewingCity.nameHebrew && !selectedNeighborhood && (
              <Check className="w-5 h-5 text-[var(--color-accent)]" />
            )}
          </button>

          {viewingCity.neighborhoods.map((neighborhood) => (
            <button
              key={neighborhood}
              onClick={() => handleNeighborhoodSelect(neighborhood)}
              className="flex items-center justify-between w-full px-4 py-4 border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors"
            >
              <span className="text-[var(--color-ink)]">{neighborhood}</span>
              {selectedNeighborhood === neighborhood && selectedCity === viewingCity.nameHebrew && (
                <Check className="w-5 h-5 text-[var(--color-accent)]" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // City list view
  return (
    <div className="fixed inset-0 z-[1000] bg-[var(--color-paper)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-bold text-[var(--color-ink)]">בחר מיקום</h2>
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
        >
          <X className="w-5 h-5 text-[var(--color-ink-muted)]" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ink-subtle)]" />
          <input
            type="text"
            placeholder="חפש עיר או שכונה..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            autoFocus
          />
        </div>
      </div>

      {/* Scrollable city list */}
      <div className="flex-1 overflow-y-auto">
        {/* Last used */}
        {lastUsedCity && !searchQuery && (
          <button
            onClick={() => {
              onSelectCity(lastUsedCity, lastUsedNeighborhood || null);
              onClose();
            }}
            className="flex items-center gap-3 w-full px-4 py-4 border-b border-[var(--color-border)] bg-[var(--color-gold-subtle)] hover:opacity-90 transition-colors"
          >
            <MapPin className="w-5 h-5 text-[var(--color-gold)]" />
            <div className="text-right">
              <span className="text-sm text-[var(--color-ink-muted)]">אחרון: </span>
              <span className="font-medium text-[var(--color-ink)]">
                {lastUsedNeighborhood ? `${lastUsedNeighborhood}, ` : ''}{lastUsedCity}
              </span>
            </div>
          </button>
        )}

        {/* Cities */}
        {filteredCities.map((city) => (
          <button
            key={city.name}
            onClick={() => handleCityClick(city)}
            className={`flex items-center justify-between w-full px-4 py-4 border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors ${
              selectedCity === city.nameHebrew ? 'bg-[var(--color-accent-subtle)]' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <MapPin className={`w-4 h-4 ${selectedCity === city.nameHebrew ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-muted)]'}`} />
              <span className={`text-base ${selectedCity === city.nameHebrew ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>
                {city.nameHebrew}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-ink-muted)] rotate-180" />
          </button>
        ))}
      </div>
    </div>
  );
}

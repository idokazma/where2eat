'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Check, MapPin, X } from 'lucide-react';

interface City {
  name: string;
  nameHebrew: string;
  neighborhoods: string[];
}

const CITIES: City[] = [
  { name: 'tel-aviv', nameHebrew: 'תל אביב', neighborhoods: ['פלורנטין', 'נווה צדק', 'לב העיר', 'רוטשילד', 'שרונה', 'יפו', 'הצפון הישן', 'הצפון החדש', 'נמל תל אביב', 'כרם התימנים', 'שוק הכרמל', 'רמת אביב'] },
  { name: 'jerusalem', nameHebrew: 'ירושלים', neighborhoods: ['מחנה יהודה', 'נחלאות', 'העיר העתיקה', 'ממילא', 'רחביה', 'בקעה', 'עין כרם', 'גרמנית מושבה', 'טלביה', 'קטמון'] },
  { name: 'haifa', nameHebrew: 'חיפה', neighborhoods: ['המושבה הגרמנית', 'כרמל', 'עיר תחתית', 'ואדי ניסנאס', 'דניה', 'אחוזה', 'נווה שאנן'] },
  { name: 'herzliya', nameHebrew: 'הרצליה', neighborhoods: ['הרצליה פיתוח', 'מרכז העיר', 'חוף הים'] },
  { name: 'ramat-gan', nameHebrew: 'רמת גן', neighborhoods: ['בורסה', 'מרכז העיר', 'גני הדר'] },
  { name: 'petah-tikva', nameHebrew: 'פתח תקווה', neighborhoods: ['מרכז העיר', 'עין גנים', 'כפר גנים'] },
  { name: 'beer-sheva', nameHebrew: 'באר שבע', neighborhoods: ['עיר העתיקה', 'מרכז העיר', 'רמות'] },
  { name: 'netanya', nameHebrew: 'נתניה', neighborhoods: ['חוף הים', 'מרכז העיר', 'פולג'] },
  { name: 'ashdod', nameHebrew: 'אשדוד', neighborhoods: ['מרינה', 'מרכז העיר', 'רובע ח'] },
  { name: 'eilat', nameHebrew: 'אילת', neighborhoods: ['מרכז העיר', 'שחמון', 'אזור המלונות'] },
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
  onSelectCity,
}: CityPickerProps) {
  const [viewingCity, setViewingCity] = useState<City | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setViewingCity(null);
  }, [isOpen]);

  const handleSelectCity = (city: City) => {
    // If city has neighborhoods, show them. Otherwise select directly.
    if (city.neighborhoods.length > 0) {
      setViewingCity(city);
    } else {
      onSelectCity(city.nameHebrew, null);
      onClose();
    }
  };

  const handleSelectAllCity = () => {
    if (viewingCity) {
      onSelectCity(viewingCity.nameHebrew, null);
      onClose();
    }
  };

  const handleSelectNeighborhood = (neighborhood: string) => {
    if (viewingCity) {
      onSelectCity(viewingCity.nameHebrew, neighborhood);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Neighborhood view
  if (viewingCity) {
    return (
      <div className="fixed inset-0 z-[1000] bg-[var(--color-paper)] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 border-b border-[var(--color-border)]">
          <button
            onClick={() => setViewingCity(null)}
            className="p-2 -m-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[var(--color-ink-muted)]" />
          </button>
          <h2 className="text-xl font-bold text-[var(--color-ink)]">{viewingCity.nameHebrew}</h2>
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
          {/* All city */}
          <button
            onClick={handleSelectAllCity}
            className={`flex items-center justify-between w-full px-5 py-4.5 border-b border-[var(--color-border)] active:bg-[var(--color-surface)] transition-colors ${
              selectedCity === viewingCity.nameHebrew && !selectedNeighborhood ? 'bg-[var(--color-accent-subtle)]' : ''
            }`}
          >
            <span className="text-base font-semibold text-[var(--color-ink)]">כל {viewingCity.nameHebrew}</span>
            {selectedCity === viewingCity.nameHebrew && !selectedNeighborhood && (
              <Check className="w-5 h-5 text-[var(--color-accent)]" />
            )}
          </button>

          <div className="px-5 py-3">
            <span className="text-xs font-medium text-[var(--color-ink-muted)] uppercase tracking-wider">שכונות</span>
          </div>

          {viewingCity.neighborhoods.map((neighborhood) => {
            const isSelected = selectedNeighborhood === neighborhood && selectedCity === viewingCity.nameHebrew;
            return (
              <button
                key={neighborhood}
                onClick={() => handleSelectNeighborhood(neighborhood)}
                className={`flex items-center justify-between w-full px-5 py-4 border-b border-[var(--color-border)] active:bg-[var(--color-surface)] transition-colors ${
                  isSelected ? 'bg-[var(--color-accent-subtle)]' : ''
                }`}
              >
                <span className={`text-base ${isSelected ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>
                  {neighborhood}
                </span>
                {isSelected && <Check className="w-5 h-5 text-[var(--color-accent)]" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // City list view
  return (
    <div className="fixed inset-0 z-[1000] bg-[var(--color-paper)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 border-b border-[var(--color-border)]">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">בחר עיר</h2>
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full hover:bg-[var(--color-surface)] transition-colors"
        >
          <X className="w-5 h-5 text-[var(--color-ink-muted)]" />
        </button>
      </div>

      {/* City list */}
      <div className="flex-1 overflow-y-auto -webkit-overflow-scrolling-touch">
        {CITIES.map((city) => {
          const isSelected = selectedCity === city.nameHebrew;
          return (
            <button
              key={city.name}
              onClick={() => handleSelectCity(city)}
              className={`flex items-center justify-between w-full px-5 py-4.5 border-b border-[var(--color-border)] active:bg-[var(--color-surface)] transition-colors ${
                isSelected ? 'bg-[var(--color-accent-subtle)]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-muted)]'}`} />
                <span className={`text-base ${isSelected ? 'font-semibold text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>
                  {city.nameHebrew}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--color-ink-muted)] rotate-180" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

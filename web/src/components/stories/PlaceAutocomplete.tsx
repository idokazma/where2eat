"use client";

import { useId, useState } from "react";
import { searchStoryPlaces, type StoryPlace } from "@/lib/story-places";
import type { GeoCoords } from "@/lib/geo-utils";

const kindLabel: Record<string, string> = { locality: "יישוב", region: "אזור · נקודת התחלה מייצגת", market: "שוק" };

export function PlaceAutocomplete({ disabled, onSelect }: { disabled: boolean; onSelect: (coords: GeoCoords) => void }) {
  const id = useId();
  const [places, setPlaces] = useState<StoryPlace[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const matches = searchStoryPlaces(places ?? [], query);
  const load = async () => {
    if (places || loading) return;
    setLoading(true);
    setError(false);
    try {
      const data = await import("@/data/israel-places.json");
      setPlaces(data.default);
    } catch { setError(true); }
    finally { setLoading(false); }
  };
  const choose = (place: StoryPlace) => {
    setQuery(place.name);
    setOpen(false);
    setActive(-1);
    onSelect({ lat: place.lat, lng: place.lng });
  };
  return (
    <div className="stories-place-search">
      <label htmlFor={id}>או הקלידו מקום</label>
      <input
        id={id} type="search" role="combobox" autoComplete="off"
        placeholder="למשל רעננה או רמת הגולן" disabled={disabled}
        aria-autocomplete="list" aria-expanded={open && matches.length > 0}
        aria-controls={`${id}-list`} aria-describedby={`${id}-help`}
        aria-activedescendant={active >= 0 && open && matches[active] ? `${id}-${matches[active].id}` : undefined}
        value={query}
        onFocus={() => { setOpen(true); void load(); }}
        onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) setOpen(false); }}
        onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true); void load(); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); setActive(-1); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive((previous) => matches.length ? event.key === "ArrowDown" ? (previous + 1) % matches.length : (previous <= 0 ? matches.length - 1 : previous - 1) : -1);
          }
          if (event.key === "Enter") {
            event.preventDefault();
            if (open && active >= 0 && matches[active]) choose(matches[active]);
          }
        }}
      />
      {open && matches.length > 0 && (
        <ul id={`${id}-list`} role="listbox" aria-label="מקומות תואמים">
          {matches.map((place, index) => (
            <li key={place.id} id={`${id}-${place.id}`} role="option" aria-selected={active === index}
              onMouseDown={(event) => event.preventDefault()} onClick={() => choose(place)}>
              <strong>{place.name}</strong><span>{kindLabel[place.kind] ?? "מקום"}</span>
            </li>
          ))}
        </ul>
      )}
      {open && loading && <p role="status">טוען רשימת מקומות…</p>}
      {open && error && <p role="status">לא הצלחנו לטעון את הרשימה. אפשר לבחור נקודה מהרשימה הקיימת.</p>}
      {open && places && query.trim().length >= 2 && !matches.length && <p role="status">לא נמצא מקום תואם. אפשר לנסות שם אחר או לבחור נקודה קיימת.</p>}
      <p className="stories-note" id={`${id}-help`}>בחרו הצעה כדי להתחיל בסביבה ולהמשיך למקומות רחוקים יותר. הרשימה כוללת יישובים ואזורים נבחרים, לא כל רחוב או מקום בארץ.</p>

    </div>
  );
}

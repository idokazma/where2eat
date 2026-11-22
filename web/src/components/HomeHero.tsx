'use client'

/** Home page headline (styles: .home-hero and .hl-marker in globals.css). */
import { useSiteSettings } from '@/lib/site-settings';

export function HomeHero() {
  const { settings } = useSiteSettings();

  const title = settings['site.hero_title'] || 'איפה אוכלים';
  const highlight = settings['site.hero_highlight'] || 'היום?';
  const subtitle =
    settings['site.hero_subtitle'] || 'כל המסעדות שמדברים מהבטן בדקו, דירגו ואכלו';

  return (
    <div className="home-hero animate-fade-up">
      <h1>
        {title} <span className="hl-marker">{highlight}</span>
      </h1>
      <p>{subtitle}</p>
    </div>
  );
}

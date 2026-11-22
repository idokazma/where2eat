import Link from 'next/link';
import { Play } from 'lucide-react';

/** Home page headline (styles: .home-hero and .hl-marker in globals.css). */
export function HomeHero() {
  return (
    <div className="home-hero animate-fade-up">
      {/* The stories button shares the headline row, so the first restaurant stays above the fold. */}
      <div className="home-hero-top">
        <h1>
          איפה אוכלים <span className="hl-marker">היום?</span>
        </h1>
        <Link href="/stories" className="home-stories-btn" aria-label="סטוריז של מסעדות לפי מיקום">
          <Play className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true" />
          <span className="home-stories-label">סטוריז</span>
        </Link>
      </div>
      <p>כל המסעדות שמדברים מהבטן בדקו, דירגו ואכלו</p>
    </div>
  );
}

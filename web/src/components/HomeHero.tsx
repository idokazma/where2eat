/** Home page headline (styles: .home-hero and .hl-marker in globals.css). */
export function HomeHero() {
  return (
    <div className="home-hero animate-fade-up">
      <h1>
        איפה אוכלים <span className="hl-marker">היום?</span>
      </h1>
      <p>כל המסעדות שמדברים מהבטן בדקו, דירגו ואכלו</p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { PageLayout } from "@/components/layout";

export const metadata: Metadata = { title: "מקורות מידע | Where2Eat" };

export default function DataSourcesPage() {
  return (
    <PageLayout title="מקורות מידע" showHeader showBottomNav showSettings={false}>
      <article className="mx-auto max-w-xl px-5 py-8 space-y-5 text-[var(--color-ink)]">
        <h1 className="text-2xl font-bold">מקורות מידע</h1>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">שמות מקומות ונקודות התחלה</h2>
          <p className="leading-relaxed">רשימת המקומות בחיפוש מבוססת על נתוני <a className="underline" href="https://www.geonames.org/">GeoNames</a>, ברישיון <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0</a>.</p>
          <p className="leading-relaxed">התאמנו את הנתונים לחיפוש: סינון רשומות, בחירת שמות בעברית והוספת כתיבים חלופיים. נקודות לאזורים הן נקודות התחלה מייצגות, לא גבולות אזור. זו רשימה נבחרת ולא רשימה מלאה של כל מקום או רחוב בארץ.</p>
          <p className="leading-relaxed">הנתונים ניתנים כפי שהם, ללא התחייבות לדיוק, לעדכניות או לשלמות. העיבוד שלנו אינו מעיד על תמיכה או אישור מצד GeoNames.</p>
          <a className="underline" href="https://download.geonames.org/export/dump/readme.txt">פרטי המקור והרישיון</a>
        </section>
        <Link className="inline-block underline py-3" href="/stories">חזרה לסטוריז</Link>
      </article>
    </PageLayout>
  );
}

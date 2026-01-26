'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PageLayout } from '@/components/layout';

export default function PrivacyPage() {
  return (
    <PageLayout showHeader showBottomNav showSettings={false}>
      {/* Back button */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <Link
          href="/more"
          className="flex items-center gap-2 text-[var(--color-accent)]"
        >
          <ChevronRight className="w-5 h-5" />
          <span>חזרה</span>
        </Link>
      </div>

      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] mb-6">מדיניות פרטיות</h1>

        <div className="space-y-6 text-[var(--color-ink)]">
          <section>
            <h2 className="text-lg font-bold mb-2">מידע שאנחנו אוספים</h2>
            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              Where2Eat שומר מידע מינימלי. אנחנו שומרים את המסעדות ששמרת למועדפים בלבד,
              והמידע נשמר מקומית על המכשיר שלך. אנחנו לא אוספים מידע אישי מזהה.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">מיקום</h2>
            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              אם תבחר לאפשר גישה למיקום, נשתמש בו רק כדי להציג לך מסעדות קרובות.
              המיקום לא נשמר ולא נשלח לשרתים שלנו.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">עוגיות (Cookies)</h2>
            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              אנחנו משתמשים בעוגיות בסיסיות לשמירת העדפות כמו ערכת נושא ושפה.
              אין לנו עוגיות מעקב או פרסום.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">שירותי צד שלישי</h2>
            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              אנחנו משתמשים ב-Google Maps להצגת מיקומים ודירוגים של מסעדות.
              השימוש ב-Google Maps כפוף למדיניות הפרטיות של Google.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">יצירת קשר</h2>
            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              לכל שאלה בנושא פרטיות, ניתן לפנות אלינו בכתובת:{' '}
              <a href="mailto:hello@where2eat.co.il" className="text-[var(--color-accent)]">
                hello@where2eat.co.il
              </a>
            </p>
          </section>

          <div className="pt-6 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-ink-subtle)] text-center">
              עודכן לאחרונה: ינואר 2026
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

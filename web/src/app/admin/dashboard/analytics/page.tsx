'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { restaurantsApi, usageApi, vercelAnalyticsApi } from '@/lib/admin/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Info } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const FEATURE_LABELS: Record<string, string> = {
  map_open: 'פתיחת מפה',
  stories_open: 'פתיחת סטוריז',
  story_play: 'הפעלת סטורי',
  favorite_toggle: 'שמירת מועדפת',
  near_me_toggle: 'קרוב אליי',
  creator_filter: 'סינון לפי יוצר',
  search_run: 'חיפוש',
  layout_toggle: 'שינוי תצוגה',
  language_toggle: 'החלפת שפה',
  saved_page_open: 'עמוד שמורים',
  instagram_preview: 'תצוגת אינסטגרם',
};

const TARGET_LABELS: Record<string, string> = {
  youtube: 'יוטיוב',
  instagram: 'אינסטגרם',
  navigation: 'ניווט',
  website: 'אתר המסעדה',
  order: 'הזמנה',
  google_maps: 'גוגל מפות',
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const { data: usage, isLoading } = useQuery({
    queryKey: ['usage-summary', days],
    queryFn: () => usageApi.getSummary(days),
    refetchInterval: 60000,
  });

  // Vercel Web Analytics - only when the backend proxy is configured (404 otherwise)
  const { data: vercel } = useQuery({
    queryKey: ['vercel-analytics', days > 31 ? 31 : days],
    queryFn: () => vercelAnalyticsApi.get(days > 31 ? 31 : days),
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Resolve restaurant names for the top-restaurants table
  const { data: restaurantList } = useQuery({
    queryKey: ['admin-restaurants-names'],
    queryFn: () => restaurantsApi.list({ page: 1, limit: 500 }),
  });

  const nameById = new Map<string, string>();
  restaurantList?.restaurants?.forEach((r) => {
    const name = r.name_hebrew || r.name_english || r.id || '';
    if (r.id) nameById.set(String(r.id), name);
    if (r.google_places?.place_id) nameById.set(String(r.google_places.place_id), name);
    if (r.name_hebrew) nameById.set(String(r.name_hebrew), name);
  });

  const totals = usage?.totals;
  const daily = usage?.daily ?? [];
  const pages = usage?.pages ?? [];
  const topRestaurants = usage?.top_restaurants ?? [];
  const features = (usage?.features ?? []).map((f) => ({
    ...f,
    label: FEATURE_LABELS[f.feature] ?? f.feature,
  }));
  const outbound = (usage?.outbound_by_target ?? []).map((o) => ({
    ...o,
    label: TARGET_LABELS[o.target] ?? o.target,
  }));
  const referrers = usage?.referrers ?? [];
  const devices = usage?.devices ?? [];
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    events: usage?.hourly?.find((r) => r.hour === h)?.events ?? 0,
  }));

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">נתוני שימוש</h1>
          <p className="text-muted-foreground mt-1">
            כניסות, מקורות תנועה, מסעדות ושימוש בפיצ׳רים
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value={7}>7 ימים אחרונים</option>
            <option value={30}>30 יום אחרונים</option>
            <option value={90}>90 יום אחרונים</option>
          </select>
        </div>
      </div>

      {/* Data-scope note: what these numbers are and are not */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="flex gap-3 pt-6">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
            <p>
              אנליטיקה עצמית עם מינימום פרטיות: בלי IP, בלי עוגיות, בלי טביעות אצבע, בלי טקסט חיפוש. הספירה מתחילה מהרגע שהמעקב עולה לאוויר — אין היסטוריה רטרואקטיבית.
            </p>
            <p>
              קיימת גם אינטגרציית Vercel Analytics באתר. אומת ב־22 בנוב׳: בתוכנית Hobby ה־API חושף 31 ימים אחרונים. הנתונים יופיעו כאן אחרי הגדרת VERCEL_API_TOKEN/TEAM_ID/PROJECT_ID בסביבת השרת — עדיין לא מחובר.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'ביקורים (סשנים)', value: totals?.sessions },
          { label: 'צפיות בעמודים', value: totals?.page_views },
          { label: 'צפיות במסעדות', value: totals?.restaurant_views },
          { label: 'יציאות לאתרים חיצוניים', value: totals?.outbound_clicks },
        ].map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : (m.value ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily trend */}
      <Card>
        <CardHeader>
          <CardTitle>פעילות יומית</CardTitle>
          <CardDescription>סשנים וצפיות בעמודים לפי יום</CardDescription>
        </CardHeader>
        <CardContent>
          {daily.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              עדיין לא נרשמו אירועי שימוש בחלון הזמן הזה.
            </p>
          ) : (
            <div dir="ltr"><ResponsiveContainer width="99%" height={300}>
              <AreaChart data={daily} margin={{ top: 5, right: 24, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={11} minTickGap={24} tickFormatter={(d: string) => d.slice(5)} padding={{ left: 10, right: 30 }} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Area isAnimationActive={false} type="monotone" dataKey="page_views" name="צפיות" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area isAnimationActive={false} type="monotone" dataKey="sessions" name="סשנים" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer></div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Pages */}
        <Card>
          <CardHeader>
            <CardTitle>עמודים</CardTitle>
            <CardDescription>צפיות לפי אזור באתר</CardDescription>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו צפיות.</p>
            ) : (
              <div className="space-y-2" dir="ltr">
                {pages.map((p) => {
                  const max = Math.max(...pages.map((x) => x.views), 1);
                  return (
                    <div key={p.page_type} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-left text-muted-foreground">{p.page_type}</span>
                      <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${(p.views / max) * 100}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right font-medium">{p.views}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hourly */}
        <Card>
          <CardHeader>
            <CardTitle>שעות ביום</CardTitle>
            <CardDescription>אירועים לפי שעה (שעון השרת)</CardDescription>
          </CardHeader>
          <CardContent>
            <div dir="ltr"><ResponsiveContainer width="99%" height={260}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" fontSize={11} interval={3} padding={{ left: 10, right: 34 }} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar isAnimationActive={false} dataKey="events" name="אירועים" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Referrers */}
        <Card>
          <CardHeader>
            <CardTitle>מקורות תנועה</CardTitle>
            <CardDescription>דומיינים מפנים של סשנים חדשים</CardDescription>
          </CardHeader>
          <CardContent>
            {referrers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו סשנים.</p>
            ) : (
              <div className="space-y-2">
                {referrers.map((r) => (
                  <div key={r.source} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <span className="text-sm font-medium">{r.source}</span>
                    <span className="text-sm text-muted-foreground">{r.visits} סשנים</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader>
            <CardTitle>מכשירים</CardTitle>
            <CardDescription>סשנים לפי סוג מכשיר</CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו סשנים.</p>
            ) : (
              <div dir="ltr"><ResponsiveContainer width="99%" height={260}>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={devices}
                    dataKey="sessions"
                    nameKey="device"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {devices.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend formatter={(value: string) => {
                    const d = devices.find((x) => x.device === value);
                    return `${value}: ${d?.sessions ?? 0}`;
                  }} />
                </PieChart>
              </ResponsiveContainer></div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>שימוש בפיצ׳רים</CardTitle>
            <CardDescription>כמה פעמים כל פיצ׳ר שומש</CardDescription>
          </CardHeader>
          <CardContent>
            {features.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו אירועי פיצ׳רים.</p>
            ) : (
              <div dir="ltr"><ResponsiveContainer width="99%" height={280}>
                <BarChart data={features} layout="vertical" margin={{ top: 5, right: 30, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="label" width={120} fontSize={12} />
                  <Tooltip />
                  <Bar isAnimationActive={false} dataKey="uses" name="שימושים" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer></div>
            )}
          </CardContent>
        </Card>

        {/* Outbound */}
        <Card>
          <CardHeader>
            <CardTitle>יציאות לאתרים חיצוניים</CardTitle>
            <CardDescription>קליקים ליוטיוב, אינסטגרם, ניווט ועוד</CardDescription>
          </CardHeader>
          <CardContent>
            {outbound.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו יציאות.</p>
            ) : (
              <div dir="ltr"><ResponsiveContainer width="99%" height={280}>
                <BarChart data={outbound}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar isAnimationActive={false} dataKey="clicks" name="קליקים" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer></div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vercel Web Analytics (only when backend env is configured) */}
      {vercel?.totals && (
        <Card>
          <CardHeader>
            <CardTitle>Vercel Web Analytics</CardTitle>
            <CardDescription>
              היסטוריה מאומתת, {vercel.days} ימים אחרונים (תוכנית Hobby שומרת 31). כולל ביקורי בעלים/ניהול; Vercel מסננת בוטים.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">מבקרים</p>
                <p className="text-2xl font-bold">{vercel.totals.visitors?.toLocaleString() ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">צפיות</p>
                <p className="text-2xl font-bold">{vercel.totals.pageviews?.toLocaleString() ?? '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">מקורות מובילים</p>
                <div className="text-sm">
                  {(vercel.referrers ?? []).slice(0, 4).map((r) => (
                    <p key={r.referrerHostname || 'direct'}>
                      {r.referrerHostname || '(ישיר)'}: {r.visitors}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">מדינות</p>
                <div className="text-sm">
                  {(vercel.countries ?? []).slice(0, 4).map((c) => (
                    <p key={c.country}>{c.country}: {c.visitors}</p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top restaurants */}
      <Card>
        <CardHeader>
          <CardTitle>מסעדות מובילות</CardTitle>
          <CardDescription>פתיחות כרטיס ויציאות לפי מסעדה</CardDescription>
        </CardHeader>
        <CardContent>
          {topRestaurants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">עדיין לא נרשמו אינטראקציות עם מסעדות.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 font-medium">מסעדה</th>
                    <th className="py-2 font-medium text-left">צפיות</th>
                    <th className="py-2 font-medium text-left">יציאות</th>
                  </tr>
                </thead>
                <tbody>
                  {topRestaurants.map((r) => (
                    <tr key={r.restaurant_id} className="border-b last:border-0">
                      <td className="py-2">
                        {nameById.get(String(r.restaurant_id)) ?? r.restaurant_id}
                      </td>
                      <td className="py-2 text-left">{r.views}</td>
                      <td className="py-2 text-left">{r.outbound}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

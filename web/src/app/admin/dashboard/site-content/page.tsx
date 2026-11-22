'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type SettingsHistoryEntry, type SiteSettings } from '@/lib/admin/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/admin/ui/card';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { Loader2, RotateCcw, Save } from 'lucide-react';

const TEXT_FIELDS: Array<{ key: string; label: string; hint?: string; multiline?: boolean }> = [
  { key: 'site.hero_title', label: 'Hero title', hint: 'Main homepage headline (before the highlighted word)' },
  { key: 'site.hero_highlight', label: 'Hero highlighted word', hint: 'The marked part of the headline' },
  { key: 'site.hero_subtitle', label: 'Hero subtitle' },
  { key: 'site.banner_text', label: 'Announcement banner text', hint: 'Empty hides the banner' },
  { key: 'site.banner_link', label: 'Announcement banner link', hint: 'https://... (optional)' },
  { key: 'social.instagram', label: 'Instagram link' },
  { key: 'social.youtube_mdaberim', label: 'YouTube - Mdaberim MeHabeten' },
  { key: 'social.youtube_gil', label: 'YouTube - Gil Harel' },
  { key: 'about.text', label: 'About page text', multiline: true },
];

const TOGGLES: Array<{ key: string; label: string; hint: string }> = [
  { key: 'display.restaurant_count', label: 'Restaurant count on homepage', hint: 'Shows the live count in the top strip' },
  { key: 'display.creator_filter', label: 'Creator filter', hint: 'Shows the Mdaberim / Gil Harel filter on the homepage' },
  { key: 'site.maintenance_mode', label: 'Maintenance mode', hint: 'Visitors see a "back soon" page instead of the site' },
];

export default function SiteContentPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SiteSettings>({});
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => settingsApi.getAll(),
  });

  const { data: historyData } = useQuery({
    queryKey: ['site-settings-history'],
    queryFn: () => settingsApi.history(),
  });

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string>) => settingsApi.update(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings-history'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (historyId: string) => settingsApi.restore(historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      queryClient.invalidateQueries({ queryKey: ['site-settings-history'] });
    },
  });

  const dirtyKeys = Object.keys(draft).filter(
    (k) => settings && draft[k] !== settings[k]
  );

  const save = () => {
    const values: Record<string, string> = {};
    dirtyKeys.forEach((k) => { values[k] = draft[k]; });
    if (Object.keys(values).length > 0) saveMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Site Content</h1>
          <p className="text-muted-foreground mt-1">
            Texts and links shown to visitors - no code changes needed
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          {saveMutation.isError && (
            <span className="text-sm text-destructive">Save failed - check values</span>
          )}
          <Button
            onClick={save}
            disabled={dirtyKeys.length === 0 || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save {dirtyKeys.length > 0 ? `(${dirtyKeys.length})` : ''}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Homepage & Links</CardTitle>
          <CardDescription>Hero texts, announcement banner and social links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key}>{f.label}</Label>
              {f.multiline ? (
                <textarea
                  id={f.key}
                  className="w-full min-h-[120px] px-3 py-2 border rounded-md bg-background text-sm"
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  id={f.key}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              )}
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Settings</CardTitle>
          <CardDescription>What visitors see</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOGGLES.map((t) => {
            const on = (draft[t.key] ?? 'false') === 'true';
            return (
              <div key={t.key} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.hint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setDraft({ ...draft, [t.key]: on ? 'false' : 'true' })}
                  className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change History</CardTitle>
          <CardDescription>Every save is recorded and can be restored</CardDescription>
        </CardHeader>
        <CardContent>
          {!historyData?.history?.length ? (
            <p className="text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <div className="space-y-2">
              {historyData.history.slice(0, 20).map((h: SettingsHistoryEntry) => (
                <div key={h.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{h.key}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {h.old_value === null ? '(new)' : `"${h.old_value}"`} → "{h.new_value}"
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.changed_at).toLocaleString()}{h.changed_by ? ` · ${h.changed_by}` : ''}
                    </p>
                  </div>
                  {h.old_value !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate(h.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

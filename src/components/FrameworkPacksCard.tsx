import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { authHeaders } from '../lib/authHeaders';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import {
  FRAMEWORK_PACKS,
  diffPacks,
  getCurrentPack,
  listPacksForFramework,
  packsNeedingUpgradeNotice,
  type FrameworkPack,
} from '../lib/vendor/frameworkPacks';
import { SAFE_PACK_BASELINE } from '../lib/vendor/safePackWording';
import {
  loadOrgFrameworkPackDefaults,
  saveOrgFrameworkPackDefaults,
  type FrameworkPackDefaults,
} from '../lib/vendor/orgFrameworkPacks';
import type { FrameworkId } from '../lib/vendor/types';

const MANAGED_FRAMEWORKS: FrameworkId[] = [
  'nist_csf_2',
  'iso27001',
  'soc2',
  'hipaa',
  'pci_dss_4',
  'cis_controls',
];

type AiMapSuggestion = {
  fromControlKey: string;
  toControlKey: string | null;
  confidence: number;
  rationale: string;
  needsReview: boolean;
};

export function FrameworkPacksCard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const orgId = profile?.organizationId;
  const [defaults, setDefaults] = useState<FrameworkPackDefaults>({});
  const [draft, setDraft] = useState<FrameworkPackDefaults>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<
    Record<string, AiMapSuggestion[]>
  >({});

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    void loadOrgFrameworkPackDefaults(orgId)
      .then((loaded) => {
        const seeded: FrameworkPackDefaults = { ...loaded };
        for (const fw of MANAGED_FRAMEWORKS) {
          if (!seeded[fw]) {
            const current = getCurrentPack(fw);
            if (current) seeded[fw] = current.packId;
          }
        }
        setDefaults(seeded);
        setDraft(seeded);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  const notices = useMemo(() => packsNeedingUpgradeNotice(defaults), [defaults]);

  const handleSave = async () => {
    if (!orgId || !isAdmin) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await saveOrgFrameworkPackDefaults(orgId, draft);
      setDefaults(draft);
      setMessage('Default packs saved. New assessments use these versions; existing ones stay pinned.');
    } catch (e: any) {
      setError(e?.message || 'Could not save pack defaults.');
    } finally {
      setSaving(false);
    }
  };

  const acceptCurrent = (frameworkId: FrameworkId, pack: FrameworkPack) => {
    setDraft((d) => ({ ...d, [frameworkId]: pack.packId }));
  };

  const runAiMapping = async (fromPackId: string, toPackId: string) => {
    setAiBusy(fromPackId);
    setError('');
    try {
      const diff = diffPacks(fromPackId, toPackId);
      const headers = await authHeaders();
      const res = await fetch('/api/ai/framework-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          fromPackId,
          toPackId,
          removed: diff.removed,
          added: diff.added,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Mapping failed (${res.status})`);
      }
      const data = await res.json();
      setAiSuggestions((prev) => ({
        ...prev,
        [fromPackId]: Array.isArray(data.mappings) ? data.mappings : [],
      }));
    } catch (e: any) {
      setError(e?.message || 'AI mapping failed.');
    } finally {
      setAiBusy(null);
    }
  };

  if (!orgId) return null;

  return (
    <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Framework pack versions
        </CardTitle>
        <CardDescription>
          {SAFE_PACK_BASELINE} Existing assessments keep their stamped pack;
          only new questionnaires use the defaults you accept here.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading packs…
          </div>
        ) : (
          <>
            {notices.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm font-medium text-amber-200">
                  Newer framework versions available
                </p>
                {notices.map(({ pinnedPackId, current, diff }) => (
                  <div key={pinnedPackId} className="text-xs text-slate-300 space-y-2">
                    <p>
                      <span className="font-mono text-slate-400">{pinnedPackId}</span>
                      {' → '}
                      <span className="font-mono text-white">{current.packId}</span>
                      {' · '}
                      +{diff.added.length} / −{diff.removed.length} controls
                    </p>
                    <p className="text-slate-500">{current.changelog}</p>
                    <div className="flex flex-wrap gap-2">
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-amber-500/40"
                          onClick={() => acceptCurrent(current.frameworkId, current)}
                        >
                          Review &amp; pin {current.displayName}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-slate-400"
                        disabled={aiBusy === pinnedPackId}
                        onClick={() => void runAiMapping(pinnedPackId, current.packId)}
                      >
                        {aiBusy === pinnedPackId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                        )}
                        AI suggest pack mapping
                      </Button>
                    </div>
                    {aiSuggestions[pinnedPackId]?.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-white/5 pt-2 max-h-40 overflow-y-auto">
                        {aiSuggestions[pinnedPackId].map((m) => (
                          <li key={`${m.fromControlKey}-${m.toControlKey}`} className="text-[11px] text-slate-400">
                            <span className="font-mono text-slate-500">{m.fromControlKey}</span>
                            {' → '}
                            <span className="font-mono text-slate-300">{m.toControlKey || 'needs review'}</span>
                            {m.needsReview ? ' (review)' : ''}
                            {m.rationale ? ` — ${m.rationale}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {MANAGED_FRAMEWORKS.map((fw) => {
                const packs = listPacksForFramework(fw);
                const selected = draft[fw] || getCurrentPack(fw)?.packId || '';
                return (
                  <div key={fw} className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest w-36 shrink-0">
                      {fw}
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={selected}
                      onChange={(e) => setDraft((d) => ({ ...d, [fw]: e.target.value }))}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-slate-300 [&>option]:bg-slate-950 [&>option]:text-white"
                    >
                      {packs.map((p) => (
                        <option key={p.packId} value={p.packId}>
                          {p.displayName} ({p.status})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {isAdmin ? (
              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-11"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save pack defaults'}
              </Button>
            ) : (
              <p className="text-xs text-slate-500">Only organization admins can change pack defaults.</p>
            )}

            {message && <p className="text-xs text-emerald-400">{message}</p>}
            {error && <p className="text-xs text-rose-400">{error}</p>}

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Library ships {FRAMEWORK_PACKS.length} packs. Content updates are released by Guardentra —
              standards are never auto-downloaded into your tenant.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

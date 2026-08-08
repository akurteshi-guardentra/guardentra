import React, { useEffect, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';
import {
  assertDataRegionImmutable,
  isDataRegion,
  type DataRegion,
} from '../lib/orgRegion';

/** Show / one-time set organization dataRegion (P2B prep). */
export function DataRegionCard() {
  const { profile } = useAuth();
  const orgId = profile?.organizationId;
  const isAdmin = profile?.role === 'admin';
  const [region, setRegion] = useState<DataRegion | null>(null);
  const [draft, setDraft] = useState<DataRegion>('us');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, 'organizations', orgId)).then((snap) => {
      if (cancelled) return;
      const raw = snap.data()?.dataRegion;
      if (isDataRegion(raw)) {
        setRegion(raw);
        setDraft(raw);
      } else {
        setRegion(null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const pinRegion = async () => {
    if (!orgId || !isAdmin) return;
    const check = assertDataRegionImmutable(region, draft);
    if (!check.ok) {
      setMessage(check.error);
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'organizations', orgId), { dataRegion: draft });
      setRegion(draft);
      setMessage(`Data region pinned to ${draft.toUpperCase()}. This cannot be changed.`);
    } catch (err: any) {
      setMessage(err?.message || 'Could not set data region');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Globe className="h-5 w-5 text-primary" />
          Data region
        </CardTitle>
        <CardDescription>
          Residency pin for future EU/US Firebase isolation. Dual projects are not live yet; the
          field is immutable once set.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : region ? (
          <p className="text-sm text-slate-200">
            Current region: <span className="font-semibold text-white">{region.toUpperCase()}</span>{' '}
            (locked)
          </p>
        ) : (
          <>
            <label className="block text-sm text-slate-400">
              Choose once
              <select
                value={draft}
                disabled={!isAdmin}
                onChange={(e) => setDraft(e.target.value as DataRegion)}
                className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white"
              >
                <option value="us">US</option>
                <option value="eu">EU</option>
              </select>
            </label>
            <Button type="button" disabled={!isAdmin || saving} onClick={() => void pinRegion()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Pin data region
            </Button>
          </>
        )}
        {message ? <p className="text-xs text-slate-400">{message}</p> : null}
      </CardContent>
    </Card>
  );
}

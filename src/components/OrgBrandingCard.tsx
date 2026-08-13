import React, { useEffect, useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';

/**
 * SaaS tenant branding shown on the vendor portal (requesting company logo + name).
 * Each paying org configures this once; vendors see the customer's brand, not Guardentra alone.
 */
export function OrgBrandingCard() {
  const { profile } = useAuth();
  const orgId = profile?.organizationId;
  const isAdmin = profile?.role === 'admin';
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
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
      const data = snap.data() || {};
      setName(typeof data.name === 'string' ? data.name : '');
      setLogoUrl(typeof data.logoUrl === 'string' ? data.logoUrl : '');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const save = async () => {
    if (!orgId || !isAdmin) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage('Organization name is required.');
      return;
    }
    const trimmedLogo = logoUrl.trim();
    if (trimmedLogo && !/^https:\/\//i.test(trimmedLogo)) {
      setMessage('Logo URL must start with https://');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        name: trimmedName,
        logoUrl: trimmedLogo || null,
      });
      setMessage('Saved. New assessment invites will show this brand on the vendor portal.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not save branding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Company brand (vendor portal)
        </CardTitle>
        <CardDescription>
          When you invite vendors through Guardentra SaaS, they see your company name and logo on
          the questionnaire — not a generic Guardentra-only screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-6 w-6 text-slate-500" />
                )}
              </div>
              <p className="text-xs text-slate-500">Preview</p>
            </div>
            <label className="block text-sm text-slate-400">
              Company name
              <Input
                value={name}
                disabled={!isAdmin}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 border-white/10 bg-black/20 text-white"
                placeholder="Acme Corp"
              />
            </label>
            <label className="block text-sm text-slate-400">
              Logo URL (https)
              <Input
                value={logoUrl}
                disabled={!isAdmin}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="mt-2 border-white/10 bg-black/20 text-white"
                placeholder="https://cdn.example.com/logo.png"
              />
            </label>
            <Button type="button" disabled={!isAdmin || saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save brand
            </Button>
            {message ? <p className="text-xs text-slate-400">{message}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

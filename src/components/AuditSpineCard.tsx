import React, { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../lib/AuthContext';
import { authHeaders } from '../lib/authHeaders';
import { emitAuditBestEffort } from '../lib/auditClient';

/** Settings control for Phase 2 audit spine verify + export. */
export function AuditSpineCard() {
  const { user, profile } = useAuth();
  const orgId = profile?.organizationId;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<'ok' | 'warn' | 'err'>('ok');

  const verify = async () => {
    if (!orgId) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(`/api/audit/verify?tenantId=${encodeURIComponent(orgId)}`, {
        headers: await authHeaders(),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setTone('warn');
        setMessage('Audit spine disabled. Set AUDIT_SPINE_ENABLED=true and AUDIT_DATABASE_URL locally.');
        return;
      }
      if (!res.ok) {
        setTone('err');
        setMessage(body.error || `Verify failed (${res.status})`);
        return;
      }
      const ok = Boolean(body.ok);
      setTone(ok ? 'ok' : 'err');
      setMessage(
        ok
          ? body.message || `Chain OK — ${body.checked ?? 0} link(s).`
          : body.message || body.error || 'Chain verification failed'
      );
      void emitAuditBestEffort({
        tenantId: orgId,
        eventType: 'audit.chain_verified',
        actorId: user?.uid || null,
        objectType: 'organization',
        objectId: orgId,
        payload: { ok, checked: body.checked ?? null },
      });
    } catch (err: any) {
      setTone('err');
      setMessage(err?.message || 'Verify request failed');
    } finally {
      setBusy(false);
    }
  };

  const exportTrail = async (format: 'json' | 'csv') => {
    if (!orgId) return;
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch(
        `/api/audit/export?tenantId=${encodeURIComponent(orgId)}&format=${format}`,
        { headers: await authHeaders() }
      );
      if (res.status === 503) {
        setTone('warn');
        setMessage('Audit spine disabled — export unavailable.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setTone('err');
        setMessage(body.error || `Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-${orgId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setTone('ok');
      setMessage(`Exported audit trail (${format}).`);
    } catch (err: any) {
      setTone('err');
      setMessage(err?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Audit spine
        </CardTitle>
        <CardDescription>
          Verify the tamper-evident Postgres hash chain and export the redacted trail for this
          organization. Requires local/staging Cloud SQL when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !orgId} onClick={() => void verify()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Verify chain
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            disabled={busy || !orgId}
            onClick={() => void exportTrail('json')}
          >
            Export JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/10"
            disabled={busy || !orgId}
            onClick={() => void exportTrail('csv')}
          >
            Export CSV
          </Button>
        </div>
        {message ? (
          <p
            className={
              tone === 'ok'
                ? 'text-sm text-emerald-300'
                : tone === 'warn'
                  ? 'text-sm text-amber-200'
                  : 'text-sm text-rose-300'
            }
          >
            {message}
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            See docs/FASTTRACK_PHASE2.md for tamper test: mutate a hash as migrator → verify must fail.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

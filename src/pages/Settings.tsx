import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Users,
  Mail,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuth } from '../lib/AuthContext';
import {
  createOrgInvite,
  listenOrgInvites,
  revokeOrgInvite,
  type OrgInviteRole,
  type OrgInviteRow,
} from '../lib/orgInvites';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/brand';
import { FrameworkPacksCard } from '../components/FrameworkPacksCard';
import { AuditSpineCard } from '../components/AuditSpineCard';
import { DataRegionCard } from '../components/DataRegionCard';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function TeamMembersCard() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [invites, setInvites] = useState<OrgInviteRow[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgInviteRole>('member');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!profile?.organizationId) return;
    return listenOrgInvites(profile.organizationId, setInvites);
  }, [profile?.organizationId]);

  const handleInvite = async () => {
    setError('');
    setSent(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter an email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!profile?.organizationId) return;
    setSending(true);
    try {
      await createOrgInvite({
        organizationId: profile.organizationId,
        email: trimmed,
        role,
        invitedByEmail: user?.email || undefined,
      });
      setEmail('');
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Could not send invite.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Team Members
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Invite a teammate by email — they join this organization instead of creating their own when they sign up with the same address.'
            : 'Only organization admins can invite teammates. Contact your admin.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {isAdmin && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-black/20 border-white/10 text-white"
              />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgInviteRole)}
              className="bg-slate-950 border border-white/10 rounded-xl h-10 px-3 text-sm text-slate-300 [&>option]:bg-slate-950 [&>option]:text-white"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button onClick={handleInvite} disabled={sending} className="bg-primary text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
            </Button>
          </div>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
        {sent && <p className="text-xs text-emerald-400">Invite created. Ask them to sign up using this exact email.</p>}

        {isAdmin && invites.length > 0 && (
          <div className="space-y-2 pt-2">
            {invites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-slate-200">{inv.email}</span>{' '}
                  <span className="text-slate-500">({inv.role})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      inv.status === 'pending'
                        ? 'text-amber-400 text-xs'
                        : inv.status === 'accepted'
                        ? 'text-emerald-400 text-xs'
                        : 'text-slate-500 text-xs'
                    }
                  >
                    {inv.status}
                  </span>
                  {inv.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => revokeOrgInvite(inv.id)}
                      className="text-slate-500 hover:text-rose-400"
                      aria-label="Revoke invite"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Settings() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2 flex items-center gap-3">
          <SettingsIcon className="h-10 w-10 text-primary" />
          Settings
        </h1>
        <p className="text-slate-400 text-lg">
          Team access, framework pack defaults, and product support.
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        <FrameworkPacksCard />
        <DataRegionCard />
        <AuditSpineCard />
        <TeamMembersCard />

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Product support
            </CardTitle>
            <CardDescription>Questions about Guardentra, billing, or your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-400">
              Email us at{' '}
              <a
                href={SUPPORT_MAILTO}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/20 border-dashed border-white/10">
          <CardContent className="p-5 text-xs text-slate-500 leading-relaxed">
            Coming later: AI Copilot tuning, MFA, storage quotas, and notification engine
            controls are not persisted yet — they will return when those modules ship. Use
            Team Members and Framework pack versions above for live workspace settings.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

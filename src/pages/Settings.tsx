import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Cpu,
  Shield,
  Bell,
  Database,
  Lock,
  Eye,
  Sparkles,
  Command,
  Save,
  Loader2,
  Globe,
  Users,
  Mail,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { motion } from 'framer-motion';
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
              className="bg-black/40 border border-white/10 rounded-xl h-10 px-3 text-sm text-slate-300"
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
  const [isSaving, setIsSaving] = useState(false);
  const [copilotVerbosity, setCopilotVerbosity] = useState('concise');
  const [enableAutoScan, setEnableAutoScan] = useState(true);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
    }, 1200);
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display mb-2 flex items-center gap-3">
            <SettingsIcon className="h-10 w-10 text-primary" />
            System Preferences
          </h1>
          <p className="text-slate-400 text-lg">Configure AI behavior, tenant security, and automated scanning.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="bg-primary text-white px-8">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation / Categories */}
        <div className="space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20 text-white font-bold transition-all">
            <Cpu className="h-5 w-5 text-primary" />
            AI Copilot Tuning
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent text-slate-400 transition-all">
            <Shield className="h-5 w-5" />
            Security & MFA
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent text-slate-400 transition-all">
            <Database className="h-5 w-5" />
            Storage Quotas
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 border border-transparent text-slate-400 transition-all">
            <Bell className="h-5 w-5" />
            Notification Engine
          </button>
        </div>

        {/* Setting Panels */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Copilot Tuning
              </CardTitle>
              <CardDescription>Adjust the strategic reasoning and assistant parameters.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Verbosity Level</label>
                <div className="flex gap-2">
                  {['Concise', 'Balanced', 'Deep Analysis'].map(v => (
                    <button 
                      key={v}
                      onClick={() => setCopilotVerbosity(v.toLowerCase())}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all",
                        copilotVerbosity === v.toLowerCase() ? "bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "bg-black/20 border-white/5 text-slate-400 hover:border-white/10"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">Automated Risk Scanning</h4>
                  <p className="text-xs text-slate-500 italic pr-8">AI periodically scans connectors for new vulnerabilities without manual trigger.</p>
                </div>
                <button 
                  onClick={() => setEnableAutoScan(!enableAutoScan)}
                  className={cn(
                    "w-12 h-6 rounded-full p-1 transition-colors duration-300",
                    enableAutoScan ? "bg-primary" : "bg-slate-800"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm",
                    enableAutoScan ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Internal Model Bias</label>
                <select className="w-full bg-black/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-slate-300">
                  <option>Risk-Averse (Default)</option>
                  <option>Growth & Agility Focused</option>
                  <option>Compliance Regulatory Strict</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-500" />
                Regional Data Residency
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex items-center gap-4 text-emerald-400 text-xs font-mono bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                <Globe className="h-4 w-4" />
                Data currently homed in: EU-West-2 (London)
              </div>
              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                As part of your GRC commitment, data storage locations are immutable after registration. To migrate
                regions, please contact{' '}
                <a
                  href={SUPPORT_MAILTO}
                  className="text-slate-400 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </CardContent>
          </Card>

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

          <FrameworkPacksCard />

          <TeamMembersCard />
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

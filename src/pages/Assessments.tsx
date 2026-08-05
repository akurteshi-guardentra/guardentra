import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  X,
  Mail,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { motion } from 'framer-motion';
import { authHeaders } from '../lib/authHeaders';
import { cn } from '../lib/utils';
import { useOrgAssessments } from '../lib/vendor/useOrgAssessments';
import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import { sendEmail } from '../lib/notifications';
import {
  deriveStatusFromAssessments,
  upsertLocalAssessment,
  type StoredAssessment,
} from '../lib/vendor/localAssessmentStore';
import { FRAMEWORK_CATALOG } from '../lib/vendor/constants';
import { packsNeedingUpgradeNotice } from '../lib/vendor/frameworkPacks';
import { loadOrgFrameworkPackDefaults } from '../lib/vendor/orgFrameworkPacks';
import { syncVendorAfterAssessmentApprove } from '../lib/vendor/syncVendorAssessment';
import {
  exceptionReasonLabel,
  listAssessmentExceptions,
  type DecisionOutcome,
} from '../lib/vendor/assessmentExceptions';

const SELECT_CLASS =
  'h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white [&>option]:bg-slate-950 [&>option]:text-white';

function frameworkLabel(a: StoredAssessment): string {
  if (a.frameworkName) {
    // Historical creates may include "Custom Questionnaire" in the joined name — hide the stub.
    const cleaned = a.frameworkName
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !/^custom/i.test(s))
      .join(', ');
    if (cleaned) return cleaned;
  }
  if (a.frameworks?.length) {
    const names = a.frameworks
      .filter((id) => id !== 'custom')
      .map((id) => FRAMEWORK_CATALOG.find((f) => f.id === id)?.name || id);
    if (names.length) return names.join(', ');
  }
  return 'Assessment';
}

function progressOf(a: StoredAssessment): number {
  return a.progressPct ?? a.progress ?? 0;
}

function dueLabel(a: StoredAssessment): string {
  return a.dueDate || (a.dueAt ? a.dueAt.slice(0, 10) : '—');
}

/** Tracker status aligned with vendor directory chips (due/overdue derivation). */
function rowStatus(a: StoredAssessment): string {
  return (
    deriveStatusFromAssessments([
      {
        status: a.status,
        dueAt: a.dueAt,
        dueDate: a.dueDate,
        progressPct: progressOf(a),
        progress: progressOf(a),
      },
    ]) || a.status
  );
}

/** answers are string for yesno/single_choice, string[] for multiple_choice. */
function formatAssessmentAnswer(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'No Answer';
  return value || 'No Answer';
}

export function Assessments() {
  const { profile, loading: authLoading } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';
  const createdId = params.get('created') || '';

  const { assessments, mode, loading, refreshLocal } = useOrgAssessments(orgId);
  const { vendors } = useOrgVendors(orgId);

  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState(presetVendorId || 'all');
  const [reviewAssessment, setReviewAssessment] = useState<StoredAssessment | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reminderState, setReminderState] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});
  const [packNotices, setPackNotices] = useState<
    ReturnType<typeof packsNeedingUpgradeNotice>
  >([]);
  const [toast, setToast] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [reviewAnalysis, setReviewAnalysis] = useState<{
    summary: string;
    rating: string;
    recommendation: string;
  } | null>(null);
  const [reviewAiError, setReviewAiError] = useState('');
  const [reviewAiLoading, setReviewAiLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'exceptions' | 'all'>('exceptions');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionOutcome, setDecisionOutcome] = useState<DecisionOutcome>('approved');

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!orgId) return;
    void loadOrgFrameworkPackDefaults(orgId).then((defaults) => {
      setPackNotices(packsNeedingUpgradeNotice(defaults));
    });
  }, [orgId]);

  const isLocalAssessment = (a: StoredAssessment) =>
    a.id.startsWith('local_asm_') || mode === 'local';

  const copyPortalLink = async (a: StoredAssessment) => {
    if (isLocalAssessment(a)) {
      setToast({
        tone: 'warn',
        text: 'Portal link available after cloud sync — wait for Firestore reconnect, then try again.',
      });
      return;
    }
    const url = `${window.location.origin}/portal/${a.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast({ tone: 'ok', text: `Portal link copied: ${url}` });
    } catch {
      setToast({ tone: 'err', text: 'Could not copy link — copy it manually from the address bar after opening.' });
    }
  };

  const handleSendReminder = async (assessment: StoredAssessment) => {
    if (isLocalAssessment(assessment)) {
      setToast({
        tone: 'warn',
        text: 'Reminders need a cloud assessment id. Wait for sync, then send again.',
      });
      setReminderState((prev) => ({ ...prev, [assessment.id]: 'error' }));
      return;
    }
    const vendor = vendors.find((v) => v.id === assessment.vendorId);
    if (!vendor?.primaryContactEmail) {
      setReminderState((prev) => ({ ...prev, [assessment.id]: 'error' }));
      setToast({ tone: 'err', text: 'Add a primary contact email on the vendor before sending a reminder.' });
      return;
    }
    setReminderState((prev) => ({ ...prev, [assessment.id]: 'sending' }));
    try {
      const portalUrl = `${window.location.origin}/portal/${assessment.id}`;
      const due = assessment.dueAt || assessment.dueDate;
      await sendEmail({
        to: vendor.primaryContactEmail,
        subject: `Reminder: security assessment pending — ${assessment.vendorName || vendor.name}`,
        text: `Hi${vendor.primaryContactName ? ` ${vendor.primaryContactName}` : ''},\n\nThis is a reminder that a security assessment (${frameworkLabel(assessment)}) is still awaiting your response.\n\nComplete it here: ${portalUrl}\n${due ? `\nDue: ${new Date(due).toLocaleDateString()}\n` : ''}\nYour progress saves automatically.`,
      });
      setReminderState((prev) => ({ ...prev, [assessment.id]: 'sent' }));
      setToast({ tone: 'ok', text: `Reminder sent to ${vendor.primaryContactEmail}` });
    } catch (e) {
      console.warn('Send reminder failed', e);
      setReminderState((prev) => ({ ...prev, [assessment.id]: 'error' }));
      setToast({ tone: 'err', text: 'Reminder failed — check email delivery (Trigger Email extension) or try again.' });
    }
  };

  useEffect(() => {
    if (presetVendorId) setVendorFilter(presetVendorId);
  }, [presetVendorId]);

  useEffect(() => {
    if (!createdId || createdId.startsWith('local_')) return;
    const url = `${window.location.origin}/portal/${createdId}`;
    setToast({ tone: 'ok', text: `Assessment created. Portal link ready — copy from the row actions: ${url}` });
    // Drop ?created= so refresh doesn't re-toast
    const next = new URLSearchParams(params);
    next.delete('created');
    setParams(next, { replace: true });
  }, [createdId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assessments.filter((a) => {
      if (vendorFilter !== 'all' && a.vendorId !== vendorFilter) return false;
      if (!q) return true;
      const hay = `${a.vendorName || ''} ${frameworkLabel(a)} ${a.status || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assessments, search, vendorFilter]);

  const vendorOptions = useMemo(() => {
    const fromAsm = assessments.map((a) => ({ id: a.vendorId, name: a.vendorName || a.vendorId }));
    const map = new Map<string, string>();
    vendors.forEach((v) => map.set(v.id, v.name));
    fromAsm.forEach((v) => {
      if (v.id && !map.has(v.id)) map.set(v.id, v.name);
    });
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assessments, vendors]);

  const clearVendorFilter = () => {
    setVendorFilter('all');
    if (params.has('vendorId')) {
      params.delete('vendorId');
      setParams(params, { replace: true });
    }
  };

  const handleReviewAssessment = async (assessment: StoredAssessment) => {
    setReviewAssessment(assessment);
    setReviewAnalysis(null);
    setReviewAiError('');
    setReviewFilter('exceptions');
    setDecisionNotes('');
    setDecisionOutcome('approved');
    setIsReviewing(true);

    const answerEntries = Object.entries(assessment.answers || {}).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : Boolean(v)
    );
    const hasAnswers = answerEntries.length > 0 || progressOf(assessment) > 0;
    if (!hasAnswers) {
      setReviewAiError('Waiting for vendor responses before AI analysis is available.');
      return;
    }

    setReviewAiLoading(true);
    try {
      const questions = (assessment.questions || []) as { id: string; question?: string }[];
      const answers = questions
        .map((q) => `${q.question}: ${formatAssessmentAnswer(assessment.answers?.[q.id])}`)
        .join('\n');
      const prompt = `Analyze vendor assessment for "${assessment.vendorName}" against "${frameworkLabel(assessment)}".
        Answers:
        ${answers}

        Provide a risk summary, an overall security rating (A-F), and one primary recommendation.
        Return JSON: { "summary": "...", "rating": "...", "recommendation": "..." }`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prompt, responseMimeType: 'application/json' }),
      });
      if (!response.ok) throw new Error('AI generation failed');
      const { text } = await response.json();
      setReviewAnalysis(JSON.parse(text || '{}'));
    } catch (e) {
      console.error('AI Review failed:', e);
      setReviewAiError('AI analysis failed — you can still review answers and sign off manually.');
    } finally {
      setReviewAiLoading(false);
    }
  };

  const reviewExceptions = useMemo(() => {
    if (!reviewAssessment) return [];
    const questions = ((reviewAssessment.questions || []) as {
      id?: string;
      question?: string;
      category?: string;
      required?: boolean;
    }[]).map((q) => ({
      id: q.id || '',
      question: q.question,
      category: q.category,
      required: q.required,
    }));
    return listAssessmentExceptions({
      questions,
      answers: reviewAssessment.answers,
      evidenceByQuestion: reviewAssessment.evidenceByQuestion,
    });
  }, [reviewAssessment]);

  const handleDecideAssessment = async (outcome: DecisionOutcome) => {
    if (!reviewAssessment || !orgId) return;
    const canSignOff =
      reviewAssessment.status === 'Under Review' ||
      reviewAssessment.status === 'Completed' ||
      progressOf(reviewAssessment) > 0;
    if (!canSignOff) {
      setToast({
        tone: 'warn',
        text: 'Wait for the vendor to submit (or start answering) before signing off.',
      });
      return;
    }
    if ((outcome === 'conditional' || outcome === 'remediate') && !decisionNotes.trim()) {
      setToast({
        tone: 'warn',
        text: 'Add decision notes / conditions before continuing.',
      });
      return;
    }

    setApproving(true);
    const decidedAt = new Date().toISOString();
    const decidedBy = profile?.email || profile?.displayName || 'org-admin';
    const preferLocal = mode === 'local' || reviewAssessment.id.startsWith('local_');
    const closes =
      outcome === 'approved' || outcome === 'conditional' || outcome === 'rejected';

    const nextReview = new Date();
    if (outcome === 'conditional') {
      nextReview.setMonth(nextReview.getMonth() + 6);
    } else {
      nextReview.setFullYear(nextReview.getFullYear() + 1);
    }
    const nextReviewAt = nextReview.toISOString();

    const patch: Partial<StoredAssessment> & {
      decisionOutcome: DecisionOutcome;
      decidedAt: string;
      decidedBy: string;
      decisionNotes?: string;
    } = {
      decisionOutcome: outcome,
      decisionNotes: decisionNotes.trim() || undefined,
      decidedAt,
      decidedBy,
    };

    if (closes) {
      patch.status = 'Completed';
      patch.progressPct = 100;
      patch.progress = 100;
      patch.portalOpen = false;
      patch.completedAt = decidedAt;
    } else {
      // Remediate: keep open for vendor follow-up
      patch.status = 'Under Review';
      patch.portalOpen = true;
    }

    try {
      if (preferLocal) {
        upsertLocalAssessment(orgId, { ...reviewAssessment, ...patch });
        refreshLocal();
      } else {
        await updateDoc(doc(db, 'assessments', reviewAssessment.id), { ...patch });
      }

      if (closes) {
        await syncVendorAfterAssessmentApprove(
          orgId,
          reviewAssessment.vendorId,
          preferLocal,
          nextReviewAt
        );
      }

      const messages: Record<DecisionOutcome, string> = {
        approved: 'Approved. Next review scheduled in 12 months.',
        conditional: 'Conditionally approved. Next review in 6 months.',
        remediate: 'Remediation recorded. Assessment stays open for follow-up.',
        rejected: 'Rejected. Portal closed and vendor assessment marked complete.',
      };
      setToast({ tone: 'ok', text: messages[outcome] });
      setIsReviewing(false);
      setReviewAssessment(null);
    } catch (e) {
      console.error('Decision failed:', e);
      setToast({ tone: 'err', text: 'Decision failed — try again.' });
    } finally {
      setApproving(false);
    }
  };

  const activeCount = assessments.filter((a) => a.status !== 'Completed').length;
  const avgCompletion =
    assessments.length > 0
      ? Math.round(assessments.reduce((acc, curr) => acc + progressOf(curr), 0) / assessments.length)
      : 0;
  const overdueCount = assessments.filter((a) => {
    const status = deriveStatusFromAssessments([a]);
    return status === 'Overdue';
  }).length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white text-glow">
            Structured Assessments
          </h1>
          <p className="mt-1 text-slate-400">
            Vendor security questionnaires linked to your vendor register.
            {mode === 'local' && (
              <span className="ml-2 rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                Local store
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() =>
            navigate(
              vendorFilter !== 'all'
                ? `/assessments/triage?vendorId=${encodeURIComponent(vendorFilter)}`
                : '/assessments/triage'
            )
          }
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </div>

      {packNotices.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          <p className="font-medium text-amber-200">
            Newer framework pack{packNotices.length > 1 ? 's' : ''} available
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {packNotices
              .map((n) => `${n.pinnedPackId} → ${n.current.packId}`)
              .join(' · ')}
            . Existing assessments keep their stamped version. Review and pin defaults in{' '}
            <Link to="/settings" className="text-primary underline-offset-2 hover:underline">
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge variant="outline" className="mb-2 border-blue-500/20 bg-blue-500/10 text-blue-400">
            Active Assessments
          </Badge>
          <div className="text-3xl font-bold text-white">{activeCount}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge
            variant="outline"
            className="mb-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          >
            Avg Completion
          </Badge>
          <div className="text-3xl font-bold text-white">{avgCompletion}%</div>
        </Card>
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge variant="outline" className="mb-2 border-amber-500/20 bg-amber-500/10 text-amber-400">
            Overdue
          </Badge>
          <div className="text-3xl font-bold text-white">{overdueCount}</div>
        </Card>
        <Card className="flex flex-col items-center justify-center border-white/5 bg-slate-900/50 p-4 text-center">
          <Badge
            variant="outline"
            className="mb-2 border-purple-500/20 bg-purple-500/10 text-purple-400"
          >
            Linked Vendors
          </Badge>
          <div className="text-3xl font-bold text-white">{vendorOptions.length}</div>
        </Card>
      </div>

      <Card className="border-white/5 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">Assessment Tracker</CardTitle>
          <CardDescription className="text-slate-500">
            Monitor vendor response status — filter by vendor to see the correlation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assessments..."
                className="border-white/10 bg-black/20 pl-10 text-white"
              />
            </div>
            <select
              className={SELECT_CLASS}
              value={vendorFilter}
              onChange={(e) => {
                const v = e.target.value;
                setVendorFilter(v);
                if (v === 'all') {
                  clearVendorFilter();
                } else {
                  setParams({ vendorId: v }, { replace: true });
                }
              }}
              aria-label="Filter by vendor"
            >
              <option value="all">All vendors</option>
              {vendorOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {vendorFilter !== 'all' && (
              <Button type="button" variant="outline" className="border-white/10" onClick={clearVendorFilter}>
                Clear vendor filter
              </Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Vendor
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Framework
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Progress
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Due Date
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Loading assessments…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <p className="mb-3">
                        {assessments.length === 0
                          ? 'No assessments yet — pick a vendor in New Assessment.'
                          : 'No assessments match this filter.'}
                      </p>
                      <Button
                        className="bg-primary text-white hover:bg-primary/90"
                        onClick={() => navigate('/assessments/triage')}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Assessment
                      </Button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr key={a.id} className="group transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                          </div>
                          <div>
                            <Link
                              to={`/vendors/${a.vendorId}/impact`}
                              className="text-sm font-bold text-white hover:text-primary hover:underline"
                            >
                              {a.vendorName || 'Vendor'}
                            </Link>
                            <p className="text-[10px] text-slate-500">Linked vendor</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant="outline"
                          className="border-indigo-500/20 font-mono text-[10px] uppercase tracking-tighter text-indigo-400"
                        >
                          {frameworkLabel(a)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            rowStatus(a) === 'Sent'
                              ? 'bg-amber-500/10 text-amber-400'
                              : rowStatus(a) === 'In Progress'
                                ? 'bg-blue-500/10 text-blue-400'
                                : rowStatus(a) === 'Under Review'
                                  ? 'bg-indigo-500/10 text-indigo-400'
                                  : rowStatus(a) === 'Completed'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : rowStatus(a) === 'Overdue'
                                      ? 'bg-rose-500/10 text-rose-400'
                                      : rowStatus(a) === 'Due Soon'
                                        ? 'bg-orange-500/10 text-orange-400'
                                        : 'bg-slate-500/10 text-slate-400'
                          )}
                        >
                          {rowStatus(a)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 max-w-[60px] flex-1 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full bg-primary" style={{ width: `${progressOf(a)}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">{progressOf(a)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs italic text-slate-500">{dueLabel(a)}</td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'mr-2 h-8 w-8 p-0 transition-colors',
                            isLocalAssessment(a)
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-slate-400 hover:text-primary'
                          )}
                          disabled={isLocalAssessment(a)}
                          onClick={() => void copyPortalLink(a)}
                          title={
                            isLocalAssessment(a)
                              ? 'Portal link available after cloud sync'
                              : 'Copy Vendor Portal Link'
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {a.status !== 'Completed' && a.status !== 'Under Review' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'mr-2 h-8 w-8 p-0 transition-colors',
                              reminderState[a.id] === 'sent'
                                ? 'text-emerald-400'
                                : reminderState[a.id] === 'error' || isLocalAssessment(a)
                                ? 'text-rose-400/70'
                                : 'text-slate-400 hover:text-primary'
                            )}
                            disabled={reminderState[a.id] === 'sending' || isLocalAssessment(a)}
                            onClick={() => void handleSendReminder(a)}
                            title={
                              isLocalAssessment(a)
                                ? 'Reminder available after cloud sync'
                                : reminderState[a.id] === 'sent'
                                ? 'Reminder sent'
                                : reminderState[a.id] === 'error'
                                ? 'Could not send — check vendor has a contact email'
                                : 'Send Reminder'
                            }
                          >
                            {reminderState[a.id] === 'sending' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : reminderState[a.id] === 'sent' ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 transition-colors hover:text-white"
                          onClick={() => void handleReviewAssessment(a)}
                          title="Review Assessment"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[200] max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl',
            toast.tone === 'ok' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
            toast.tone === 'warn' && 'border-amber-500/30 bg-amber-500/10 text-amber-100',
            toast.tone === 'err' && 'border-rose-500/30 bg-rose-500/10 text-rose-100'
          )}
        >
          {toast.text}
        </div>
      )}

      {isReviewing && reviewAssessment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-panel flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between border-b border-white/5 p-6">
              <div>
                <h2 className="mb-1 text-xl font-bold leading-none text-white">
                  {reviewAssessment.vendorName}
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
                  {frameworkLabel(reviewAssessment)} Review
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReviewing(false)}
                className="text-slate-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="space-y-8 lg:col-span-2">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Response Intelligence
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                        {reviewExceptions.length} exception
                        {reviewExceptions.length === 1 ? '' : 's'}
                      </span>
                      <div className="inline-flex rounded-lg border border-white/10 p-0.5">
                        <button
                          type="button"
                          className={cn(
                            'rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                            reviewFilter === 'exceptions'
                              ? 'bg-primary/20 text-primary'
                              : 'text-slate-500 hover:text-slate-300'
                          )}
                          onClick={() => setReviewFilter('exceptions')}
                        >
                          Exceptions
                        </button>
                        <button
                          type="button"
                          className={cn(
                            'rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                            reviewFilter === 'all'
                              ? 'bg-primary/20 text-primary'
                              : 'text-slate-500 hover:text-slate-300'
                          )}
                          onClick={() => setReviewFilter('all')}
                        >
                          All answers
                        </button>
                      </div>
                    </div>
                  </div>
                  {progressOf(reviewAssessment) === 0 &&
                  !Object.keys(reviewAssessment.answers || {}).length ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
                      <p className="text-sm font-medium text-amber-100">
                        Vendor has not started this assessment yet.
                      </p>
                      <p className="text-xs text-slate-400">
                        Share the portal link so they can answer. Review will show responses here once
                        progress moves above 0%.
                      </p>
                      {!isLocalAssessment(reviewAssessment) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-500/40 text-amber-100"
                          onClick={() => void copyPortalLink(reviewAssessment)}
                        >
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          Copy portal link
                        </Button>
                      )}
                    </div>
                  ) : reviewFilter === 'exceptions' ? (
                    <>
                      {reviewExceptions.length === 0 ? (
                        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
                          No exceptions flagged — answers look complete. Switch to All answers for a
                          full walkthrough.
                        </p>
                      ) : (
                        reviewExceptions.map((ex, idx) => (
                          <div key={`${ex.id}-${ex.reason}`} className="space-y-3">
                            <div className="flex gap-4">
                              <span className="mt-1 font-mono text-xs text-slate-700">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <div className="flex-1">
                                <p className="mb-2 text-sm font-medium text-slate-200">{ex.question}</p>
                                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                  <p className="text-sm font-medium text-amber-100">
                                    {ex.reason === 'unanswered'
                                      ? 'No response provided.'
                                      : formatAssessmentAnswer(ex.answer)}
                                  </p>
                                  <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-400/80">
                                    {exceptionReasonLabel(ex.reason)}
                                  </p>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="border-white/5 px-1 py-0 text-[9px] text-slate-500"
                                  >
                                    {ex.category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  ) : (
                    <>
                      {((reviewAssessment.questions || []) as {
                        id?: string;
                        question?: string;
                        category?: string;
                      }[]).map((q, idx) => (
                        <div key={q.id || idx} className="space-y-3">
                          <div className="flex gap-4">
                            <span className="mt-1 font-mono text-xs text-slate-700">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1">
                              <p className="mb-2 text-sm font-medium text-slate-200">{q.question}</p>
                              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                                <p className="text-sm font-medium text-primary">
                                  {q.id && reviewAssessment.answers?.[q.id]
                                    ? formatAssessmentAnswer(reviewAssessment.answers[q.id])
                                    : 'No response provided.'}
                                </p>
                              </div>
                              {q.category && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="border-white/5 px-1 py-0 text-[9px] text-slate-500"
                                  >
                                    {q.category}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!(reviewAssessment.questions || []).length && (
                        <p className="text-sm text-slate-500">No question responses yet.</p>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">AI Risk Audit</h3>
                  <Card className="overflow-hidden border-indigo-500/20 bg-indigo-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm font-bold text-indigo-400">
                        <Sparkles className="h-4 w-4" />
                        Automated Scoring
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!reviewAnalysis ? (
                        <div className="flex items-center gap-3 py-4 text-xs italic text-slate-500">
                          {reviewAiLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Running AI analysis…
                            </>
                          ) : (
                            reviewAiError || 'Analysis available after vendor responds.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs text-slate-400">Risk Rating</span>
                            <span
                              className={cn(
                                'font-mono text-3xl font-black',
                                ['A', 'B'].includes(reviewAnalysis.rating)
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              )}
                            >
                              {reviewAnalysis.rating}
                            </span>
                          </div>
                          <p className="border-l-2 border-primary py-1 pl-3 text-[11px] italic leading-relaxed text-slate-300">
                            &quot;{reviewAnalysis.summary}&quot;
                          </p>
                          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
                            <p className="mb-1 text-[9px] font-bold uppercase text-indigo-300">
                              CISO Recommendation
                            </p>
                            <p className="text-[10px] text-slate-300">{reviewAnalysis.recommendation}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                    <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">
                      Decision Terminal
                    </h4>
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {(
                        [
                          ['approved', 'Approve'],
                          ['conditional', 'Conditional'],
                          ['remediate', 'Remediate'],
                          ['rejected', 'Reject'],
                        ] as const
                      ).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setDecisionOutcome(id)}
                          className={cn(
                            'rounded-lg border px-2 py-2 text-[11px] font-bold uppercase tracking-wide',
                            decisionOutcome === id
                              ? 'border-primary bg-primary/20 text-primary'
                              : 'border-white/10 text-slate-400 hover:bg-white/5'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder={
                        decisionOutcome === 'conditional' || decisionOutcome === 'remediate'
                          ? 'Required: conditions / remediation notes…'
                          : 'Optional notes for the audit trail…'
                      }
                      className="mb-3 min-h-[72px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600"
                    />
                    <div className="space-y-3">
                      <Button
                        className={cn(
                          'w-full font-bold text-white disabled:opacity-40',
                          decisionOutcome === 'rejected'
                            ? 'bg-rose-600 hover:bg-rose-500'
                            : decisionOutcome === 'remediate'
                              ? 'bg-amber-600 hover:bg-amber-500'
                              : 'bg-emerald-600 hover:bg-emerald-500'
                        )}
                        disabled={
                          approving ||
                          !reviewAssessment ||
                          (reviewAssessment.status !== 'Under Review' &&
                            reviewAssessment.status !== 'Completed' &&
                            progressOf(reviewAssessment) <= 0)
                        }
                        onClick={() => void handleDecideAssessment(decisionOutcome)}
                      >
                        {approving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        {decisionOutcome === 'approved' && 'Approve & close'}
                        {decisionOutcome === 'conditional' && 'Conditional approve'}
                        {decisionOutcome === 'remediate' && 'Record remediation'}
                        {decisionOutcome === 'rejected' && 'Reject & close'}
                      </Button>
                      {reviewAssessment &&
                        reviewAssessment.status !== 'Under Review' &&
                        progressOf(reviewAssessment) <= 0 && (
                          <p className="text-[10px] text-slate-500">
                            Enabled after the vendor starts answering or submits for review.
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

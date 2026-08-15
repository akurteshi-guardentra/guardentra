import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { PageBand } from '../components/spine/PageShell';
import { AssessmentsPageHeader, AssessmentsStatsGrid } from '../components/assessments/AssessmentsTop';
import { AssessmentTrackerTable } from '../components/assessments/AssessmentTrackerTable';

const AssessmentReviewPanel = lazy(() =>
  import('../components/assessments/AssessmentReviewPanel').then((m) => ({
    default: m.AssessmentReviewPanel,
  }))
);
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
import { approvalBlockedByUntrustedEvidence } from '../lib/vendor/evidenceTrust';
import { FRAMEWORK_CATALOG } from '../lib/vendor/constants';
import { packsNeedingUpgradeNotice } from '../lib/vendor/frameworkPacks';
import {
  loadOrgFrameworkPackDefaults,
  type FrameworkPackDefaults,
} from '../lib/vendor/orgFrameworkPacks';
import { syncVendorAfterAssessmentApprove } from '../lib/vendor/syncVendorAssessment';
import {
  listAssessmentExceptions,
  type DecisionOutcome,
} from '../lib/vendor/assessmentExceptions';
import {
  buildOrgDecisionPatch,
  canSignOffAssessment,
  decisionClosesPortal,
  decisionRequiresNotes,
  nextReviewAtForDecision,
} from '../lib/vendor/assessmentLifecycle';
import {
  buildArchiveEmptyAssessmentPatch,
  buildRecoverEmptyAssessmentPatch,
  hasEmptyQuestionSnapshot,
} from '../lib/vendor/emptyAssessmentRecovery';
import { emitAuditBestEffort } from '../lib/auditClient';
import { openDecisionPacketForPrint } from '../lib/vendor/reportExport';

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

/** answers are string for yesno/single_choice, string[] for multiple_choice. */
function formatAssessmentAnswer(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'No Answer';
  return value || 'No Answer';
}

export function Assessments() {
  const { user, profile, loading: authLoading } = useAuth();
  const orgId = profile?.organizationId;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const presetVendorId = params.get('vendorId') || '';
  const createdId = params.get('created') || '';
  const monitorFocus = params.get('focus') === 'monitor';

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
  const [orgPackDefaults, setOrgPackDefaults] = useState<FrameworkPackDefaults>({});
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
  const [openConditionsOnly, setOpenConditionsOnly] = useState(monitorFocus);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionOutcome, setDecisionOutcome] = useState<DecisionOutcome>('approved');
  const [archiveReason, setArchiveReason] = useState('');
  const [recoveringEmpty, setRecoveringEmpty] = useState(false);
  const [archivingEmpty, setArchivingEmpty] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!orgId) return;
    void loadOrgFrameworkPackDefaults(orgId).then((defaults) => {
      setOrgPackDefaults(defaults);
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
      if (openConditionsOnly) {
        const outcome = a.decisionOutcome;
        if (outcome !== 'conditional' && outcome !== 'remediate') return false;
      }
      if (!q) return true;
      const hay = `${a.vendorName || ''} ${frameworkLabel(a)} ${a.status || ''} ${a.decisionOutcome || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [assessments, search, vendorFilter, openConditionsOnly]);

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

  const handleVendorFilterChange = (v: string) => {
    setVendorFilter(v);
    if (v === 'all') {
      clearVendorFilter();
    } else {
      setParams({ vendorId: v }, { replace: true });
    }
  };

  const handleReviewAssessment = async (assessment: StoredAssessment) => {
    setReviewAssessment(assessment);
    setReviewAnalysis(null);
    setReviewAiError('');
    setReviewFilter('exceptions');
    setDecisionNotes('');
    setDecisionOutcome('approved');
    setArchiveReason('');
    setIsReviewing(true);

    if (hasEmptyQuestionSnapshot(assessment)) {
      setReviewAiError(
        'This assessment has no snapshotted questions. Rebuild from framework packs or archive it with a reason.'
      );
      return;
    }

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
        headers: await authHeaders(
          { 'Content-Type': 'application/json' },
          { organizationId: orgId }
        ),
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
      evidenceTrustByStoragePath: reviewAssessment.evidenceTrustByStoragePath,
    });
  }, [reviewAssessment]);

  const handleDecideAssessment = async (outcome: DecisionOutcome) => {
    if (!reviewAssessment || !orgId) return;
    if (!canSignOffAssessment(reviewAssessment)) {
      setToast({
        tone: 'warn',
        text: 'Wait for the vendor to submit (or start answering) before signing off.',
      });
      return;
    }
    if (outcome === 'approved' && approvalBlockedByUntrustedEvidence(reviewExceptions)) {
      setToast({
        tone: 'warn',
        text: 'Required evidence is not trusted. Approval is blocked until an authoritative clean result exists.',
      });
      return;
    }
    if (decisionRequiresNotes(outcome) && !decisionNotes.trim()) {
      setToast({
        tone: 'warn',
        text: 'Add decision notes / conditions before continuing.',
      });
      return;
    }

    setApproving(true);
    const decidedBy = profile?.email || profile?.displayName || 'org-admin';
    const preferLocal = mode === 'local' || reviewAssessment.id.startsWith('local_');
    const patch = buildOrgDecisionPatch({
      outcome,
      decidedBy,
      decisionNotes: decisionNotes.trim() || undefined,
    });
    const closes = decisionClosesPortal(outcome);
    const nextReviewAt = nextReviewAtForDecision(outcome);

    try {
      if (preferLocal) {
        upsertLocalAssessment(orgId, { ...reviewAssessment, ...patch });
        refreshLocal();
      } else {
        const res = await fetch('/api/org/assessment-decision', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            assessmentId: reviewAssessment.id,
            outcome,
            decisionNotes: decisionNotes.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || 'Could not record decision.');
        }
      }

      if (closes) {
        await syncVendorAfterAssessmentApprove(
          orgId,
          reviewAssessment.vendorId,
          preferLocal,
          nextReviewAt
        );
      }

      const exceptions = listAssessmentExceptions({
        questions: (reviewAssessment.questions || []) as any,
        answers: reviewAssessment.answers,
        evidenceByQuestion: reviewAssessment.evidenceByQuestion as any,
        evidenceTrustByStoragePath: reviewAssessment.evidenceTrustByStoragePath,
      });
      void emitAuditBestEffort({
        tenantId: orgId,
        eventType: 'decision.finalized',
        actorId: user?.uid || null,
        objectType: 'assessment',
        objectId: reviewAssessment.id,
        payload: {
          outcome,
          vendorId: reviewAssessment.vendorId,
          closesPortal: closes,
          nextReviewAt: closes ? nextReviewAt : null,
          exceptionCount: exceptions.length,
          hasNotes: Boolean(decisionNotes.trim()),
        },
      });
      if (exceptions.length) {
        void emitAuditBestEffort({
          tenantId: orgId,
          eventType: 'exception.reviewed',
          actorId: user?.uid || null,
          objectType: 'assessment',
          objectId: reviewAssessment.id,
          payload: {
            outcome,
            exceptionIds: exceptions.slice(0, 40).map((e) => e.id),
            reasons: exceptions.slice(0, 40).map((e) => e.reason),
          },
        });
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

  const persistAssessmentPatch = async (
    assessment: StoredAssessment,
    patch: Record<string, unknown>
  ) => {
    const preferLocal = mode === 'local' || assessment.id.startsWith('local_');
    if (preferLocal) {
      upsertLocalAssessment(orgId!, { ...assessment, ...patch } as StoredAssessment);
      refreshLocal();
    } else {
      await updateDoc(doc(db, 'assessments', assessment.id), patch);
    }
    return preferLocal;
  };

  const handleRecoverEmptyAssessment = async () => {
    if (!reviewAssessment || !orgId) return;
    setRecoveringEmpty(true);
    try {
      const patch = buildRecoverEmptyAssessmentPatch(reviewAssessment, orgPackDefaults);
      await persistAssessmentPatch(reviewAssessment, patch);
      const next = { ...reviewAssessment, ...patch } as StoredAssessment;
      setReviewAssessment(next);
      setArchiveReason('');
      setToast({
        tone: 'ok',
        text: `Questionnaire rebuilt — ${patch.questionCount} questions stamped from framework packs. Portal link is ready.`,
      });
      setReviewAiError('Waiting for vendor responses before AI analysis is available.');
    } catch (e) {
      console.error('Empty assessment recovery failed:', e);
      setToast({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Could not rebuild questionnaire.',
      });
    } finally {
      setRecoveringEmpty(false);
    }
  };

  const handleArchiveEmptyAssessment = async () => {
    if (!reviewAssessment || !orgId) return;
    setArchivingEmpty(true);
    try {
      const preferLocal = mode === 'local' || reviewAssessment.id.startsWith('local_');
      if (preferLocal) {
        const archivedBy = profile?.email || profile?.displayName || 'org-admin';
        const patch = buildArchiveEmptyAssessmentPatch({
          reason: archiveReason,
          archivedBy,
        });
        await persistAssessmentPatch(reviewAssessment, patch);
      } else {
        const res = await fetch('/api/org/archive-empty-assessment', {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            assessmentId: reviewAssessment.id,
            reason: archiveReason,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || 'Could not archive assessment.');
        }
      }
      setToast({
        tone: 'ok',
        text: 'Empty assessment archived. Create a new assessment when you are ready to send a questionnaire.',
      });
      setIsReviewing(false);
      setReviewAssessment(null);
      setArchiveReason('');
    } catch (e) {
      console.error('Empty assessment archive failed:', e);
      setToast({
        tone: 'err',
        text: e instanceof Error ? e.message : 'Could not archive assessment.',
      });
    } finally {
      setArchivingEmpty(false);
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

  const statCards = [
    { label: 'Active Assessments', value: activeCount, tone: 'mb-2 border-blue-500/20 bg-blue-500/10 text-blue-400' },
    { label: 'Avg Completion', value: `${avgCompletion}%`, tone: 'mb-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-400' },
    { label: 'Overdue', value: overdueCount, tone: 'mb-2 border-amber-500/20 bg-amber-500/10 text-amber-400' },
    { label: 'Linked Vendors', value: vendorOptions.length, tone: 'mb-2 border-purple-500/20 bg-purple-500/10 text-purple-400' },
  ];

  return (
    <AssessmentsPageHeader
      mode={mode}
      fastTrackStage={monitorFocus || openConditionsOnly ? 'monitor' : 'review'}
      onCreate={() =>
        navigate(
          vendorFilter !== 'all'
            ? `/assessments/triage?vendorId=${encodeURIComponent(vendorFilter)}`
            : '/assessments/triage'
        )
      }
    >
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

      <div className="space-y-4">
        <AssessmentsStatsGrid stats={statCards} />

        <PageBand>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={openConditionsOnly}
                onChange={(e) => {
                  setOpenConditionsOnly(e.target.checked);
                  const next = new URLSearchParams(params);
                  if (e.target.checked) next.set('focus', 'monitor');
                  else next.delete('focus');
                  setParams(next, { replace: true });
                }}
              />
              Open conditions only (conditional / remediate)
            </label>
            <Link to="/settings" className="text-xs text-primary hover:underline">
              Verify audit chain (Settings)
            </Link>
          </div>
          <AssessmentTrackerTable
            search={search}
            onSearchChange={setSearch}
            vendorFilter={vendorFilter}
            onVendorFilterChange={handleVendorFilterChange}
            vendorOptions={vendorOptions}
            onClearVendorFilter={clearVendorFilter}
            loading={loading}
            filtered={filtered}
            assessmentsCount={assessments.length}
            reminderState={reminderState}
            isLocalAssessment={isLocalAssessment}
            onCopyPortalLink={copyPortalLink}
            onSendReminder={handleSendReminder}
            onReview={handleReviewAssessment}
            onCreateNew={() => navigate('/assessments/triage')}
          />
        </PageBand>
      </div>

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
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
              role="dialog"
              aria-label="Loading assessment review"
              onClick={() => setIsReviewing(false)}
            >
              <div
                className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-6 py-5"
                onClick={(e) => e.stopPropagation()}
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-slate-300">Opening review…</p>
                <button
                  type="button"
                  className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline"
                  onClick={() => setIsReviewing(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          }
        >
          <AssessmentReviewPanel
            assessment={reviewAssessment}
            reviewAnalysis={reviewAnalysis}
            reviewAiError={reviewAiError}
            reviewAiLoading={reviewAiLoading}
            reviewFilter={reviewFilter}
            onReviewFilterChange={setReviewFilter}
            reviewExceptions={reviewExceptions}
            decisionNotes={decisionNotes}
            onDecisionNotesChange={setDecisionNotes}
            decisionOutcome={decisionOutcome}
            onDecisionOutcomeChange={setDecisionOutcome}
            archiveReason={archiveReason}
            onArchiveReasonChange={setArchiveReason}
            approving={approving}
            recoveringEmpty={recoveringEmpty}
            archivingEmpty={archivingEmpty}
            orgPackDefaults={orgPackDefaults}
            isLocal={isLocalAssessment(reviewAssessment)}
            onClose={() => setIsReviewing(false)}
            onCopyPortalLink={() => void copyPortalLink(reviewAssessment)}
            onRecoverEmpty={() => void handleRecoverEmptyAssessment()}
            onArchiveEmpty={() => void handleArchiveEmptyAssessment()}
            onDecide={(outcome) => void handleDecideAssessment(outcome)}
            onDownloadDecisionPacket={() => {
              if (!reviewAssessment) return;
              try {
                openDecisionPacketForPrint({
                  vendorName: reviewAssessment.vendorName || 'Vendor',
                  assessmentId: reviewAssessment.id,
                  frameworksLabel: frameworkLabel(reviewAssessment),
                  outcome: decisionOutcome,
                  decisionNotes: decisionNotes.trim() || undefined,
                  decidedBy: profile?.email || profile?.displayName || undefined,
                  decidedAt: new Date().toISOString(),
                  nextReviewAt: nextReviewAtForDecision(decisionOutcome),
                  exceptions: reviewExceptions.map((e) => ({
                    question: e.question,
                    reason: e.reason,
                    answer: Array.isArray(e.answer) ? e.answer.join(', ') : e.answer,
                  })),
                  triageTier: (reviewAssessment as { triageTier?: string }).triageTier,
                  reviewCadence: (reviewAssessment as { reviewCadence?: string }).reviewCadence,
                });
                if (orgId) {
                  void emitAuditBestEffort({
                    tenantId: orgId,
                    eventType: 'report.exported',
                    actorId: user?.uid || null,
                    objectType: 'assessment',
                    objectId: reviewAssessment.id,
                    payload: { kind: 'decision_packet' },
                  });
                }
              } catch (err: any) {
                setToast({ tone: 'err', text: err?.message || 'Could not open decision packet.' });
              }
            }}
          />
        </Suspense>
      )}
    </AssessmentsPageHeader>
  );
}

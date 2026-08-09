import React from 'react';
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
  ExternalLink,
  AlertTriangle,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { FRAMEWORK_CATALOG } from '../../lib/vendor/constants';
import {
  exceptionReasonLabel,
  type AssessmentException,
  type DecisionOutcome,
} from '../../lib/vendor/assessmentExceptions';
import {
  canRecoverEmptyAssessment,
  hasEmptyQuestionSnapshot,
} from '../../lib/vendor/emptyAssessmentRecovery';
import type { FrameworkPackDefaults } from '../../lib/vendor/orgFrameworkPacks';
import type { StoredAssessment } from '../../lib/vendor/localAssessmentStore';

function frameworkLabel(a: StoredAssessment): string {
  if (a.frameworkName) {
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

function shortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAssessmentAnswer(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'No Answer';
  return value || 'No Answer';
}

export type AssessmentReviewPanelProps = {
  assessment: StoredAssessment;
  reviewAnalysis: { summary: string; rating: string; recommendation: string } | null;
  reviewAiError: string;
  reviewAiLoading: boolean;
  reviewFilter: 'exceptions' | 'all';
  onReviewFilterChange: (filter: 'exceptions' | 'all') => void;
  reviewExceptions: AssessmentException[];
  decisionNotes: string;
  onDecisionNotesChange: (notes: string) => void;
  decisionOutcome: DecisionOutcome;
  onDecisionOutcomeChange: (outcome: DecisionOutcome) => void;
  archiveReason: string;
  onArchiveReasonChange: (reason: string) => void;
  approving: boolean;
  recoveringEmpty: boolean;
  archivingEmpty: boolean;
  orgPackDefaults: FrameworkPackDefaults;
  isLocal: boolean;
  onClose: () => void;
  onCopyPortalLink: () => void;
  onRecoverEmpty: () => void;
  onArchiveEmpty: () => void;
  onDecide: (outcome: DecisionOutcome) => void;
  onDownloadDecisionPacket?: () => void;
};

export function AssessmentReviewPanel({
  assessment: reviewAssessment,
  reviewAnalysis,
  reviewAiError,
  reviewAiLoading,
  reviewFilter,
  onReviewFilterChange,
  reviewExceptions,
  decisionNotes,
  onDecisionNotesChange,
  decisionOutcome,
  onDecisionOutcomeChange,
  archiveReason,
  onArchiveReasonChange,
  approving,
  recoveringEmpty,
  archivingEmpty,
  orgPackDefaults,
  isLocal,
  onClose,
  onCopyPortalLink,
  onRecoverEmpty,
  onArchiveEmpty,
  onDecide,
  onDownloadDecisionPacket,
}: AssessmentReviewPanelProps) {
  return (
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
              {frameworkLabel(reviewAssessment)} · Exceptions-first review
            </p>
            <p className="mt-2 text-[11px] text-slate-500">
              Due {dueLabel(reviewAssessment)}
              {reviewAssessment.sentAt ? ` · Sent ${shortDate(reviewAssessment.sentAt)}` : ''}
              {reviewAssessment.completedAt
                ? ` · Completed ${shortDate(reviewAssessment.completedAt)}`
                : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
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
                  {hasEmptyQuestionSnapshot(reviewAssessment)
                    ? 'Empty Snapshot Recovery'
                    : 'Response Intelligence'}
                </h3>
                {!hasEmptyQuestionSnapshot(reviewAssessment) && (
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
                        onClick={() => onReviewFilterChange('exceptions')}
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
                        onClick={() => onReviewFilterChange('all')}
                      >
                        All answers
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {hasEmptyQuestionSnapshot(reviewAssessment) ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-100">
                        Questionnaire unavailable — empty snapshot
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        The portal will not rebuild questions automatically (audit integrity). Rebuild
                        from the stamped or current framework packs, or archive this row with a
                        reason and create a new assessment.
                      </p>
                    </div>
                  </div>
                  {canRecoverEmptyAssessment(reviewAssessment, orgPackDefaults) ? (
                    <Button
                      size="sm"
                      className="bg-primary text-white hover:bg-primary/90"
                      disabled={recoveringEmpty || archivingEmpty}
                      onClick={onRecoverEmpty}
                    >
                      {recoveringEmpty ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      )}
                      Rebuild from framework packs
                    </Button>
                  ) : (
                    <p className="text-xs text-amber-200/80">
                      No recoverable packs on this assessment (custom-only or missing frameworks).
                      Archive it and create a new assessment with a standard framework.
                    </p>
                  )}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Archive reason
                    </label>
                    <Input
                      value={archiveReason}
                      onChange={(e) => onArchiveReasonChange(e.target.value)}
                      placeholder="e.g. Legacy empty create — never sent to vendor"
                      className="border-white/10 bg-slate-950 text-sm text-white"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                      disabled={archivingEmpty || recoveringEmpty || !archiveReason.trim()}
                      onClick={onArchiveEmpty}
                    >
                      {archivingEmpty ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="mr-2 h-3.5 w-3.5" />
                      )}
                      Archive empty assessment
                    </Button>
                  </div>
                </div>
              ) : progressOf(reviewAssessment) === 0 &&
                !Object.keys(reviewAssessment.answers || {}).length ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
                  <p className="text-sm font-medium text-amber-100">
                    Vendor has not started this assessment yet.
                  </p>
                  <p className="text-xs text-slate-400">
                    Share the portal link so they can answer. Review will show responses here once
                    progress moves above 0%.
                  </p>
                  {!isLocal && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/40 text-amber-100"
                      onClick={onCopyPortalLink}
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

              {!hasEmptyQuestionSnapshot(reviewAssessment) && (
                <AssessmentDecisionBar
                  decisionOutcome={decisionOutcome}
                  onDecisionOutcomeChange={onDecisionOutcomeChange}
                  decisionNotes={decisionNotes}
                  onDecisionNotesChange={onDecisionNotesChange}
                  approving={approving}
                  assessment={reviewAssessment}
                  onDecide={onDecide}
                  onDownloadDecisionPacket={onDownloadDecisionPacket}
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function AssessmentDecisionBar({
  decisionOutcome,
  onDecisionOutcomeChange,
  decisionNotes,
  onDecisionNotesChange,
  approving,
  assessment,
  onDecide,
  onDownloadDecisionPacket,
}: {
  decisionOutcome: DecisionOutcome;
  onDecisionOutcomeChange: (outcome: DecisionOutcome) => void;
  decisionNotes: string;
  onDecisionNotesChange: (notes: string) => void;
  approving: boolean;
  assessment: StoredAssessment;
  onDecide: (outcome: DecisionOutcome) => void;
  onDownloadDecisionPacket?: () => void;
}) {
  return (
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
            onClick={() => onDecisionOutcomeChange(id)}
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
        onChange={(e) => onDecisionNotesChange(e.target.value)}
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
            (assessment.status !== 'Under Review' &&
              assessment.status !== 'Completed' &&
              progressOf(assessment) <= 0)
          }
          onClick={() => onDecide(decisionOutcome)}
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
        {onDownloadDecisionPacket && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/10 text-slate-200"
            onClick={onDownloadDecisionPacket}
          >
            Download decision PDF
          </Button>
        )}
        {assessment.status !== 'Under Review' && progressOf(assessment) <= 0 && (
          <p className="text-[10px] text-slate-500">
            Enabled after the vendor starts answering or submits for review.
          </p>
        )}
      </div>
    </div>
  );
}

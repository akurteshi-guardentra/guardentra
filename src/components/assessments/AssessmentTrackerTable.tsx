import React from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  Loader2,
  FileText,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import {
  deriveStatusFromAssessments,
  type StoredAssessment,
} from '../../lib/vendor/localAssessmentStore';
import { FRAMEWORK_CATALOG } from '../../lib/vendor/constants';
import { hasEmptyQuestionSnapshot } from '../../lib/vendor/emptyAssessmentRecovery';

const SELECT_CLASS =
  'h-9 rounded-md border border-white/10 bg-slate-950 px-3 text-sm text-white [&>option]:bg-slate-950 [&>option]:text-white';

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

function lifecycleDatesLabel(a: StoredAssessment): string {
  const parts: string[] = [];
  if (a.sentAt) parts.push(`Sent ${shortDate(a.sentAt)}`);
  if (a.completedAt) parts.push(`Done ${shortDate(a.completedAt)}`);
  return parts.join(' · ') || '—';
}

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

function AssessmentEmptyState({
  hasAnyAssessments,
  onCreateNew,
}: {
  hasAnyAssessments: boolean;
  onCreateNew: () => void;
}) {
  return (
    <tr>
      <td colSpan={6} className="py-12 text-center text-slate-500">
        <p className="mb-3">
          {hasAnyAssessments
            ? 'No assessments match this filter.'
            : 'No assessments yet — pick a vendor in New Assessment.'}
        </p>
        <Button className="bg-primary text-white hover:bg-primary/90" onClick={onCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          New Assessment
        </Button>
      </td>
    </tr>
  );
}

export type AssessmentTrackerTableProps = {
  search: string;
  onSearchChange: (value: string) => void;
  vendorFilter: string;
  onVendorFilterChange: (vendorId: string) => void;
  vendorOptions: { id: string; name: string }[];
  onClearVendorFilter: () => void;
  loading: boolean;
  filtered: StoredAssessment[];
  assessmentsCount: number;
  reminderState: Record<string, 'sending' | 'sent' | 'error'>;
  isLocalAssessment: (a: StoredAssessment) => boolean;
  onCopyPortalLink: (a: StoredAssessment) => void;
  onSendReminder: (a: StoredAssessment) => void;
  onReview: (a: StoredAssessment) => void;
  onCreateNew: () => void;
};

export function AssessmentTrackerTable({
  search,
  onSearchChange,
  vendorFilter,
  onVendorFilterChange,
  vendorOptions,
  onClearVendorFilter,
  loading,
  filtered,
  assessmentsCount,
  reminderState,
  isLocalAssessment,
  onCopyPortalLink,
  onSendReminder,
  onReview,
  onCreateNew,
}: AssessmentTrackerTableProps) {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search assessments..."
            className="border-white/10 bg-black/20 pl-10 text-white"
          />
        </div>
        <select
          className={SELECT_CLASS}
          value={vendorFilter}
          onChange={(e) => onVendorFilterChange(e.target.value)}
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
          <Button type="button" variant="outline" className="border-white/10" onClick={onClearVendorFilter}>
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
                Due / Timeline
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
              <AssessmentEmptyState
                hasAnyAssessments={assessmentsCount > 0}
                onCreateNew={onCreateNew}
              />
            ) : (
              filtered.map((a) => (
                <tr key={a.id} className="group transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={`/vendors/${a.vendorId}/impact`}
                          className="block truncate text-sm font-bold text-slate-100 hover:text-primary hover:underline"
                          title={a.vendorName || 'Vendor'}
                        >
                          {a.vendorName || 'Vendor'}
                        </Link>
                        <p className="text-[10px] text-slate-500">Linked vendor</p>
                        {hasEmptyQuestionSnapshot(a) && a.status !== 'Completed' && (
                          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            Empty questionnaire
                          </p>
                        )}
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
                      <span className="font-mono text-[10px] tabular-nums text-slate-500">
                        {progressOf(a)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-500">
                    <div className="italic">Due {dueLabel(a)}</div>
                    <div className="mt-0.5 text-[10px] not-italic text-slate-600">
                      {lifecycleDatesLabel(a)}
                    </div>
                  </td>
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
                      onClick={() => void onCopyPortalLink(a)}
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
                        onClick={() => void onSendReminder(a)}
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
                      onClick={() => void onReview(a)}
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
    </>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import {
  MoreVertical,
  CheckCircle2,
  Clock,
  Circle,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { AssessmentStatus, Vendor } from '../../lib/vendor/types';
import {
  assessmentStatusClasses,
  displayRiskScore,
  effectiveRiskLevel,
  hasRealRiskScore,
  riskBandClasses,
} from '../../lib/vendor/risk';
import { deriveAssessmentStatus } from './vendorsHelpers';

function assessmentStatusIcon(status: AssessmentStatus) {
  if (status === 'Completed') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'Under Review') return <Clock className="h-3.5 w-3.5 text-indigo-400" />;
  if (status === 'In Progress') return <Loader2 className="h-3.5 w-3.5" />;
  if (status === 'Sent') return <Loader2 className="h-3.5 w-3.5" />;
  if (status === 'Overdue') return <Clock className="h-3.5 w-3.5 text-rose-400" />;
  if (status === 'Due Soon') return <Clock className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5" />;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type AssessmentLike = {
  status?: string;
  dueAt?: string;
  dueDate?: string;
  progressPct?: number;
  progress?: number;
};

type VendorTableProps = {
  loading: boolean;
  pageRows: Vendor[];
  vendorsTotal: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (value: number | ((prev: number) => number)) => void;
  menuVendorId: string | null;
  setMenuVendorId: (value: string | null | ((prev: string | null) => string | null)) => void;
  assessmentsByVendor: Map<string, AssessmentLike[]>;
  onNavigate: (path: string) => void;
};

export function VendorTable({
  loading,
  pageRows,
  vendorsTotal,
  filteredCount,
  page,
  pageSize,
  totalPages,
  setPage,
  menuVendorId,
  setMenuVendorId,
  assessmentsByVendor,
  onNavigate,
}: VendorTableProps) {
  return (
    <>
      <div className="max-h-[min(70vh,40rem)] overflow-auto">
        <table className="w-full min-w-[900px] text-left text-sm text-slate-200">
          <thead className="sticky top-0 z-10 border-b border-white/5 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Primary Contact</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Assessment</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Next Review</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  Loading vendors…
                </td>
              </tr>
            )}
            {!loading && pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                  {vendorsTotal === 0
                    ? 'No vendors yet. Add one or bulk-upload a CSV to start your register.'
                    : 'No vendors match the current filters.'}
                </td>
              </tr>
            )}
            {pageRows.map((v) => {
              const level = effectiveRiskLevel(v);
              const linked = assessmentsByVendor.get(v.id) || [];
              const aStatus = deriveAssessmentStatus(v, linked);
              return (
                <tr key={v.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-slate-300">
                        {v.name.slice(0, 2).toUpperCase()}
                      </div>
                      <button
                        type="button"
                        className="min-w-0 truncate text-left font-medium text-slate-100 hover:text-primary"
                        title={v.name}
                        onClick={() => onNavigate(`/vendors/${v.id}/impact`)}
                      >
                        {v.name}
                      </button>
                    </div>
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-3 text-slate-400" title={v.category || undefined}>
                    {v.category || '—'}
                  </td>
                  <td
                    className="max-w-[12rem] truncate px-4 py-3 text-slate-400"
                    title={v.primaryContactName || v.primaryContactEmail || undefined}
                  >
                    {v.primaryContactName || v.primaryContactEmail || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                        riskBandClasses(level)
                      )}
                      title={
                        hasRealRiskScore(v)
                          ? 'Security residual score'
                          : v.finalRating
                            ? 'Final rating (impact + security)'
                            : v.impactLevel
                              ? 'From impact assessment'
                              : 'From vendor criticality (no security score yet)'
                      }
                    >
                      {hasRealRiskScore(v) && (
                        <>
                          <span className="tabular-nums">{displayRiskScore(v)}</span>
                          <span className="opacity-80">·</span>
                        </>
                      )}
                      {level}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/assessments?vendorId=${encodeURIComponent(v.id)}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:underline',
                        assessmentStatusClasses(aStatus)
                      )}
                      title={
                        linked.length
                          ? `${linked.length} assessment(s) — view tracker`
                          : 'No assessments yet — open tracker'
                      }
                    >
                      {assessmentStatusIcon(aStatus)}
                      {aStatus}
                      {linked.length > 0 ? ` · ${linked.length}` : ''}
                    </Link>
                  </td>
                  <td className="max-w-[9rem] truncate px-4 py-3 text-slate-400" title={v.ownerName || undefined}>
                    {v.ownerName || '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                    {formatDate(v.nextReviewAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/vendors/${v.id}/impact`}
                      className="mr-2 text-xs font-medium text-slate-300 hover:text-white hover:underline"
                    >
                      Impact
                    </Link>
                    <Link
                      to={`/assessments/triage?vendorId=${v.id}`}
                      className="mr-2 text-xs font-medium text-primary hover:underline"
                    >
                      Assess
                    </Link>
                    <div className="relative inline-block">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-white"
                        aria-label="More actions"
                        aria-expanded={menuVendorId === v.id}
                        onClick={() =>
                          setMenuVendorId((id) => (id === v.id ? null : v.id))
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuVendorId === v.id && (
                        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-white/10 bg-slate-950 py-1 shadow-xl">
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
                            onClick={() => {
                              setMenuVendorId(null);
                              onNavigate(`/vendors/${v.id}/impact`);
                            }}
                          >
                            Impact assessment
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
                            onClick={() => {
                              setMenuVendorId(null);
                              onNavigate(`/assessments/triage?vendorId=${v.id}`);
                            }}
                          >
                            Start FastTrack
                          </button>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/5"
                            onClick={() => {
                              setMenuVendorId(null);
                              onNavigate(`/assessments?vendorId=${encodeURIComponent(v.id)}`);
                            }}
                          >
                            View assessments ({linked.length})
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-sm text-slate-400">
        <span>
          {filteredCount === 0
            ? '0 vendors'
            : `${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, filteredCount)} of ${filteredCount} vendors`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}

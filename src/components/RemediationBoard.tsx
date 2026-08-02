import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Trash2, Wrench } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { RemediationService, type RemediationTicket } from '../services/RemediationService';

type Status = RemediationTicket['status'];

const STATUSES: Status[] = ['Backlog', 'In Progress', 'Resolved', 'Closed'];

/** Matches the severity vocabulary already used across Audit Lab and the vendor pages. */
function severityClass(severity: string): string {
  if (severity === 'Critical') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  if (severity === 'High') return 'border-orange-500/30 bg-orange-500/10 text-orange-300';
  if (severity === 'Medium') return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return 'border-sky-500/30 bg-sky-500/10 text-sky-300';
}

function statusClass(status: Status): string {
  if (status === 'Resolved' || status === 'Closed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'In Progress') return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300';
  return 'border-white/10 bg-white/5 text-slate-400';
}

function isOverdue(ticket: RemediationTicket): boolean {
  if (ticket.status === 'Resolved' || ticket.status === 'Closed') return false;
  const due = ticket.dueDate || ticket.deadline;
  if (!due) return false;
  const parsed = Date.parse(due);
  return Number.isFinite(parsed) && parsed < Date.now();
}

/**
 * Org-wide remediation tickets.
 *
 * Audit Lab has been able to turn a detected gap into a persisted remediation ticket
 * since Sprint 8b, but nothing in the active product rendered them: the only UI was
 * RemediationEngine's Kanban board on VendorRisk.tsx, which is frozen behind the
 * `vendorsLegacy` flag. Users created work items that then disappeared
 * (docs/KNOWN_ISSUES.md #15).
 *
 * This is deliberately not a reuse of that board. RemediationEngine is built around a
 * single vendor — it takes vendorId/vendorName props and frames everything as "PARTNER"
 * — whereas Audit Lab's findings are org-wide and stored with `vendorId: 'org-wide'`.
 * Forcing the vendor board to serve both would have meant weakening it for its own case.
 */
export function RemediationBoard({
  organizationId,
  canDelete = false,
}: {
  organizationId: string;
  /** Deletion is admin-only, matching the role gating applied elsewhere (KNOWN_ISSUES #10). */
  canDelete?: boolean;
}) {
  const [tickets, setTickets] = useState<RemediationTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'Open' | 'All'>('Open');

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    try {
      setTickets(await RemediationService.getAllTickets(organizationId));
    } catch (e) {
      console.error('RemediationBoard load failed:', e);
      setError('Could not load remediation tickets.');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (id: string, status: Status) => {
    setBusyId(id);
    // Optimistic: the list is small and a failed write is re-synced by load() below.
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      await RemediationService.updateTicketStatus(id, status);
    } catch (e) {
      console.error('Status update failed:', e);
      setError('Could not update that ticket.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await RemediationService.deleteTicket(id);
      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error('Delete failed:', e);
      setError('Could not delete that ticket.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const openCount = tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed').length;
  const overdueCount = tickets.filter(isOverdue).length;
  const visible = statusFilter === 'Open'
    ? tickets.filter((t) => t.status !== 'Resolved' && t.status !== 'Closed')
    : tickets;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/5 p-8">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">Remediation</h2>
            {overdueCount > 0 && (
              <div className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                {overdueCount} overdue
              </div>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {tickets.length === 0
              ? 'Gaps you turn into tickets from a readiness report land here.'
              : `${openCount} open of ${tickets.length} total`}
          </p>
        </div>
        {tickets.length > 0 && (
          <div className="flex items-center gap-2">
            {(['Open', 'All'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={cn(
                  'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors',
                  statusFilter === f
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="px-8 pt-4 text-xs text-rose-400">{error}</p>}

      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-8">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/5 bg-white/5 py-16 text-center">
            <Wrench className="mx-auto mb-3 h-8 w-8 text-slate-700" />
            <p className="mx-auto max-w-xs text-sm text-slate-400">
              {tickets.length === 0
                ? 'No remediation tickets yet.'
                : 'Nothing open — every ticket is resolved or closed.'}
            </p>
            {tickets.length === 0 && (
              <p className="mx-auto mt-2 max-w-sm text-xs text-slate-500">
                Run a readiness scan, then use “Create ticket” on any evidence gap or
                recommendation to track the fix here.
              </p>
            )}
          </div>
        ) : (
          visible.map((t) => {
            const overdue = isOverdue(t);
            const due = t.dueDate || t.deadline;
            return (
              <div
                key={t.id}
                className="rounded-xl border border-white/5 bg-white/5 p-5 transition-colors hover:bg-white/[0.07]"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                          severityClass(t.severity)
                        )}
                      >
                        {t.severity}
                      </span>
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest',
                          statusClass(t.status)
                        )}
                      >
                        {t.status}
                      </span>
                      {overdue && (
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-rose-400">
                          <AlertTriangle className="h-3 w-3" />
                          Overdue
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white">{t.finding || t.problem}</h3>
                    {(t.recommendedFix || t.recommendedAction) && (
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {t.recommendedFix || t.recommendedAction}
                      </p>
                    )}
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void remove(t.id)}
                      disabled={busyId === t.id}
                      className="shrink-0 rounded p-1 text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
                      title="Delete ticket"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
                  <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] text-slate-500">
                    {due && (
                      <span className={overdue ? 'text-rose-400' : undefined}>
                        Due {new Date(due).toLocaleDateString()}
                      </span>
                    )}
                    {t.ownerSuggestion && <span>Owner: {t.ownerSuggestion}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {busyId === t.id && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
                    {t.status !== 'Resolved' && t.status !== 'Closed' ? (
                      <>
                        {t.status === 'Backlog' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId === t.id}
                            onClick={() => void changeStatus(t.id, 'In Progress')}
                            className="h-7 text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 hover:text-white"
                          >
                            Start
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === t.id}
                          onClick={() => void changeStatus(t.id, 'Resolved')}
                          className="h-7 text-[10px] font-bold uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 hover:text-white"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Resolve
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === t.id}
                        onClick={() => void changeStatus(t.id, 'Backlog')}
                        className="h-7 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white"
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export { STATUSES };

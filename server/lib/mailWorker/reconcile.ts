/**
 * Lost-email reconcile for the extension -> self-managed worker handover
 * (#72 staging cutover packet, addendum B).
 *
 * Loss window: a `mail` doc created after the extension is gone but before the
 * worker is enabled has its create event consumed by the disabled worker, and
 * `recoverMail` never revisits it (it scans only worker-owned docs).
 *
 * This module only CLASSIFIES inventory and, when explicitly asked, hands each
 * candidate id to `worker.process(id)` once. It never writes `delivery`
 * itself, never clears or resets a delivery, and never resubmits a doc the
 * worker or another consumer already owns. Duplicate safety stays with the
 * worker's transactional claim and fencing.
 *
 * Output is ids and counts only: no recipients, subjects, bodies or errors.
 */
import { WORKER_OWNER } from './worker';

/** Minimal per-doc view. `delivery` is `undefined` when the field is absent. */
export type MailInventoryEntry = { id: string; createdAtMs: number; delivery: unknown };

export type ReconcileClass =
  /** Created at/after cutover, no `delivery`, old enough: the only possible loss. */
  | 'CANDIDATE'
  /** Created at/after cutover, no `delivery`, younger than minAge: left to the live trigger. */
  | 'RECENT_UNCLAIMED'
  /** Created before cutover, no `delivery`: the worker never touches these. Owner review. */
  | 'PRE_CUTOVER_UNDELIVERED'
  /** Worker-owned, lease state PROCESSING: owner review against provider activity. */
  | 'WORKER_PROCESSING'
  /** Worker-owned ERROR / OUTCOME_UNKNOWN: owner review against provider activity. */
  | 'WORKER_OUTCOME_UNKNOWN'
  /** Worker-owned in any other state (SUCCESS, RETRY, other ERROR codes). Count only. */
  | 'WORKER_OTHER'
  /** `delivery` present without the worker marker (extension) or malformed. Count only. */
  | 'FOREIGN_DELIVERY';

export const RECONCILE_CLASSES: readonly ReconcileClass[] = [
  'CANDIDATE', 'RECENT_UNCLAIMED', 'PRE_CUTOVER_UNDELIVERED', 'WORKER_PROCESSING',
  'WORKER_OUTCOME_UNKNOWN', 'WORKER_OTHER', 'FOREIGN_DELIVERY',
];

/** Classes whose ids are printed. Every other class is reported as a count only. */
export const LISTED_CLASSES: readonly ReconcileClass[] = [
  'CANDIDATE', 'RECENT_UNCLAIMED', 'PRE_CUTOVER_UNDELIVERED', 'WORKER_PROCESSING', 'WORKER_OUTCOME_UNKNOWN',
];

export const DEFAULT_MIN_AGE_MS = 5 * 60_000;
export const DEFAULT_MAX_APPLY = 10;
export const HARD_MAX_APPLY = 50;

export function classifyMail(entry: MailInventoryEntry, opts: {
  cutoverMs: number; nowMs: number; minAgeMs: number;
}): ReconcileClass {
  const delivery = entry.delivery;
  if (delivery === undefined) {
    if (entry.createdAtMs < opts.cutoverMs) return 'PRE_CUTOVER_UNDELIVERED';
    return opts.nowMs - entry.createdAtMs < opts.minAgeMs ? 'RECENT_UNCLAIMED' : 'CANDIDATE';
  }
  if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery)) return 'FOREIGN_DELIVERY';
  const d = delivery as Record<string, unknown>;
  if (d.owner !== WORKER_OWNER) return 'FOREIGN_DELIVERY';
  if (d.state === 'PROCESSING') return 'WORKER_PROCESSING';
  if (d.state === 'ERROR' && d.code === 'OUTCOME_UNKNOWN') return 'WORKER_OUTCOME_UNKNOWN';
  return 'WORKER_OTHER';
}

export type ReconcileReport = {
  mode: 'dry-run' | 'apply';
  cutoverAt: string;
  scanned: number;
  counts: Record<ReconcileClass, number>;
  ids: Partial<Record<ReconcileClass, string[]>>;
  /** Apply mode only: per-candidate result as returned by `worker.process`. */
  applied?: { id: string; result: string }[];
  /** Apply mode only: candidates not attempted because an earlier one failed. */
  notAttempted?: string[];
};

export class ReconcileError extends Error {
  constructor(public code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'ReconcileError';
  }
}

export function buildReport(entries: MailInventoryEntry[], opts: {
  cutoverMs: number; nowMs: number; minAgeMs?: number;
}): ReconcileReport {
  if (!Number.isFinite(opts.cutoverMs)) throw new ReconcileError('CUTOVER_INVALID', 'cutover must be a finite time');
  const minAgeMs = opts.minAgeMs ?? DEFAULT_MIN_AGE_MS;
  const counts = Object.fromEntries(RECONCILE_CLASSES.map(c => [c, 0])) as Record<ReconcileClass, number>;
  const ids: Partial<Record<ReconcileClass, string[]>> = {};
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) continue; // Pagination overlap must never double-process.
    seen.add(entry.id);
    const cls = classifyMail(entry, { cutoverMs: opts.cutoverMs, nowMs: opts.nowMs, minAgeMs });
    counts[cls] += 1;
    if (LISTED_CLASSES.includes(cls)) (ids[cls] ||= []).push(entry.id);
  }
  for (const list of Object.values(ids)) list!.sort();
  return {
    mode: 'dry-run', cutoverAt: new Date(opts.cutoverMs).toISOString(), scanned: seen.size, counts, ids,
  };
}

/**
 * Apply: call `process(id)` once per CANDIDATE, sequentially. Refuses to start
 * when candidates exceed `maxApply`. Stops at the first thrown error and
 * reports the rest as not attempted (no retry loop, no partial hammering).
 */
export async function applyReport(report: ReconcileReport, opts: {
  process: (id: string) => Promise<string>; maxApply: number;
}): Promise<ReconcileReport> {
  if (!Number.isInteger(opts.maxApply) || opts.maxApply < 1 || opts.maxApply > HARD_MAX_APPLY) {
    throw new ReconcileError('MAX_INVALID', `max must be an integer from 1 to ${HARD_MAX_APPLY}`);
  }
  const candidates = report.ids.CANDIDATE || [];
  if (candidates.length > opts.maxApply) {
    throw new ReconcileError('LIMIT_EXCEEDED',
      `${candidates.length} candidates exceed --max ${opts.maxApply}; nothing was processed`);
  }
  const applied: { id: string; result: string }[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const id = candidates[i];
    try {
      applied.push({ id, result: String(await opts.process(id)) });
    } catch {
      // Never surface SDK/provider error text; it can carry payload fragments.
      applied.push({ id, result: 'FAILED' });
      return { ...report, mode: 'apply', applied, notAttempted: candidates.slice(i + 1) };
    }
  }
  return { ...report, mode: 'apply', applied, notAttempted: [] };
}

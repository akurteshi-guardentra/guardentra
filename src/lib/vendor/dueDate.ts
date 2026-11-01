/**
 * One calendar due day per assessment (#124 journey finding 4).
 *
 * `dueDate` (YYYY-MM-DD, the UTC day of `dueAt`) is what the tracker, reminder worker and
 * notification emails already show. The vendor portal used to render `dueAt` in the
 * viewer's local timezone, so a vendor east of UTC saw the next day. Every surface now
 * reads the same calendar day and formats it without a timezone shift.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assessmentDueDay(a: { dueDate?: unknown; dueAt?: unknown }): string | null {
  if (typeof a.dueDate === 'string' && DAY_RE.test(a.dueDate.trim())) return a.dueDate.trim();
  if (typeof a.dueAt === 'string' && a.dueAt.trim()) {
    const ms = Date.parse(a.dueAt);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  }
  return null;
}

/** "Nov 13, 2026" for the stored calendar day, identical in every timezone. */
export function formatDueDay(day: string | null, locale?: string): string {
  if (!day || !DAY_RE.test(day)) return '—';
  const d = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

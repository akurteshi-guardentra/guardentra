/**
 * Portal session failures must not collapse a dead API into "invalid link",
 * and must not distinguish unknown ids from closed ones in the UI.
 */
export type PortalSessionFailure = 'unavailable' | 'unreachable';

export function classifyPortalSessionFailure(status: number | null): PortalSessionFailure {
  if (status == null || status >= 500) return 'unreachable';
  return 'unavailable';
}

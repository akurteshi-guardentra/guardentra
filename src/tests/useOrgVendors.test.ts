/**
 * Sprint 3a's local/Firestore fallback state machine (docs/KNOWN_ISSUES.md #5).
 *
 * This logic was written, reviewed line by line, and never executed — it was the
 * riskiest code in that sprint and the one thing a review cannot really settle, because
 * the bug class it fixes is a *ratchet*: a single transient failure permanently siloing a
 * user's data in localStorage, invisible to teammates, with no recovery path.
 *
 * Driven with a controllable onSnapshot mock rather than the emulator on purpose. The
 * emulator can prove a write lands; it cannot deterministically produce "the listener
 * errors, then succeeds 30 seconds later", which is precisely the transition at issue.
 * Here the success and error callbacks are captured so each step is explicit, and fake
 * timers make the 3.5s failsafe and 30s retry exact rather than flaky.
 */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Flush pending microtasks. Needed instead of waitFor(): the snapshot handler awaits
 * promoteLocalVendors() before setting state, and waitFor() polls on real timers, which
 * never advance under vi.useFakeTimers().
 */
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

/** Captured listener callbacks, so a test can decide when Firestore "responds". */
let onNext: ((snap: unknown) => void) | null = null;
let onError: ((err: unknown) => void) | null = null;
let unsubscribed = 0;
let listenCount = 0;
const addedDocs: Record<string, unknown>[] = [];

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  query: vi.fn((c: unknown) => c),
  where: vi.fn(),
  addDoc: vi.fn(async (_col: unknown, data: Record<string, unknown>) => {
    addedDocs.push(data);
    return { id: `cloud_${addedDocs.length}` };
  }),
  onSnapshot: vi.fn((_q: unknown, next: (s: unknown) => void, err: (e: unknown) => void) => {
    listenCount += 1;
    onNext = next;
    onError = err;
    return () => {
      unsubscribed += 1;
    };
  }),
}));

vi.mock('../firebase', () => ({ db: {}, auth: {}, storage: {} }));

import { useOrgVendors } from '../lib/vendor/useOrgVendors';
import { createLocalVendor, listLocalVendors } from '../lib/vendor/localVendorStore';

const ORG = 'org-1';

/** Shape onSnapshot hands back — only .docs is read by the hook. */
const snapshot = (docs: { id: string; data: Record<string, unknown> }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  onNext = null;
  onError = null;
  unsubscribed = 0;
  listenCount = 0;
  addedDocs.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useOrgVendors — local/Firestore fallback', () => {
  it('falls back to local mode when the listener never responds (3.5s failsafe)', async () => {
    createLocalVendor(ORG, { name: 'Offline Vendor' } as never);
    const { result } = renderHook(() => useOrgVendors(ORG));

    expect(result.current.mode).toBe('firestore');
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });

    expect(result.current.mode).toBe('local');
    expect(result.current.vendors.map((v) => v.name)).toContain('Offline Vendor');
    // The listener is torn down so a late response cannot clobber local state.
    expect(unsubscribed).toBe(1);
  });

  it('falls back to local mode when the listener errors outright', async () => {
    createLocalVendor(ORG, { name: 'Errored Vendor' } as never);
    const { result } = renderHook(() => useOrgVendors(ORG));

    await act(async () => {
      onError?.({ code: 'unavailable', message: 'backend unavailable' });
    });

    expect(result.current.mode).toBe('local');
    expect(result.current.vendors.map((v) => v.name)).toContain('Errored Vendor');
  });

  it('retries roughly every 30s while stuck local — this is the anti-ratchet', async () => {
    renderHook(() => useOrgVendors(ORG));
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    const afterFallback = listenCount;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(listenCount).toBeGreaterThan(afterFallback);

    const afterFirstRetry = listenCount;
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(listenCount).toBeGreaterThan(afterFirstRetry);
  });

  it('promotes local-only vendors on reconnect, clears them locally, and does not duplicate', async () => {
    const local = createLocalVendor(ORG, { name: 'Created Offline' } as never);
    expect(local.id.startsWith('local_')).toBe(true);

    const { result } = renderHook(() => useOrgVendors(ORG));
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    expect(result.current.mode).toBe('local');

    // Reconnect: retry re-subscribes, then Firestore answers — including the row that
    // the promotion just wrote, which is how a naive merge would double-count it.
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      onNext?.(snapshot([{ id: 'cloud_1', data: { name: 'Created Offline', organizationId: ORG } }]));
      await flush();
    });

    expect(result.current.mode).toBe('firestore');

    // Written to Firestore without the local_ id tagging along.
    expect(addedDocs).toHaveLength(1);
    expect(addedDocs[0]).toMatchObject({ name: 'Created Offline' });
    expect(addedDocs[0]).not.toHaveProperty('id');

    // Removed from localStorage, so a later fallback cannot resurrect it.
    expect(listLocalVendors(ORG)).toHaveLength(0);

    // Exactly one row, not the local copy plus the cloud copy.
    expect(result.current.vendors).toHaveLength(1);
    expect(result.current.vendors[0].id).toBe('cloud_1');
  });

  it('stops retrying once reconnected', async () => {
    renderHook(() => useOrgVendors(ORG));
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      onNext?.(snapshot([]));
      await flush();
    });

    const settled = listenCount;
    // Two further retry windows: a live listener must not keep re-subscribing.
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(listenCount).toBe(settled);
  });

  it('does not promote cloud-backed vendors a second time', async () => {
    // A row already carrying a real id must not be re-written on reconnect.
    createLocalVendor(ORG, { name: 'Already In Cloud' } as never);
    const rows = listLocalVendors(ORG).map((v) => ({ ...v, id: 'cloud_existing' }));
    localStorage.setItem('guardentra.localVendors.v1', JSON.stringify({ [ORG]: rows }));

    renderHook(() => useOrgVendors(ORG));
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      onNext?.(snapshot([{ id: 'cloud_existing', data: { name: 'Already In Cloud', organizationId: ORG } }]));
      await flush();
    });

    expect(addedDocs).toHaveLength(0);
  });
});

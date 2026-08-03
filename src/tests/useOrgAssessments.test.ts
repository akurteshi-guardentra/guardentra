/**
 * The assessments half of Sprint 3a's fallback (docs/KNOWN_ISSUES.md #5).
 *
 * useOrgAssessments shares the state machine with useOrgVendors — covered in
 * useOrgVendors.test.ts — but differs in one way that carries its own risk: instead of
 * replacing state with the cloud snapshot, it *merges* any still-local rows into it:
 *
 *   const merged = [...rows, ...local.filter((l) => !cloudIds.has(l.id))];
 *
 * That merge is what keeps a create visible when promotion partially fails, and it is
 * also exactly where a duplicate would appear if promotion succeeded but the local copy
 * were not cleared. Both directions are pinned down below.
 */
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

let onNext: ((snap: unknown) => void) | null = null;
let listenCount = 0;
let addDocShouldFail = false;
const addedDocs: Record<string, unknown>[] = [];

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  query: vi.fn((c: unknown) => c),
  where: vi.fn(),
  addDoc: vi.fn(async (_col: unknown, data: Record<string, unknown>) => {
    if (addDocShouldFail) throw new Error('permission-denied');
    addedDocs.push(data);
    return { id: `cloud_${addedDocs.length}` };
  }),
  onSnapshot: vi.fn((_q: unknown, next: (s: unknown) => void) => {
    listenCount += 1;
    onNext = next;
    return () => {};
  }),
}));

vi.mock('../firebase', () => ({ db: {}, auth: {}, storage: {} }));

import { useOrgAssessments } from '../lib/vendor/useOrgAssessments';
import { createLocalAssessment, listLocalAssessments } from '../lib/vendor/localAssessmentStore';

const ORG = 'org-1';

const snapshot = (docs: { id: string; data: Record<string, unknown> }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
});

const makeLocal = (vendorName: string) =>
  createLocalAssessment(ORG, { vendorId: 'v1', vendorName, frameworks: ['soc2'] } as never);

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  onNext = null;
  listenCount = 0;
  addDocShouldFail = false;
  addedDocs.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useOrgAssessments — promotion and merge', () => {
  it('promotes a local-only assessment and leaves exactly one row', async () => {
    makeLocal('Offline Vendor');

    const { result } = renderHook(() => useOrgAssessments(ORG));
    await act(async () => {
      vi.advanceTimersByTime(3600);
    });
    expect(result.current.mode).toBe('local');

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await act(async () => {
      onNext?.(
        snapshot([
          { id: 'cloud_1', data: { vendorName: 'Offline Vendor', organizationId: ORG, portalOpen: true } },
        ]),
      );
      await flush();
    });

    expect(result.current.mode).toBe('firestore');
    expect(addedDocs).toHaveLength(1);
    // The local_ id must not be written into the document body.
    expect(addedDocs[0]).not.toHaveProperty('id');
    expect(listLocalAssessments(ORG)).toHaveLength(0);
    // The merge must not leave the local copy alongside the cloud one.
    expect(result.current.assessments).toHaveLength(1);
    expect(result.current.assessments[0].id).toBe('cloud_1');
  });

  it('keeps an unpromotable row visible instead of silently dropping it', async () => {
    // This is the merge earning its keep: if the write fails, the user must still see
    // what they created rather than have it vanish behind an authoritative-looking
    // cloud snapshot.
    makeLocal('Stuck Vendor');
    addDocShouldFail = true;

    const { result } = renderHook(() => useOrgAssessments(ORG));
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

    expect(addedDocs).toHaveLength(0);
    // Still in the local store, so a later reconnect can retry the promotion.
    expect(listLocalAssessments(ORG)).toHaveLength(1);
    // And still on screen despite the cloud snapshot being empty.
    expect(result.current.assessments.map((a) => a.vendorName)).toContain('Stuck Vendor');
  });

  it('normalizes vendor answers off the cloud document (KNOWN_ISSUES #3 regression)', async () => {
    const { result } = renderHook(() => useOrgAssessments(ORG));
    await act(async () => {
      onNext?.(
        snapshot([
          {
            id: 'a1',
            data: {
              vendorName: 'Acme',
              organizationId: ORG,
              answers: { q_1: 'Yes', q_2: ['ISO 27001'] },
              comments: { q_1: 'via SSO' },
            },
          },
        ]),
      );
      await flush();
    });

    // These were dropped in normalizeCloudDoc before #3 was fixed, which is why the
    // reviewer always saw "No response provided."
    expect(result.current.assessments[0].answers).toEqual({ q_1: 'Yes', q_2: ['ISO 27001'] });
    expect(result.current.assessments[0].comments).toEqual({ q_1: 'via SSO' });
  });
});

/**
 * KNOWN_ISSUES #5 — retry / promotion for local-only vendors + assessments.
 *
 * Covers the previously unexecuted paths:
 *   1. promoteLocal* writes Firestore docs and drops local_* rows
 *   2. a failed promote leaves the local row for the next attempt
 *   3. local-mode hooks re-subscribe on the 30s retry tick and promote on reconnect
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onSnapshot } from 'firebase/firestore';
import { createLocalVendor, listLocalVendors } from '../lib/vendor/localVendorStore';
import {
  createLocalAssessment,
  listLocalAssessments,
} from '../lib/vendor/localAssessmentStore';
import {
  promoteLocalVendors,
  useOrgVendors,
  VENDOR_RETRY_INTERVAL_MS,
} from '../lib/vendor/useOrgVendors';
import {
  promoteLocalAssessments,
  useOrgAssessments,
  ASSESSMENT_RETRY_INTERVAL_MS,
} from '../lib/vendor/useOrgAssessments';

vi.mock('../lib/authHeaders', () => ({
  authHeaders: vi.fn(async (headers: Record<string, string>) => headers),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
const onSnapshotMock = vi.mocked(onSnapshot);

function apiResponse(body: Record<string, unknown>, ok = true): Response {
  return {
    ok,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

function defaultPromotionFetch(url: string | URL | Request) {
  const target = String(url);
  if (target.includes('/api/org/vendor-create')) {
    return Promise.resolve(apiResponse({ vendorId: 'cloud_v1' }));
  }
  if (target.includes('/api/org/assessment-create')) {
    return Promise.resolve(apiResponse({ assessmentId: 'cloud_a1' }));
  }
  return Promise.resolve(apiResponse({ error: 'unexpected endpoint' }, false));
}

function emptySnap() {
  return { docs: [], size: 0, forEach: () => undefined };
}

describe('promoteLocalVendors (KI#5)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-7f582');
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(defaultPromotionFetch);
  });

  it('writes each local_* vendor to Firestore and removes it from localStorage', async () => {
    const a = createLocalVendor('org1', { name: 'Acme', category: 'SaaS', criticality: 'High' });
    const b = createLocalVendor('org1', { name: 'Beta', category: 'IT Services', criticality: 'Low' });
    expect(a.id.startsWith('local_')).toBe(true);
    expect(listLocalVendors('org1')).toHaveLength(2);

    await promoteLocalVendors('org1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const payloads = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String((init as RequestInit).body || '{}')) as { name: string }
    );
    expect(payloads.map((p) => p.name).sort()).toEqual(['Acme', 'Beta']);
    expect(fetchMock.mock.calls.every(([url]) => String(url) === '/api/org/vendor-create')).toBe(true);
    expect(listLocalVendors('org1')).toEqual([]);
    // Other orgs untouched
    createLocalVendor('org2', { name: 'Other', category: 'SaaS', criticality: 'Medium' });
    await promoteLocalVendors('org1');
    expect(listLocalVendors('org2')).toHaveLength(1);
  });

  it('keeps a local vendor when addDoc fails so the next reconnect can retry', async () => {
    createLocalVendor('org1', { name: 'Keep Me', category: 'SaaS', criticality: 'High' });
    createLocalVendor('org1', { name: 'Also Local', category: 'SaaS', criticality: 'Low' });
    // Fail the first promote attempt (newest-first order from listLocalVendors), succeed the second
    fetchMock
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(apiResponse({ vendorId: 'cloud_ok' }));

    await promoteLocalVendors('org1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const remaining = listLocalVendors('org1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Also Local');
  });

  it('ignores already-cloud rows that somehow sat in the local store', async () => {
    createLocalVendor('org1', { name: 'Local', category: 'SaaS', criticality: 'High' });
    const store = JSON.parse(localStorage.getItem('guardentra.localVendors.v1') || '{}');
    store.org1.push({
      id: 'firestore_abc',
      name: 'Cloud Mirror',
      category: 'SaaS',
      criticality: 'Low',
      organizationId: 'org1',
      createdAt: new Date().toISOString(),
      status: 'Active',
      riskScore: 0,
      ownerName: 'Unassigned',
      assessmentStatus: 'Not Started',
    });
    localStorage.setItem('guardentra.localVendors.v1', JSON.stringify(store));

    await promoteLocalVendors('org1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/org/vendor-create');
    expect(listLocalVendors('org1').map((v) => v.id)).toEqual(['firestore_abc']);
  });
});

describe('promoteLocalAssessments (KI#5)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-7f582');
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(defaultPromotionFetch);
  });

  it('writes local_asm_* assessments to Firestore and clears them locally', async () => {
    const a = createLocalAssessment('org1', {
      vendorId: 'v1',
      vendorName: 'Acme',
      frameworks: ['soc2'],
    });
    expect(a.id.startsWith('local_asm_')).toBe(true);

    await promoteLocalAssessments('org1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/org/assessment-create');
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body || '{}')) as {
      vendorId: string;
      frameworks: string[];
    };
    expect(payload.vendorId).toBe('v1');
    expect(payload.frameworks).toEqual(['soc2']);
    expect(listLocalAssessments('org1')).toEqual([]);
  });

  it('keeps a local assessment when promotion fails', async () => {
    const a = createLocalAssessment('org1', {
      vendorId: 'v1',
      vendorName: 'Acme',
      frameworks: ['iso27001'],
    });
    fetchMock.mockRejectedValueOnce(new Error('unavailable'));

    await promoteLocalAssessments('org1');

    expect(listLocalAssessments('org1')).toEqual([expect.objectContaining({ id: a.id })]);
  });

  it('remaps local vendorId onto the cloud vendor id when promoting', async () => {
    const vendor = createLocalVendor('org1', { name: 'Acme', category: 'SaaS', criticality: 'High' });
    createLocalAssessment('org1', {
      vendorId: vendor.id,
      vendorName: 'Acme',
      frameworks: ['soc2'],
    });
    fetchMock
      .mockResolvedValueOnce(apiResponse({ vendorId: 'cloud_vendor_1' }))
      .mockResolvedValueOnce(apiResponse({ assessmentId: 'cloud_asm_1' }));

    await promoteLocalAssessments('org1');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/org/vendor-create');
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/org/assessment-create');
    const asmPayload = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body || '{}')
    ) as { vendorId: string };
    expect(asmPayload.vendorId).toBe('cloud_vendor_1');
    expect(listLocalAssessments('org1')).toEqual([]);
  });
});

describe('useOrgVendors retry → promote on reconnect (KI#5)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-7f582');
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(defaultPromotionFetch);
    onSnapshotMock.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to local, retries on the interval, then promotes local_* rows', async () => {
    createLocalVendor('org1', { name: 'Offline Co', category: 'SaaS', criticality: 'High' });

    let subscribeCount = 0;
    onSnapshotMock.mockImplementation((_q, onNext, onError) => {
      subscribeCount += 1;
      if (subscribeCount === 1) {
        // First listen fails → local mode
        queueMicrotask(() => onError?.(new Error('unavailable') as never));
      } else {
        // Retry re-subscribes; cloud is back
        queueMicrotask(() => {
          void Promise.resolve((onNext as (s: unknown) => void)(emptySnap()));
        });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useOrgVendors('org1'));

    await waitFor(() => expect(result.current.mode).toBe('local'));
    expect(result.current.vendors.some((v) => v.name === 'Offline Co')).toBe(true);
    expect(listLocalVendors('org1')).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(VENDOR_RETRY_INTERVAL_MS);
    });

    await waitFor(() => expect(result.current.mode).toBe('firestore'));
    expect(fetchMock).toHaveBeenCalled();
    expect(listLocalVendors('org1')).toEqual([]);
    expect(subscribeCount).toBeGreaterThanOrEqual(2);
  });
});

describe('useOrgAssessments retry → promote on reconnect (KI#5)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-7f582');
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(defaultPromotionFetch);
    onSnapshotMock.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to local, retries on the interval, then promotes local_asm_* rows', async () => {
    createLocalAssessment('org1', {
      vendorId: 'v1',
      vendorName: 'Offline Vendor',
      frameworks: ['soc2'],
    });

    let subscribeCount = 0;
    onSnapshotMock.mockImplementation((_q, onNext, onError) => {
      subscribeCount += 1;
      if (subscribeCount === 1) {
        queueMicrotask(() => onError?.(new Error('unavailable') as never));
      } else {
        queueMicrotask(() => {
          void Promise.resolve((onNext as (s: unknown) => void)(emptySnap()));
        });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useOrgAssessments('org1'));

    await waitFor(() => expect(result.current.mode).toBe('local'));
    expect(listLocalAssessments('org1')).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASSESSMENT_RETRY_INTERVAL_MS);
    });

    await waitFor(() => expect(result.current.mode).toBe('firestore'));
    expect(fetchMock).toHaveBeenCalled();
    expect(listLocalAssessments('org1')).toEqual([]);
    expect(subscribeCount).toBeGreaterThanOrEqual(2);
  });
});

describe('hosted environments never silently promote local-only rows', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'guardentra-prod');
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(defaultPromotionFetch);
  });

  it('does not write leftover local vendors into hosted Firestore', async () => {
    createLocalVendor('org1', { name: 'Leftover', category: 'SaaS', criticality: 'High' });
    const idMap = await promoteLocalVendors('org1');
    expect(idMap.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listLocalVendors('org1')).toHaveLength(1);
  });

  it('does not write leftover local assessments into hosted Firestore', async () => {
    createLocalAssessment('org1', {
      vendorId: 'v1',
      vendorName: 'Leftover',
      frameworks: ['soc2'],
    });
    await promoteLocalAssessments('org1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(listLocalAssessments('org1')).toHaveLength(1);
  });
});

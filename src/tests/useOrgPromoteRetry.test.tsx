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
import { addDoc, onSnapshot } from 'firebase/firestore';
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

const addDocMock = vi.mocked(addDoc);
const onSnapshotMock = vi.mocked(onSnapshot);

function emptySnap() {
  return { docs: [], size: 0, forEach: () => undefined };
}

describe('promoteLocalVendors (KI#5)', () => {
  beforeEach(() => {
    localStorage.clear();
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'cloud_v1' } as never);
  });

  it('writes each local_* vendor to Firestore and removes it from localStorage', async () => {
    const a = createLocalVendor('org1', { name: 'Acme', category: 'SaaS', criticality: 'High' });
    const b = createLocalVendor('org1', { name: 'Beta', category: 'IT Services', criticality: 'Low' });
    expect(a.id.startsWith('local_')).toBe(true);
    expect(listLocalVendors('org1')).toHaveLength(2);

    await promoteLocalVendors('org1');

    expect(addDocMock).toHaveBeenCalledTimes(2);
    const payloads = addDocMock.mock.calls.map(([, data]) => data as { name: string; id?: string });
    expect(payloads.map((p) => p.name).sort()).toEqual(['Acme', 'Beta']);
    expect(payloads.every((p) => p.id === undefined)).toBe(true);
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
    addDocMock
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce({ id: 'cloud_ok' } as never);

    await promoteLocalVendors('org1');

    expect(addDocMock).toHaveBeenCalledTimes(2);
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

    expect(addDocMock).toHaveBeenCalledTimes(1);
    expect(listLocalVendors('org1').map((v) => v.id)).toEqual(['firestore_abc']);
  });
});

describe('promoteLocalAssessments (KI#5)', () => {
  beforeEach(() => {
    localStorage.clear();
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'cloud_a1' } as never);
  });

  it('writes local_asm_* assessments to Firestore and clears them locally', async () => {
    const a = createLocalAssessment('org1', {
      vendorId: 'v1',
      vendorName: 'Acme',
      frameworks: ['soc2'],
    });
    expect(a.id.startsWith('local_asm_')).toBe(true);

    await promoteLocalAssessments('org1');

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = addDocMock.mock.calls[0][1] as { vendorName: string; id?: string };
    expect(payload.vendorName).toBe('Acme');
    expect(payload.id).toBeUndefined();
    expect(listLocalAssessments('org1')).toEqual([]);
  });

  it('keeps a local assessment when promotion fails', async () => {
    const a = createLocalAssessment('org1', {
      vendorId: 'v1',
      vendorName: 'Acme',
      frameworks: ['iso27001'],
    });
    addDocMock.mockRejectedValueOnce(new Error('unavailable'));

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
    addDocMock
      .mockResolvedValueOnce({ id: 'cloud_vendor_1' } as never)
      .mockResolvedValueOnce({ id: 'cloud_asm_1' } as never);

    await promoteLocalAssessments('org1');

    expect(addDocMock).toHaveBeenCalledTimes(2);
    const asmPayload = addDocMock.mock.calls[1][1] as { vendorId: string };
    expect(asmPayload.vendorId).toBe('cloud_vendor_1');
    expect(listLocalAssessments('org1')).toEqual([]);
  });
});

describe('useOrgVendors retry → promote on reconnect (KI#5)', () => {
  beforeEach(() => {
    localStorage.clear();
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'cloud_v' } as never);
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
    expect(addDocMock).toHaveBeenCalled();
    expect(listLocalVendors('org1')).toEqual([]);
    expect(subscribeCount).toBeGreaterThanOrEqual(2);
  });
});

describe('useOrgAssessments retry → promote on reconnect (KI#5)', () => {
  beforeEach(() => {
    localStorage.clear();
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'cloud_a' } as never);
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
    expect(addDocMock).toHaveBeenCalled();
    expect(listLocalAssessments('org1')).toEqual([]);
    expect(subscribeCount).toBeGreaterThanOrEqual(2);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocsMock = vi.fn();
const getDocMock = vi.fn();
const updateDocMock = vi.fn();
const runTransactionMock = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ path: name, id: name })),
  doc: vi.fn((first: { path?: string; id?: string } | unknown, col?: string, id?: string) => {
    if (first && typeof first === 'object' && 'path' in first && first.path === 'organizations' && !col) {
      return { path: 'organizations/auto_org_1', id: 'auto_org_1' };
    }
    const resolved = id ? `${col}/${id}` : String(col || '');
    const last = resolved.split('/').pop() || resolved;
    return { path: resolved, id: last, collection: col };
  }),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  limit: vi.fn((n: number) => n),
  query: vi.fn((...parts: unknown[]) => parts),
  runTransaction: (...args: unknown[]) => runTransactionMock(...args),
  where: vi.fn((...parts: unknown[]) => parts),
  writeBatch: vi.fn(() => ({
    set: batchSet,
    update: batchUpdate,
    commit: batchCommit,
  })),
}));

vi.mock('../firebase', () => ({ db: {} }));

import {
  __resetBootstrapStateForTests,
  bootstrapUserProfile,
  claimInviteSeat,
  InviteLookupUnavailableError,
  resolveBootstrapJoinRole,
} from '../lib/orgBootstrap';

let txUser: Record<string, unknown> | null = {
  organizationId: 'org-invited',
  seatCountApplied: false,
};
let txSeat = 2;

function snap(data: Record<string, unknown> | null) {
  return {
    exists: () => data != null,
    data: () => data || {},
    get: (field: string) => data?.[field],
  };
}

function inviteSnap(data: { organizationId: string; role?: string }, id = 'inv_1') {
  return {
    empty: false,
    docs: [{ id, data: () => data }],
  };
}

describe('resolveBootstrapJoinRole', () => {
  it('grants admin only when the invite already carries admin', () => {
    expect(resolveBootstrapJoinRole('admin')).toBe('admin');
  });

  it('collapses missing, member, and forged privileged roles to member', () => {
    expect(resolveBootstrapJoinRole(undefined)).toBe('member');
    expect(resolveBootstrapJoinRole('member')).toBe('member');
    expect(resolveBootstrapJoinRole('owner')).toBe('member');
    expect(resolveBootstrapJoinRole('superadmin')).toBe('member');
  });
});

describe('bootstrapUserProfile tenant authority', () => {
  beforeEach(() => {
    __resetBootstrapStateForTests();
    getDocsMock.mockReset();
    getDocMock.mockReset();
    updateDocMock.mockReset();
    runTransactionMock.mockReset();
    batchSet.mockReset();
    batchUpdate.mockReset();
    batchCommit.mockReset();
    batchCommit.mockResolvedValue(undefined);
    getDocMock.mockResolvedValue(snap(null));
    txUser = { organizationId: 'org-invited', seatCountApplied: false };
    txSeat = 2;
    runTransactionMock.mockImplementation(async (_db: unknown, fn: (tx: {
      get: (ref: { path?: string }) => Promise<ReturnType<typeof snap>>;
      update: (ref: unknown, data: unknown) => void;
    }) => Promise<void>) => {
      await fn({
        get: async (ref) => snap(String(ref.path).startsWith('users/') ? txUser : { seatCount: txSeat }),
        update: (ref, data) => {
          updateDocMock(ref, data);
        },
      });
    });
  });

  it('fails closed when pending-invite authority is unavailable and commits nothing', async () => {
    getDocsMock.mockRejectedValue(Object.assign(new Error('temporarily unavailable'), { code: 'unavailable' }));

    await expect(
      bootstrapUserProfile('uid-unknown', {
        email: 'invited@example.com',
        displayName: 'Invited User',
      }),
    ).rejects.toMatchObject({
      name: 'InviteLookupUnavailableError',
      code: 'invite-lookup-unavailable',
    });

    expect(batchSet).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(batchCommit).not.toHaveBeenCalled();
    expect(updateDocMock).not.toHaveBeenCalled();
    expect(runTransactionMock).not.toHaveBeenCalled();
  });

  it('exports a retryable typed invite-authority error', () => {
    const error = new InviteLookupUnavailableError();
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('invite-lookup-unavailable');
  });

  it('founder path creates a new org and never uses a caller-supplied organizationId or role', async () => {
    getDocsMock.mockResolvedValue({ empty: true, docs: [] });

    await bootstrapUserProfile('uid-founder', {
      email: 'founder@example.com',
      displayName: 'Founder',
    });

    const profileWrite = batchSet.mock.calls.find((c) => String(c[0]?.path || '').includes('users/'));
    const orgWrite = batchSet.mock.calls.find((c) => String(c[0]?.path || '').includes('organizations/'));
    expect(orgWrite).toBeTruthy();
    expect(profileWrite?.[1]).toMatchObject({
      role: 'admin',
      organizationId: 'auto_org_1',
      email: 'founder@example.com',
      onboarded: true,
    });
    expect(profileWrite?.[1]).not.toHaveProperty('inviteId');
    expect(profileWrite?.[1]).not.toHaveProperty('seatCountApplied');
    expect(profileWrite?.[1].organizationId).not.toBe('attacker-chosen-org');
    expect(runTransactionMock).not.toHaveBeenCalled();
  });

  it('invite path binds organizationId and role from the invite and records inviteId', async () => {
    getDocsMock.mockResolvedValue(inviteSnap({ organizationId: 'org-invited', role: 'member' }, 'inv_abc'));

    await bootstrapUserProfile('uid-join', {
      email: 'join@example.com',
      displayName: 'Joiner',
    });

    const profileWrite = batchSet.mock.calls.find((c) => String(c[0]?.path || '').includes('users/'));
    expect(profileWrite?.[1]).toMatchObject({
      role: 'member',
      organizationId: 'org-invited',
      inviteId: 'inv_abc',
      onboarded: true,
      seatCountApplied: false,
    });
    expect(batchUpdate).toHaveBeenCalled();
    expect(runTransactionMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'organizations/org-invited' }),
      { seatCount: 3 },
    );
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'users/uid-join' }),
      { seatCountApplied: true },
    );
  });

  it('invite path cannot honor a forged privileged role stored on the invite as owner', async () => {
    getDocsMock.mockResolvedValue(inviteSnap({ organizationId: 'org-invited', role: 'owner' }, 'inv_bad'));

    await bootstrapUserProfile('uid-join', {
      email: 'join@example.com',
      displayName: 'Joiner',
    });

    const profileWrite = batchSet.mock.calls.find((c) => String(c[0]?.path || '').includes('users/'));
    expect(profileWrite?.[1].role).toBe('member');
    expect(profileWrite?.[1].organizationId).toBe('org-invited');
  });

  it('retries a failed seat claim and still raises the meter only once', async () => {
    getDocsMock.mockResolvedValue(inviteSnap({ organizationId: 'org-invited', role: 'member' }));
    runTransactionMock
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'));
    await bootstrapUserProfile('uid-retry', {
      email: 'join@example.com',
      displayName: 'Joiner',
    });
    expect(runTransactionMock).toHaveBeenCalledTimes(3);
    expect(updateDocMock).toHaveBeenCalledTimes(2);
  });

  it('does not add a seat when the marker is already true', async () => {
    txUser = { organizationId: 'org-invited', seatCountApplied: true };
    await claimInviteSeat('uid-done', 'org-invited');
    expect(runTransactionMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('does not count a historical profile that omits the marker', async () => {
    txUser = { organizationId: 'org-invited' };
    await claimInviteSeat('uid-old', 'org-invited');
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('a second claim for the same uid does not run again', async () => {
    await claimInviteSeat('uid-once', 'org-invited');
    runTransactionMock.mockClear();
    updateDocMock.mockClear();
    await claimInviteSeat('uid-once', 'org-invited');
    expect(runTransactionMock).not.toHaveBeenCalled();
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('a denied join whose profile already exists still claims the uncounted seat', async () => {
    getDocsMock.mockResolvedValue(inviteSnap({ organizationId: 'org-invited', role: 'member' }));
    batchCommit.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    getDocMock.mockResolvedValue(snap({
      organizationId: 'org-invited',
      seatCountApplied: false,
    }));
    await expect(bootstrapUserProfile('uid-race', {
      email: 'join@example.com',
      displayName: 'Joiner',
    })).resolves.toBeUndefined();
    expect(runTransactionMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'organizations/org-invited' }),
      { seatCount: 3 },
    );
  });
});

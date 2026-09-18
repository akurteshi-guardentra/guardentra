import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocsMock = vi.fn();
const updateDocMock = vi.fn();
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn();
const incrementMock = vi.fn((n: number) => ({ increment: n }));

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
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  increment: (n: number) => incrementMock(n),
  limit: vi.fn((n: number) => n),
  query: vi.fn((...parts: unknown[]) => parts),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  where: vi.fn((...parts: unknown[]) => parts),
  writeBatch: vi.fn(() => ({
    set: batchSet,
    update: batchUpdate,
    commit: batchCommit,
  })),
}));

vi.mock('../firebase', () => ({ db: {} }));

import {
  bootstrapUserProfile,
  resolveBootstrapJoinRole,
} from '../lib/orgBootstrap';

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
    getDocsMock.mockReset();
    updateDocMock.mockReset();
    batchSet.mockReset();
    batchUpdate.mockReset();
    batchCommit.mockReset();
    batchCommit.mockResolvedValue(undefined);
    updateDocMock.mockResolvedValue(undefined);
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
    });
    expect(profileWrite?.[1]).not.toHaveProperty('inviteId');
    expect(profileWrite?.[1].organizationId).not.toBe('attacker-chosen-org');
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
    });
    expect(batchUpdate).toHaveBeenCalled();
    expect(updateDocMock).toHaveBeenCalled();
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
});

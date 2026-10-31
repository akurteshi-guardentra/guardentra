import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * #124 finding (2026-10-31): sign-up ran two founder bootstraps for one uid
 * (AuthContext auto-init + signUpWithEmail). The first created
 * "New User's Organization"; the second was denied by the rules.
 */

const getDocsMock = vi.fn();
const getDocMock = vi.fn();
const batchSet = vi.fn();
const batchCommit = vi.fn();
let orgSeq = 0;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ path: name, id: name })),
  doc: vi.fn((first: { path?: string } | unknown, col?: string, id?: string) => {
    if (first && typeof first === 'object' && 'path' in first && first.path === 'organizations' && !col) {
      orgSeq += 1;
      return { path: `organizations/auto_org_${orgSeq}`, id: `auto_org_${orgSeq}` };
    }
    const resolved = id ? `${col}/${id}` : String(col || '');
    return { path: resolved, id: resolved.split('/').pop() };
  }),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  increment: vi.fn((n: number) => ({ increment: n })),
  limit: vi.fn((n: number) => n),
  query: vi.fn((...parts: unknown[]) => parts),
  updateDoc: vi.fn(async () => undefined),
  where: vi.fn((...parts: unknown[]) => parts),
  writeBatch: vi.fn(() => ({ set: batchSet, update: vi.fn(), commit: batchCommit })),
}));

vi.mock('../firebase', () => ({ db: {} }));

import {
  __resetBootstrapStateForTests,
  bootstrapUserProfile,
  rememberSignupProfile,
} from '../lib/orgBootstrap';

const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

function orgWrites() {
  return batchSet.mock.calls.filter((c) => String(c[0]?.path || '').startsWith('organizations/'));
}

describe('sign-up bootstrap race', () => {
  beforeEach(() => {
    __resetBootstrapStateForTests();
    orgSeq = 0;
    getDocsMock.mockReset().mockResolvedValue({ empty: true, docs: [] });
    getDocMock.mockReset().mockResolvedValue({ exists: () => false });
    batchSet.mockReset();
    batchCommit.mockReset().mockResolvedValue(undefined);
  });

  it('concurrent callers for one uid share a single founder batch', async () => {
    const a = bootstrapUserProfile('uid-1', { email: 'new@example.com', displayName: 'New User' });
    const b = bootstrapUserProfile('uid-1', { email: 'new@example.com', displayName: 'Dana' });
    await Promise.all([a, b]);
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(orgWrites()).toHaveLength(1);
  });

  it('uses the name typed in the sign-up form even when auto-init runs first', async () => {
    rememberSignupProfile('New@Example.com', 'Dana Smith');
    await bootstrapUserProfile('uid-2', { email: 'new@example.com', displayName: 'New User' });
    const [org] = orgWrites();
    expect(org[1].name).toBe("Dana Smith's Organization");
    const profile = batchSet.mock.calls.find((c) => String(c[0]?.path) === 'users/uid-2');
    expect(profile?.[1].displayName).toBe('Dana Smith');
  });

  it('does not apply a remembered name to a different email', async () => {
    rememberSignupProfile('someone@example.com', 'Someone');
    await bootstrapUserProfile('uid-3', { email: 'other@example.com', displayName: 'Other' });
    expect(orgWrites()[0][1].name).toBe("Other's Organization");
  });

  it('a denied commit is success only when the profile already exists', async () => {
    batchCommit.mockRejectedValueOnce(denied());
    getDocMock.mockResolvedValueOnce({ exists: () => true });
    await expect(
      bootstrapUserProfile('uid-4', { email: 'new@example.com', displayName: 'Dana' }),
    ).resolves.toBeUndefined();
  });

  it('a denied commit with no profile still fails closed', async () => {
    batchCommit.mockRejectedValueOnce(denied());
    await expect(
      bootstrapUserProfile('uid-5', { email: 'new@example.com', displayName: 'Dana' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('non-permission errors are not swallowed', async () => {
    batchCommit.mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }));
    getDocMock.mockResolvedValue({ exists: () => true });
    await expect(
      bootstrapUserProfile('uid-6', { email: 'new@example.com', displayName: 'Dana' }),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });
});

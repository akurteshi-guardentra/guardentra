import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('sessionRedirect cloud authority (#67)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('routes bootstrapped cloud profile to dashboard', async () => {
    vi.doMock('../firebase', () => ({
      auth: { currentUser: { uid: 'u1' } },
      db: {},
    }));
    vi.doMock('firebase/auth', () => ({
      onAuthStateChanged: (_auth: unknown, cb: (u: { uid: string } | null) => void) => {
        queueMicrotask(() => cb({ uid: 'u1' }));
        return () => {};
      },
    }));
    vi.doMock('firebase/firestore', () => ({
      doc: vi.fn(() => ({ path: 'users/u1' })),
      getDoc: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ onboarded: true, organizationId: 'org1' }),
      })),
    }));

    const { resolveSignedInRedirect } = await import('../lib/sessionRedirect');
    const { isLocallyOnboarded } = await import('../lib/onboardingFlag');
    await expect(resolveSignedInRedirect()).resolves.toBe('/dashboard');
    expect(isLocallyOnboarded('u1')).toBe(true);
  });

  it('routes incomplete optional setup (onboarded=false) to dashboard when organizationId is bound', async () => {
    vi.doMock('../firebase', () => ({
      auth: { currentUser: { uid: 'u2' } },
      db: {},
    }));
    vi.doMock('firebase/auth', () => ({
      onAuthStateChanged: (_auth: unknown, cb: (u: { uid: string } | null) => void) => {
        queueMicrotask(() => cb({ uid: 'u2' }));
        return () => {};
      },
    }));
    vi.doMock('firebase/firestore', () => ({
      doc: vi.fn(() => ({ path: 'users/u2' })),
      getDoc: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ onboarded: false, organizationId: 'org2' }),
      })),
    }));

    const flag = await import('../lib/onboardingFlag');
    flag.setLocallyOnboarded('u2');
    expect(flag.isLocallyOnboarded('u2')).toBe(true);

    const { resolveSignedInRedirect } = await import('../lib/sessionRedirect');
    await expect(resolveSignedInRedirect()).resolves.toBe('/dashboard');
    // Local onboarded cache cleared when cloud onboarded is false — cache is not routing authority.
    expect(flag.isLocallyOnboarded('u2')).toBe(false);
  });

  it('does not invent dashboard access without organizationId', async () => {
    vi.doMock('../firebase', () => ({
      auth: { currentUser: { uid: 'u3' } },
      db: {},
    }));
    vi.doMock('firebase/auth', () => ({
      onAuthStateChanged: (_auth: unknown, cb: (u: { uid: string } | null) => void) => {
        queueMicrotask(() => cb({ uid: 'u3' }));
        return () => {};
      },
    }));
    vi.doMock('firebase/firestore', () => ({
      doc: vi.fn(() => ({ path: 'users/u3' })),
      getDoc: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ onboarded: false }),
      })),
    }));

    const { resolveSignedInRedirect } = await import('../lib/sessionRedirect');
    await expect(resolveSignedInRedirect()).resolves.toBeNull();
  });
});

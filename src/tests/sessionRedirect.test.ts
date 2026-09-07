import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('sessionRedirect cloud authority', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('routes completed cloud profile to dashboard and syncs local cache', async () => {
    vi.doMock('../firebase', () => ({
      auth: { currentUser: { uid: 'u1' } },
      db: {},
    }));
    vi.doMock('firebase/auth', () => ({
      onAuthStateChanged: (_auth: unknown, cb: (u: { uid: string } | null) => void) => {
        // Defer so unsub assignment completes (matches real Firebase async delivery).
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

  it('routes incomplete cloud profile to onboarding even if stale local flag exists', async () => {
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
    await expect(resolveSignedInRedirect()).resolves.toBe('/onboarding');
    expect(flag.isLocallyOnboarded('u2')).toBe(false);
  });
});

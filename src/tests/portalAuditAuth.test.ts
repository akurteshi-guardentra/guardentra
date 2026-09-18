/**
 * GitHub #63 — vendor-portal audit authentication.
 *
 * The bug: VendorPortal.tsx's emitAuditBestEffort() calls went through the
 * default-app authHeaders(), which reads `auth.currentUser` on the DEFAULT
 * Firebase app. A vendor portal session only ever signs in on the SECONDARY
 * `guardentra-portal` app (getPortalAuth()), so `auth.currentUser` was always
 * null for a vendor — no Authorization header was ever attached, and
 * requireFirebaseAuth 401s the request in staging/prod. The failure was
 * swallowed by emitAuditBestEffort's catch, so every vendor-originated audit
 * event silently vanished with no signal.
 *
 * The fix: auditClient.ts now accepts an injectable `getAuthHeaders` header
 * provider (default: the existing default-app `authHeaders`, unchanged —
 * this is the org/admin path). portalAuth.ts exports a new
 * `getPortalAuthHeaders` provider that reads ONLY the portal app's
 * `currentUser`, and throws (fails closed, no fetch is ever sent) when that
 * session is absent or its token can't be refreshed. VendorPortal.tsx passes
 * `{ getAuthHeaders: getPortalAuthHeaders }` at all 5 of its audit call sites.
 *
 * These tests mock `firebase/app`/`firebase/auth` locally (overriding the
 * global vitest.setup.ts mock for this file only) with one independent fake
 * Auth instance per named Firebase app, so a "default app signed in" state
 * and a "portal app signed in" state can never be confused with each other —
 * exactly the condition the bug depended on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeUser = { uid: string; getIdToken: () => Promise<string> };
type FakeAuth = { currentUser: FakeUser | null };

// vi.mock(...) factories below are hoisted above normal module code, so the
// state they close over must be created via vi.hoisted() rather than a plain
// top-level const — otherwise src/firebase.ts's eager `getAuth(app)` call (it
// runs at import time) hits this object before its declaration initializes.
const { authInstances, fakeAuthFor } = vi.hoisted(() => {
  type FakeUser = { uid: string; getIdToken: () => Promise<string> };
  type FakeAuth = { currentUser: FakeUser | null };
  const authInstances: Record<string, FakeAuth> = {};
  function fakeAuthFor(name: string): FakeAuth {
    if (!authInstances[name]) authInstances[name] = { currentUser: null };
    return authInstances[name];
  }
  return { authInstances, fakeAuthFor };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn((_config: unknown, name?: string) => ({ name: name || '[DEFAULT]' })),
  getApp: vi.fn((name?: string) => ({ name: name || '[DEFAULT]' })),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn((app: { name?: string } | undefined) => fakeAuthFor(app?.name || '[DEFAULT]')),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'browserLocalPersistence',
}));

import { emitAuditEvent, emitAuditBestEffort } from '../lib/auditClient';
import { getPortalAuth, getPortalAuthHeaders } from '../lib/vendor/portalAuth';

const DEFAULT_APP_NAME = '[DEFAULT]';
const PORTAL_APP_NAME = 'guardentra-portal';

function setDefaultAppUser(user: FakeUser | null) {
  fakeAuthFor(DEFAULT_APP_NAME).currentUser = user;
}
function setPortalAppUser(user: FakeUser | null) {
  fakeAuthFor(PORTAL_APP_NAME).currentUser = user;
}

function fetchMock(status: number, body: unknown = {}) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

const SENTINEL_PORTAL_TOKEN = 'PORTAL_ID_TOKEN_SENTINEL_do_not_leak_9f13';
const SENTINEL_ORG_TOKEN = 'ORG_ID_TOKEN_SENTINEL_do_not_leak_2a77';

describe('vendor-portal audit authentication (GitHub #63)', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    setDefaultAppUser(null);
    setPortalAppUser(null);
    originalFetch = global.fetch;
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('authenticated portal session emits audit request with the portal ID token (PASS)', async () => {
    setPortalAppUser({ uid: 'portal_a1', getIdToken: async () => SENTINEL_PORTAL_TOKEN });
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await emitAuditEvent(
      {
        tenantId: 'org-1',
        eventType: 'assessment.submitted',
        objectType: 'assessment',
        objectId: 'a1',
      },
      { getAuthHeaders: getPortalAuthHeaders }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchSpy as any).mock.calls[0];
    expect(url).toBe('/api/audit/emit');
    expect(init.headers.Authorization).toBe(`Bearer ${SENTINEL_PORTAL_TOKEN}`);
  });

  it('missing portal auth fails closed: no fetch is sent and the error is not fabricated as success', async () => {
    setPortalAppUser(null); // no portal session established
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await expect(
      emitAuditEvent(
        { tenantId: 'org-1', eventType: 'assessment.submitted', objectType: 'assessment', objectId: 'a1' },
        { getAuthHeaders: getPortalAuthHeaders }
      )
    ).rejects.toThrow(/no signed-in portal session/i);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('expired/unrefreshable portal auth fails closed: no fetch is sent', async () => {
    setPortalAppUser({
      uid: 'portal_a1',
      getIdToken: async () => {
        throw new Error('auth/user-token-expired');
      },
    });
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await expect(
      emitAuditEvent(
        { tenantId: 'org-1', eventType: 'evidence.uploaded', objectType: 'assessment', objectId: 'a1' },
        { getAuthHeaders: getPortalAuthHeaders }
      )
    ).rejects.toThrow(/could not be refreshed/i);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('best-effort wrapper swallows the missing/expired-auth failure without reporting success, and does not call fetch', async () => {
    setPortalAppUser(null);
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await expect(
      emitAuditBestEffort(
        { tenantId: 'org-1', eventType: 'assessment.submitted', objectType: 'assessment', objectId: 'a1' },
        { getAuthHeaders: getPortalAuthHeaders }
      )
    ).resolves.toBeUndefined(); // never throws to the caller...

    expect(fetchSpy).not.toHaveBeenCalled(); // ...but never silently "succeeded" either
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0][0]).toBe('emitAuditBestEffort');
  });

  it('ordinary org/admin audit path still works, unchanged, via the default provider', async () => {
    setDefaultAppUser({ uid: 'org-admin-1', getIdToken: async () => SENTINEL_ORG_TOKEN });
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    // No opts passed — exactly how VendorsDirectory.tsx / AssessmentWizard.tsx /
    // Assessments.tsx call this today. Must keep using the default-app token.
    await emitAuditEvent({
      tenantId: 'org-1',
      eventType: 'decision.finalized',
      objectType: 'assessment',
      objectId: 'a1',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = (fetchSpy as any).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${SENTINEL_ORG_TOKEN}`);
  });

  it('a signed-in default-app (org) identity cannot authorize a portal audit request — no cross-app confusion', async () => {
    // Org admin IS signed in on the default app...
    setDefaultAppUser({ uid: 'org-admin-1', getIdToken: async () => SENTINEL_ORG_TOKEN });
    // ...but the portal app has no session at all (the realistic "wrong app" case:
    // nothing ever signed in to guardentra-portal for this browser tab).
    setPortalAppUser(null);
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await expect(
      emitAuditEvent(
        { tenantId: 'org-1', eventType: 'assessment.submitted', objectType: 'assessment', objectId: 'a1' },
        { getAuthHeaders: getPortalAuthHeaders }
      )
    ).rejects.toThrow(/no signed-in portal session/i);

    // The org admin's perfectly valid default-app token must never be substituted in.
    expect(fetchSpy).not.toHaveBeenCalled();
    // And the portal auth instance itself is provably independent of the default app's.
    expect(getPortalAuth().currentUser).toBeNull();
  });

  it('the two Firebase app auth instances are structurally independent (getPortalAuth never reads the default app)', () => {
    setDefaultAppUser({ uid: 'org-admin-2', getIdToken: async () => SENTINEL_ORG_TOKEN });
    setPortalAppUser({ uid: 'portal_b2', getIdToken: async () => SENTINEL_PORTAL_TOKEN });

    expect(getPortalAuth().currentUser?.uid).toBe('portal_b2');
    expect(getPortalAuth().currentUser).not.toBe(fakeAuthFor(DEFAULT_APP_NAME).currentUser);
  });

  it('submission audit event (assessment.submitted) uses the portal-authed path', async () => {
    setPortalAppUser({ uid: 'portal_c3', getIdToken: async () => SENTINEL_PORTAL_TOKEN });
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await emitAuditBestEffort(
      {
        tenantId: 'org-1',
        eventType: 'assessment.submitted',
        objectType: 'assessment',
        objectId: 'a1',
        payload: { vendorId: 'v1', questionCount: 12, attestedByName: 'Jane Vendor' },
      },
      { getAuthHeaders: getPortalAuthHeaders }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = (fetchSpy as any).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${SENTINEL_PORTAL_TOKEN}`);
    const sentBody = JSON.parse(init.body);
    expect(sentBody.eventType).toBe('assessment.submitted');
  });

  it('evidence audit event (evidence.uploaded) uses the portal-authed path', async () => {
    setPortalAppUser({ uid: 'portal_d4', getIdToken: async () => SENTINEL_PORTAL_TOKEN });
    const fetchSpy = fetchMock(200, { ok: true });
    global.fetch = fetchSpy;

    await emitAuditBestEffort(
      {
        tenantId: 'org-1',
        eventType: 'evidence.uploaded',
        objectType: 'assessment',
        objectId: 'a1',
        payload: { questionId: 'q1', fileName: 'soc2.pdf', contentType: 'application/pdf' },
      },
      { getAuthHeaders: getPortalAuthHeaders }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = (fetchSpy as any).mock.calls[0];
    expect(init.headers.Authorization).toBe(`Bearer ${SENTINEL_PORTAL_TOKEN}`);
    const sentBody = JSON.parse(init.body);
    expect(sentBody.eventType).toBe('evidence.uploaded');
  });

  it('spine-disabled (503) no-op semantics are preserved on the portal path', async () => {
    setPortalAppUser({ uid: 'portal_e5', getIdToken: async () => SENTINEL_PORTAL_TOKEN });
    global.fetch = fetchMock(503, { error: 'Audit spine disabled' });

    await expect(
      emitAuditEvent(
        { tenantId: 'org-1', eventType: 'assessment.submitted', objectType: 'assessment', objectId: 'a1' },
        { getAuthHeaders: getPortalAuthHeaders }
      )
    ).resolves.toBeUndefined();
  });

  it('never logs the portal or org ID token value, in success or failure', async () => {
    setPortalAppUser({ uid: 'portal_f6', getIdToken: async () => SENTINEL_PORTAL_TOKEN });
    global.fetch = fetchMock(200, { ok: true });
    await emitAuditBestEffort(
      { tenantId: 'org-1', eventType: 'assessment.submitted', objectType: 'assessment', objectId: 'a1' },
      { getAuthHeaders: getPortalAuthHeaders }
    );

    setPortalAppUser(null);
    await emitAuditBestEffort(
      { tenantId: 'org-1', eventType: 'assessment.submitted', objectType: 'assessment', objectId: 'a1' },
      { getAuthHeaders: getPortalAuthHeaders }
    );

    const allLoggedArgs = [...consoleWarnSpy.mock.calls, ...consoleErrorSpy.mock.calls, ...consoleLogSpy.mock.calls]
      .flat()
      .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)));

    for (const entry of allLoggedArgs) {
      expect(entry).not.toContain(SENTINEL_PORTAL_TOKEN);
      expect(entry).not.toContain(SENTINEL_ORG_TOKEN);
      expect(entry.toLowerCase()).not.toContain('bearer ');
    }
  });
});

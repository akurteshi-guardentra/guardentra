// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const boundary = vi.hoisted(() => ({ verify: vi.fn(), read: vi.fn(), transaction: vi.fn(), mint: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: boundary.verify, createCustomToken: boundary.mint }) }));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({ ensureAdmin: vi.fn() }));
vi.mock('../../server/lib/adminDb', () => ({ getAdminDb: () => ({
  collection: () => ({ doc: () => ({ get: boundary.read }) }),
}) }));
vi.mock('../../server/lib/evidenceAccess', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../server/lib/evidenceAccess')>(),
  // Keep the actual handlers and authorization. Replace only external persistence/auth.
  liveEvidenceDeps: () => ({ verifyIdToken: boundary.verify, runAssessmentTransaction: boundary.transaction }),
}));

let server: Server;
let origin: string;
const current = {
  organizationId: 'org-a', vendorId: 'vendor-a', portalOpen: true, status: 'In Progress',
  requesterOrgName: 'Organization', requesterLogoUrl: 'https://example.test/logo',
  decisionNotes: 'private historical field',
  questions: [{ id: 'q1', question: 'MFA?', type: 'yesno', required: true }],
};
const validSubmit = {
  assessmentId: 'a', answers: { q1: 'Yes' }, comments: {}, evidenceByQuestion: {},
  attestations: { accuracy: true, authority: true, attestedByName: 'Synthetic Vendor' },
};
async function call(path: string, body: unknown = { assessmentId: 'a' }, method = 'POST') {
  return fetch(`${origin}/api/portal${path}`, {
    method, headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(async () => {
  vi.resetModules(); // New real limiter maps per mounted application, no mock middleware.
  vi.clearAllMocks();
  boundary.verify.mockResolvedValue({ uid: 'portal_a', portalAssessmentId: 'a' });
  boundary.read.mockResolvedValue({ exists: true, data: () => current });
  boundary.mint.mockResolvedValue('synthetic-custom-token');
  // Synthetic transaction boundary: this is not hosted audit/persistence acceptance.
  boundary.transaction.mockImplementation(async (_id, updater) => updater(current));
  const { default: router } = await import('../../server/routes/portal');
  const app = express();
  app.use(express.json());
  app.use('/api/portal', router);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
});

describe('#124 mounted portal rate-limit isolation', () => {
  it('accepts normal submission after refresh exhausts its allowance on the same client', async () => {
    for (let i = 0; i < 30; i++) {
      const refresh = await call('/assessment-view');
      expect(refresh.status).toBe(200);
      expect((await refresh.json()).assessment).not.toHaveProperty('decisionNotes');
    }
    const blocked = await call('/assessment-view');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    const submit = await call('/submit', validSubmit);
    expect(submit.status).toBe(200);
    expect(await submit.json()).toMatchObject({ ok: true, patch: { status: 'Under Review', portalOpen: false, answers: { q1: 'Yes' } } });
    expect(boundary.transaction).toHaveBeenCalledTimes(1);
    expect((await call('/assessment-view')).status).toBe(429);
  });

  it('preserves the shared 30/minute submit/validate/download policy without blocking refresh', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await call('/submit')).status).toBe(400);
      expect((await call('/evidence-validate')).status).toBe(400);
      expect((await call('/evidence-download', undefined, 'GET')).status).toBe(400);
    }
    expect((await call('/submit', validSubmit)).status).toBe(429);
    expect((await call('/evidence-validate')).status).toBe(429);
    expect((await call('/evidence-download', undefined, 'GET')).status).toBe(429);
    expect(boundary.transaction).not.toHaveBeenCalled();
    expect((await call('/assessment-view')).status).toBe(200);
  });

  it('preserves the independent session allowance of 20/minute', async () => {
    for (let i = 0; i < 20; i++) expect((await call('/session')).status).toBe(200);
    expect((await call('/session')).status).toBe(429);
    expect((await call('/assessment-view')).status).toBe(200);
    expect((await call('/submit', validSubmit)).status).toBe(200);
  });
});

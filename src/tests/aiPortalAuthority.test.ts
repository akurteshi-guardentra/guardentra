// @vitest-environment node
import type { Request, Response } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  generate: vi.fn(),
  profileRead: vi.fn(),
  assessmentRead: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent: boundary.generate }; },
  Type: {},
}));
vi.mock('firebase-admin/app', () => ({ getApps: () => [{}] }));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: boundary.verify }) }));
vi.mock('../../server/lib/adminDb', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: () => ({ get: name === 'users' ? boundary.profileRead : boundary.assessmentRead }),
    }),
  }),
}));
vi.mock('../../server/middleware/requireFirebaseAuth', () => ({
  ensureAdmin: vi.fn(),
  isProductionLike: () => true,
}));

let router: (typeof import('../../server/routes/ai'))['default'];
const portal = { uid: 'portal_synthetic-assessment', portalAssessmentId: 'synthetic-assessment' };

beforeAll(async () => {
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-test-key');
  router = (await import('../../server/routes/ai')).default;
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  boundary.generate.mockResolvedValue({ text: 'synthetic model result' });
  // Even a portal principal with a forged/legacy admin profile must be refused.
  boundary.profileRead.mockResolvedValue({
    exists: true,
    data: () => ({ organizationId: 'synthetic-org', role: 'admin', seatCountApplied: true }),
  });
  boundary.assessmentRead.mockResolvedValue({ exists: true, data: () => ({}) });
  boundary.verify.mockResolvedValue(portal);
});

// Dispatch the actual Express router including its real middleware. No listener,
// model request, Firebase connection, or tenant data is used.
function dispatch(path: string, user: object, body: Record<string, unknown> = {}) {
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = {
      method: 'POST', url: path,
      get path() { return path.split('?')[0]; },
      headers: { authorization: 'Bearer synthetic-token' }, user, body,
    } as unknown as Request;
    let status = 200;
    const res = {
      status(code: number) { status = code; return this; },
      setHeader() { return this; },
      json(payload: Record<string, unknown>) { resolve({ status, body: payload }); return this; },
    } as unknown as Response;
    const dispatcher = router as unknown as {
      handle(req: Request, res: Response, next: (err?: unknown) => void): void;
    };
    dispatcher.handle(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve({ status: 404, body: {} });
    });
  });
}

describe('#210 portal principals cannot use organization AI', () => {
  it('refuses every registered general AI endpoint before profile reads or model calls', async () => {
    const routes = (router as unknown as {
      stack: { route?: { path: string; methods: { post?: boolean } } }[];
    }).stack.flatMap((layer) => layer.route?.methods.post ? [layer.route.path] : []);
    const general = routes.filter((path) => path !== '/propose-answers');
    expect(general).toContain('/generate');
    expect(general).toContain('/analyze');
    for (const path of general) {
      const result = await dispatch(path, portal, { prompt: 'synthetic prompt', context: 'synthetic' });
      expect(result.status, path).toBe(403);
    }
    expect(boundary.profileRead).not.toHaveBeenCalled();
    expect(boundary.generate).not.toHaveBeenCalled();
  });

  it('keeps general AI available to an organization member', async () => {
    const result = await dispatch('/generate', { uid: 'synthetic-member' }, { prompt: 'synthetic prompt' });
    expect(result.status).toBe(200);
    expect(result.body.text).toBe('synthetic model result');
    expect(boundary.profileRead).toHaveBeenCalledOnce();
    expect(boundary.generate).toHaveBeenCalledOnce();
  });

  it('preserves same-assessment proposals and the trusted-evidence gate', async () => {
    const result = await dispatch('/propose-answers', portal, {
      assessmentId: portal.portalAssessmentId,
      questions: [{ id: 'q1', question: 'Synthetic question?' }],
      evidenceFileNames: ['untrusted.pdf'],
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ proposals: [], reason: 'no_trusted_evidence' });
    expect(boundary.verify).toHaveBeenCalledWith('synthetic-token');
    expect(boundary.assessmentRead).toHaveBeenCalledOnce();
    expect(boundary.profileRead).not.toHaveBeenCalled();
    expect(boundary.generate).not.toHaveBeenCalled();
  });

  it('still rejects proposals for a different assessment before reading evidence', async () => {
    const result = await dispatch('/propose-answers', portal, { assessmentId: 'other-assessment' });
    expect(result.status).toBe(403);
    expect(boundary.assessmentRead).not.toHaveBeenCalled();
    expect(boundary.generate).not.toHaveBeenCalled();
  });
});

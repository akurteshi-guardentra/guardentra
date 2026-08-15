import { describe, expect, it, vi } from 'vitest';
import {
  handleEvidenceDownload,
  handlePortalValidate,
  type EvidenceDeps,
} from '../../server/lib/evidenceAccess';

function mockRes() {
  const res: {
    statusCode: number;
    body: unknown;
    status: (n: number) => typeof res;
    json: (b: unknown) => typeof res;
  } = {
    statusCode: 200,
    body: null,
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  return res;
}

function req(opts: {
  token?: string | null;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) {
  return {
    headers: opts.token === null ? {} : { authorization: opts.token ? `Bearer ${opts.token}` : undefined },
    body: opts.body || {},
    query: opts.query || {},
  } as any;
}

function deps(overrides: Partial<EvidenceDeps> = {}): EvidenceDeps {
  return {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'expired') {
        const err = new Error('expired');
        (err as { code?: string }).code = 'auth/id-token-expired';
        throw err;
      }
      if (token === 'malformed') throw new Error('Decoding Firebase ID token failed');
      if (token === 'org') return { uid: 'user-1', email: 'a@org.example' } as any;
      if (token === 'portal-a') return { uid: 'portal_asmA', portalAssessmentId: 'asmA' } as any;
      if (token === 'portal-b') return { uid: 'portal_asmB', portalAssessmentId: 'asmB' } as any;
      if (token === 'no-claim') return { uid: 'user-2' } as any;
      throw new Error('unknown token');
    }),
    getAssessment: vi.fn(async (id: string) => {
      if (id === 'asmA') {
        return { organizationId: 'org1', portalOpen: true, status: 'In Progress' };
      }
      if (id === 'asmClosed') {
        return { organizationId: 'org1', portalOpen: false, status: 'Under Review' };
      }
      if (id === 'asmOtherOrg') {
        return { organizationId: 'org2', portalOpen: true };
      }
      return null;
    }),
    getUser: vi.fn(async (uid: string) => {
      if (uid === 'user-1') return { organizationId: 'org1', role: 'admin' };
      return null;
    }),
    getStorageMetadata: vi.fn(async (path: string) => {
      if (path === 'portal/asmA/missing.pdf') return null;
      if (path.startsWith('portal/asmA/')) {
        return { contentType: 'application/pdf', size: 1200, generation: '1' };
      }
      return { contentType: 'application/pdf', size: 1200, generation: '1' };
    }),
    writeTrustRecord: vi.fn(async (_id, storagePath, record) => ({ ...record, storagePath })),
    signReadUrl: vi.fn(async () => 'https://signed.example/tmp'),
    ...overrides,
  };
}

describe('POST evidence-validate authorization', () => {
  const path = 'portal/asmA/a.pdf';

  it('rejects unauthenticated requests', async () => {
    const res = mockRes();
    await handlePortalValidate(req({ token: null, body: { assessmentId: 'asmA', storagePath: path } }), res as any, deps());
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed tokens', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({ token: 'malformed', body: { assessmentId: 'asmA', storagePath: path } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({ token: 'expired', body: { assessmentId: 'asmA', storagePath: path } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(401);
  });

  it('rejects ordinary organization tokens at the portal endpoint', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({ token: 'org', body: { assessmentId: 'asmA', storagePath: path } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects tokens without portalAssessmentId', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({ token: 'no-claim', body: { assessmentId: 'asmA', storagePath: path } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects portal token for A targeting assessment B', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({
        token: 'portal-a',
        body: { assessmentId: 'asmB', storagePath: 'portal/asmB/x.pdf' },
      }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects a spoofed Storage path for another assessment', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({
        token: 'portal-a',
        body: { assessmentId: 'asmA', storagePath: 'portal/asmB/stolen.pdf' },
      }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects a nonexistent Storage object', async () => {
    const res = mockRes();
    await handlePortalValidate(
      req({
        token: 'portal-a',
        body: { assessmentId: 'asmA', storagePath: 'portal/asmA/missing.pdf' },
      }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(404);
  });

  it('ignores client metadata and forged clean status; records scan_pending not clean', async () => {
    const d = deps();
    const res = mockRes();
    await handlePortalValidate(
      req({
        token: 'portal-a',
        body: {
          assessmentId: 'asmA',
          storagePath: path,
          contentType: 'application/octet-stream',
          sizeBytes: 1,
          scanStatus: 'clean',
          state: 'clean',
        },
      }),
      res as any,
      d
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { state?: string }).state).toBe('scan_pending');
    expect((res.body as { state?: string }).state).not.toBe('clean');
    expect(d.writeTrustRecord).toHaveBeenCalled();
    const written = (d.writeTrustRecord as any).mock.calls[0][2];
    expect(written.contentType).toBe('application/pdf');
    expect(written.sizeBytes).toBe(1200);
    expect(written.state).toBe('scan_pending');
  });

  it('rejects validation after the portal is closed', async () => {
    const d = deps({
      getAssessment: vi.fn(async () => ({ organizationId: 'org1', portalOpen: false })),
    });
    const res = mockRes();
    await handlePortalValidate(
      req({ token: 'portal-a', body: { assessmentId: 'asmA', storagePath: path } }),
      res as any,
      d
    );
    expect(res.statusCode).toBe(403);
  });
});

describe('evidence download', () => {
  it('rejects unauthorized org downloads', async () => {
    const res = mockRes();
    await handleEvidenceDownload(
      req({ token: null, query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' } }),
      res as any,
      deps(),
      'org'
    );
    expect(res.statusCode).toBe(401);
  });

  it('rejects cross-tenant org downloads', async () => {
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'org',
        query: { assessmentId: 'asmOtherOrg', storagePath: 'portal/asmOtherOrg/a.pdf' },
      }),
      res as any,
      deps(),
      'org'
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects portal download of another assessment', async () => {
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'portal-b',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      deps(),
      'portal'
    );
    expect(res.statusCode).toBe(403);
  });
});

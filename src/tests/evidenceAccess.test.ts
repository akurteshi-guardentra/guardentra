import { describe, expect, it, vi } from 'vitest';
import {
  authorizePortalAi,
  handleArchiveEmptyAssessment,
  handleEvidenceDownload,
  handleOrgAttachmentDownload,
  handleOrgDecision,
  handlePortalValidate,
  requirePortalAssessment,
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
      if (token === 'member') return { uid: 'user-member', email: 'm@org.example' } as any;
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
      if (uid === 'user-member') return { organizationId: 'org1', role: 'member' };
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
    runAssessmentTransaction: vi.fn(async (_id, updater) => updater({
      organizationId: 'org1',
      portalOpen: false,
      questions: [],
      answers: {},
    })),
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

  it('allows portal self-download of untrusted files while the portal is open', async () => {
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'portal-a',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      deps(),
      'portal'
    );
    expect(res.statusCode).toBe(200);
  });

  it('does not treat portal self-download as a reviewer bypass', async () => {
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'portal-a',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      deps(),
      'org'
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects reviewer download unless the trust map is authoritative clean', async () => {
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'org',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      deps(),
      'org'
    );
    expect(res.statusCode).toBe(403);
  });

  it('signs a reviewer URL only for authoritative clean evidence matching path and generation', async () => {
    const d = deps({
      getAssessment: vi.fn(async () => ({
        organizationId: 'org1',
        portalOpen: false,
        evidenceTrustByStoragePath: {
          [encodeURIComponent('portal/asmA/a.pdf').replace(/\./g, '%2E')]: {
            state: 'clean',
            storagePath: 'portal/asmA/a.pdf',
            generation: '1',
            updatedAt: 't',
          },
        },
      })),
    });
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'org',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      d,
      'org'
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { url?: string }).url).toBe('https://signed.example/tmp');
  });

  it('rejects reviewer download when the clean record generation is stale', async () => {
    const d = deps({
      getAssessment: vi.fn(async () => ({
        organizationId: 'org1',
        evidenceTrustByStoragePath: {
          [encodeURIComponent('portal/asmA/a.pdf').replace(/\./g, '%2E')]: {
            state: 'clean',
            storagePath: 'portal/asmA/a.pdf',
            generation: '99',
            updatedAt: 't',
          },
        },
      })),
    });
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'org',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      d,
      'org'
    );
    expect(res.statusCode).toBe(403);
  });

  it('rejects reviewer download when the trust record path does not match', async () => {
    const d = deps({
      getAssessment: vi.fn(async () => ({
        organizationId: 'org1',
        evidenceTrustByStoragePath: {
          [encodeURIComponent('portal/asmA/a.pdf').replace(/\./g, '%2E')]: {
            state: 'clean',
            storagePath: 'portal/asmA/other.pdf',
            generation: '1',
            updatedAt: 't',
          },
        },
      })),
    });
    const res = mockRes();
    await handleEvidenceDownload(
      req({
        token: 'org',
        query: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      }),
      res as any,
      d,
      'org'
    );
    expect(res.statusCode).toBe(403);
  });
});

describe('organization attachments', () => {
  const attach = 'orgs/org1/vendors/v1/attachments/pack.pdf';

  it('rejects unauthenticated attachment downloads', async () => {
    const res = mockRes();
    await handleOrgAttachmentDownload(
      req({ token: null, query: { orgId: 'org1', vendorId: 'v1', storagePath: attach } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(401);
  });

  it('rejects cross-tenant attachment downloads', async () => {
    const res = mockRes();
    await handleOrgAttachmentDownload(
      req({
        token: 'org',
        query: { orgId: 'org2', vendorId: 'v1', storagePath: 'orgs/org2/vendors/v1/attachments/pack.pdf' },
      }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(403);
  });

  it('allows same-tenant attachment downloads', async () => {
    const res = mockRes();
    await handleOrgAttachmentDownload(
      req({ token: 'org', query: { orgId: 'org1', vendorId: 'v1', storagePath: attach } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(200);
  });
});

describe('portal AI token binding', () => {
  it('accepts a matching portal token and rejects org, missing, and mismatched claims', async () => {
    await expect(
      authorizePortalAi({ uid: 'p', portalAssessmentId: 'asmA' } as any, 'asmA')
    ).resolves.toBeUndefined();
    await expect(requirePortalAssessment({ uid: 'user-1' } as any, 'asmA')).rejects.toMatchObject({
      status: 403,
    });
    await expect(authorizePortalAi({ uid: 'user-1' } as any, 'asmA')).rejects.toMatchObject({
      status: 403,
    });
    await expect(authorizePortalAi({ uid: 'p' } as any, 'asmA')).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      authorizePortalAi({ uid: 'p', portalAssessmentId: 'asmA' } as any, 'asmB')
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('org decisions', () => {
  it('rejects missing outcomes', async () => {
    const res = mockRes();
    await handleOrgDecision(
      req({ token: 'org', body: { assessmentId: 'asmA' } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects unknown outcomes', async () => {
    const res = mockRes();
    await handleOrgDecision(
      req({ token: 'org', body: { assessmentId: 'asmA', outcome: 'ship-it' } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects remediate without required notes', async () => {
    const res = mockRes();
    await handleOrgDecision(
      req({ token: 'org', body: { assessmentId: 'asmA', outcome: 'remediate' } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(400);
  });

  it('rejects a second decision and concurrent replacement of approved with remediate', async () => {
    const store: Record<string, unknown> = {
      organizationId: 'org1',
      questions: [],
      answers: {},
    };
    const d = deps({
      runAssessmentTransaction: vi.fn(async (_id, updater) => {
        const snapshot = { ...store };
        const patch = await updater(snapshot);
        Object.assign(store, patch);
        return patch;
      }),
    });
    const first = mockRes();
    await handleOrgDecision(
      req({ token: 'org', body: { assessmentId: 'asmA', outcome: 'approved' } }),
      first as any,
      d
    );
    expect(first.statusCode).toBe(200);
    expect(store.decidedAt).toBeTruthy();

    const second = mockRes();
    await handleOrgDecision(
      req({
        token: 'org',
        body: { assessmentId: 'asmA', outcome: 'remediate', decisionNotes: 'change it' },
      }),
      second as any,
      d
    );
    expect(second.statusCode).toBe(409);

    const concurrent = mockRes();
    const racing = deps({
      runAssessmentTransaction: vi.fn(async (_id, updater) => {
        const snapshot = { ...store };
        const patch = await updater(snapshot);
        Object.assign(store, patch);
        return patch;
      }),
    });
    await handleOrgDecision(
      req({
        token: 'org',
        body: { assessmentId: 'asmA', outcome: 'rejected', decisionNotes: 'race' },
      }),
      concurrent as any,
      racing
    );
    expect(concurrent.statusCode).toBe(409);
  });
});

describe('empty assessment archive', () => {
  it('allows an authorized admin archive via the server path', async () => {
    const res = mockRes();
    await handleArchiveEmptyAssessment(
      req({ token: 'org', body: { assessmentId: 'asmA', reason: 'Legacy empty snapshot' } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(200);
  });

  it('rejects a non-admin member archive', async () => {
    const res = mockRes();
    await handleArchiveEmptyAssessment(
      req({ token: 'member', body: { assessmentId: 'asmA', reason: 'Legacy empty snapshot' } }),
      res as any,
      deps()
    );
    expect(res.statusCode).toBe(403);
  });
});

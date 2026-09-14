import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  assertTaskPayloadSafe,
  buildEvidenceScanTaskPayload,
  createEvidenceScanTask,
  deterministicEvidenceScanTaskId,
  readCloudTasksScanConfig,
} from '../../server/lib/malwareScanner/taskQueue';
import { verifyEvidenceScanTaskOidc } from '../../server/lib/malwareScanner/taskAuth';
import {
  cloudTasksAckStatus,
  enqueuePortalEvidenceScan,
  scanPortalEvidenceObject,
  type ScannerDeps,
} from '../../server/lib/malwareScanner/scanObject';
import {
  CLOUD_TASKS_SCANNER_ENV_KEYS,
  evaluateEvidenceScannerRuntimeConfig,
  EvidenceScannerConfigError,
  resolveScannerDeliveryMode,
} from '../../server/lib/malwareScanner/types';
import { handlePortalValidate, type EvidenceDeps } from '../../server/lib/evidenceAccess';
import {
  buildScannerTrustRecord,
  encodeTrustMapKey,
  type EvidenceTrustRecord,
} from '../../src/lib/vendor/evidenceTrust';
import { createEicarOnlyEngine } from '../../server/lib/malwareScanner/engine';
import { EICAR_SIGNATURE } from '../../server/lib/malwareScanner/types';
import scannerRouter from '../../server/routes/scanner';

const TASK_ENV = {
  EVIDENCE_SCANNER_ENABLED: 'true',
  EVIDENCE_SCANNER_DELIVERY: 'cloud_tasks',
  EVIDENCE_SCANNER_TASK_PROJECT: 'guardentra-staging',
  EVIDENCE_SCANNER_TASK_LOCATION: 'us-central1',
  EVIDENCE_SCANNER_TASK_QUEUE: 'evidence-scan',
  EVIDENCE_SCANNER_TASK_TARGET_URL:
    'https://guardentra-staging.example/api/internal/evidence-scan-task',
  EVIDENCE_SCANNER_TASK_AUDIENCE:
    'https://guardentra-staging.example/api/internal/evidence-scan-task',
  EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT:
    'tasks-scanner@guardentra-staging.iam.gserviceaccount.com',
  EVIDENCE_SCANNER_SECRET: 'test-scanner-secret-16+',
  CLAMAV_HOST: '10.128.0.2',
  CLAMAV_PORT: '3310',
  APP_ENV: 'staging',
};

function mockRes() {
  const res: {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    status: (n: number) => typeof res;
    json: (b: unknown) => typeof res;
    setHeader: (k: string, v: string) => typeof res;
  } = {
    statusCode: 200,
    body: null,
    headers: {},
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
  };
  return res;
}

function portalValidateDeps(overrides: Partial<EvidenceDeps> = {}): EvidenceDeps {
  return {
    verifyIdToken: vi.fn(async () => ({
      uid: 'portal_asmA',
      portalAssessmentId: 'asmA',
    })) as any,
    getAssessment: vi.fn(async () => ({
      organizationId: 'org1',
      portalOpen: true,
    })),
    getUser: vi.fn(async () => null),
    getStorageMetadata: vi.fn(async () => ({
      contentType: 'application/pdf',
      size: 1200,
      generation: '1001',
    })),
    writeTrustRecord: vi.fn(async (_id, storagePath, record) => ({
      ...record,
      storagePath,
    })),
    signReadUrl: vi.fn(async () => 'https://signed.example/tmp'),
    runAssessmentTransaction: vi.fn(async (_id, updater) =>
      updater({ organizationId: 'org1', portalOpen: false, questions: [], answers: {} }),
    ),
    ...overrides,
  };
}

describe('scanner delivery mode', () => {
  it('defaults to inline', () => {
    expect(resolveScannerDeliveryMode({})).toBe('inline');
    expect(resolveScannerDeliveryMode({ EVIDENCE_SCANNER_DELIVERY: '' })).toBe('inline');
  });

  it('selects cloud_tasks only when explicitly configured', () => {
    expect(resolveScannerDeliveryMode({ EVIDENCE_SCANNER_DELIVERY: 'cloud_tasks' })).toBe(
      'cloud_tasks',
    );
  });

  it('fails closed when cloud_tasks is selected without full config', () => {
    const result = evaluateEvidenceScannerRuntimeConfig({
      EVIDENCE_SCANNER_ENABLED: 'true',
      EVIDENCE_SCANNER_DELIVERY: 'cloud_tasks',
      APP_ENV: 'staging',
      CLAMAV_HOST: '10.128.0.2',
      CLAMAV_PORT: '3310',
      EVIDENCE_SCANNER_SECRET: 'test-scanner-secret-16+',
    });
    expect(result.ok).toBe(false);
    for (const key of CLOUD_TASKS_SCANNER_ENV_KEYS) {
      expect(result.errors.some((e) => e.includes(key))).toBe(true);
    }
  });

  it('accepts complete cloud_tasks config in hosted staging', () => {
    const result = evaluateEvidenceScannerRuntimeConfig(TASK_ENV);
    expect(result.ok).toBe(true);
  });
});

describe('Cloud Tasks payload + task id', () => {
  it('builds payload with generation binding and no secrets/tokens', () => {
    const payload = buildEvidenceScanTaskPayload({
      assessmentId: 'asmA',
      storagePath: 'portal/asmA/a.pdf',
      generation: '1001',
      organizationId: 'org1',
    });
    expect(payload).toEqual({
      assessmentId: 'asmA',
      storagePath: 'portal/asmA/a.pdf',
      generation: '1001',
      organizationId: 'org1',
    });
    expect(JSON.stringify(payload)).not.toMatch(/secret|token|Bearer|authorization/i);
  });

  it('rejects credential-like fields', () => {
    expect(() =>
      assertTaskPayloadSafe({
        assessmentId: 'a',
        storagePath: 'portal/a/x.pdf',
        generation: '1',
        EVIDENCE_SCANNER_SECRET: 'nope',
      }),
    ).toThrow(EvidenceScannerConfigError);
  });

  it('requires generation for cloud tasks payload', () => {
    expect(() =>
      buildEvidenceScanTaskPayload({
        assessmentId: 'asmA',
        storagePath: 'portal/asmA/a.pdf',
      }),
    ).toThrow(/generation/i);
  });

  it('uses deterministic task ids', () => {
    const a = deterministicEvidenceScanTaskId({
      assessmentId: 'asmA',
      storagePath: 'portal/asmA/a.pdf',
      generation: '1001',
    });
    const b = deterministicEvidenceScanTaskId({
      assessmentId: 'asmA',
      storagePath: 'portal/asmA/a.pdf',
      generation: '1001',
    });
    const c = deterministicEvidenceScanTaskId({
      assessmentId: 'asmA',
      storagePath: 'portal/asmA/a.pdf',
      generation: '1002',
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith('evscan-')).toBe(true);
  });

  it('reads cloud tasks config contract', () => {
    const cfg = readCloudTasksScanConfig(TASK_ENV);
    expect(cfg.queue).toBe('evidence-scan');
    expect(cfg.serviceAccountEmail).toContain('@');
  });
});

describe('createEvidenceScanTask', () => {
  it('creates task only with complete payload and treats ALREADY_EXISTS as success', async () => {
    const createTask = vi.fn(async () => {
      const err = new Error('ALREADY_EXISTS');
      (err as { code?: number }).code = 6;
      throw err;
    });
    const result = await createEvidenceScanTask(
      {
        assessmentId: 'asmA',
        storagePath: 'portal/asmA/a.pdf',
        generation: '1001',
        organizationId: 'org1',
      },
      TASK_ENV,
      { createTask },
    );
    expect(result.alreadyExists).toBe(true);
    expect(result.created).toBe(false);
    expect(createTask).toHaveBeenCalledOnce();
    const callArgs = createTask.mock.calls[0] as unknown as [
      { parent: string; task: Record<string, unknown> },
    ];
    const arg = callArgs[0];
    const bodyB64 = (arg.task as { httpRequest: { body: string; oidcToken: { audience: string } } })
      .httpRequest.body;
    const decoded = JSON.parse(Buffer.from(bodyB64, 'base64').toString('utf8'));
    expect(decoded.generation).toBe('1001');
    expect(decoded).not.toHaveProperty('secret');
    expect(decoded).not.toHaveProperty('token');
    expect(
      (arg.task as { httpRequest: { oidcToken: { audience: string } } }).httpRequest.oidcToken
        .audience,
    ).toBe(TASK_ENV.EVIDENCE_SCANNER_TASK_AUDIENCE);
  });

  it('propagates unexpected createTask failures', async () => {
    await expect(
      createEvidenceScanTask(
        {
          assessmentId: 'asmA',
          storagePath: 'portal/asmA/a.pdf',
          generation: '1001',
        },
        TASK_ENV,
        {
          createTask: async () => {
            throw new Error('quota exceeded');
          },
        },
      ),
    ).rejects.toThrow(/quota exceeded/);
  });
});

describe('durable evidence-validate enqueue ordering', () => {
  const prevEnabled = process.env.EVIDENCE_SCANNER_ENABLED;
  const prevDelivery = process.env.EVIDENCE_SCANNER_DELIVERY;

  afterEach(() => {
    process.env.EVIDENCE_SCANNER_ENABLED = prevEnabled;
    if (prevDelivery === undefined) delete process.env.EVIDENCE_SCANNER_DELIVERY;
    else process.env.EVIDENCE_SCANNER_DELIVERY = prevDelivery;
    vi.restoreAllMocks();
  });

  it('awaits enqueue after scan_pending write and before HTTP 200', async () => {
    process.env.EVIDENCE_SCANNER_ENABLED = 'true';
    process.env.EVIDENCE_SCANNER_DELIVERY = 'inline';
    const order: string[] = [];
    const scanObject = await import('../../server/lib/malwareScanner/scanObject');
    vi.spyOn(scanObject, 'enqueuePortalEvidenceScan').mockImplementation(async () => {
      order.push('enqueue');
      return { mode: 'inline' };
    });

    const d = portalValidateDeps({
      writeTrustRecord: vi.fn(async (_id, storagePath, record) => {
        order.push('scan_pending');
        expect(record.state).toBe('scan_pending');
        return { ...record, storagePath };
      }),
    });
    const res = mockRes();
    await handlePortalValidate(
      {
        headers: { authorization: 'Bearer portal' },
        body: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
        query: {},
      } as any,
      res as any,
      d,
    );
    order.push('response');
    expect(order).toEqual(['scan_pending', 'enqueue', 'response']);
    expect(res.statusCode).toBe(200);
    expect((res.body as any).state).toBe('scan_pending');
  });

  it('returns 503 when durable enqueue fails and leaves scan_pending', async () => {
    process.env.EVIDENCE_SCANNER_ENABLED = 'true';
    const scanObject = await import('../../server/lib/malwareScanner/scanObject');
    vi.spyOn(scanObject, 'enqueuePortalEvidenceScan').mockRejectedValue(
      new Error('tasks unavailable'),
    );

    const d = portalValidateDeps();
    const res = mockRes();
    await handlePortalValidate(
      {
        headers: { authorization: 'Bearer portal' },
        body: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
        query: {},
      } as any,
      res as any,
      d,
    );
    expect(res.statusCode).toBe(503);
    expect((res.body as any).state).toBe('scan_pending');
    expect(d.writeTrustRecord).toHaveBeenCalled();
  });

  it('does not enqueue tasks for metadata-quarantined evidence', async () => {
    process.env.EVIDENCE_SCANNER_ENABLED = 'true';
    const scanObject = await import('../../server/lib/malwareScanner/scanObject');
    const enqueue = vi.spyOn(scanObject, 'enqueuePortalEvidenceScan');

    const d = portalValidateDeps({
      getStorageMetadata: vi.fn(async () => ({
        contentType: 'application/pdf',
        size: 0,
        generation: '1',
      })),
    });
    const res = mockRes();
    await handlePortalValidate(
      {
        headers: { authorization: 'Bearer portal' },
        body: { assessmentId: 'asmA', storagePath: 'portal/asmA/empty.pdf' },
        query: {},
      } as any,
      res as any,
      d,
    );
    expect(res.statusCode).toBe(200);
    const written = (d.writeTrustRecord as any).mock.calls[0][2];
    expect(written.state).not.toBe('scan_pending');
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('OIDC task auth', () => {
  const env = {
    EVIDENCE_SCANNER_TASK_AUDIENCE: 'https://example/task',
    EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT: 'tasks@example.iam.gserviceaccount.com',
  };

  it('rejects missing token', async () => {
    const r = await verifyEvidenceScanTaskOidc({ headers: {} }, env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('missing_token');
  });

  it('rejects invalid token', async () => {
    const r = await verifyEvidenceScanTaskOidc(
      { headers: { authorization: 'Bearer bad' } },
      env,
      {
        verifyIdToken: async () => {
          throw new Error('bad token');
        },
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_token');
  });

  it('rejects wrong audience', async () => {
    const r = await verifyEvidenceScanTaskOidc(
      { headers: { authorization: 'Bearer tok' } },
      env,
      {
        verifyIdToken: async () => ({
          getPayload: () =>
            ({
              aud: 'https://wrong',
              email: env.EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT,
            }) as any,
        }),
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrong_audience');
  });

  it('rejects wrong service account', async () => {
    const r = await verifyEvidenceScanTaskOidc(
      { headers: { authorization: 'Bearer tok' } },
      env,
      {
        verifyIdToken: async () => ({
          getPayload: () =>
            ({
              aud: env.EVIDENCE_SCANNER_TASK_AUDIENCE,
              email: 'other@example.iam.gserviceaccount.com',
            }) as any,
        }),
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('wrong_service_account');
  });

  it('admits valid OIDC', async () => {
    const r = await verifyEvidenceScanTaskOidc(
      { headers: { authorization: 'Bearer tok' } },
      env,
      {
        verifyIdToken: async () => ({
          getPayload: () =>
            ({
              aud: env.EVIDENCE_SCANNER_TASK_AUDIENCE,
              email: env.EVIDENCE_SCANNER_TASK_SERVICE_ACCOUNT,
            }) as any,
        }),
      },
    );
    expect(r.ok).toBe(true);
  });
});

describe('Cloud Tasks worker ACK mapping', () => {
  it('ACKs clean/quarantined/scan_failed and stale/missing', () => {
    expect(
      cloudTasksAckStatus({
        ok: true,
        assessmentId: 'a',
        storagePath: 'p',
        state: 'clean',
      }),
    ).toBe(200);
    expect(
      cloudTasksAckStatus({
        ok: true,
        assessmentId: 'a',
        storagePath: 'p',
        state: 'quarantined',
      }),
    ).toBe(200);
    expect(
      cloudTasksAckStatus({
        ok: true,
        assessmentId: 'a',
        storagePath: 'p',
        state: 'scan_failed',
      }),
    ).toBe(200);
    expect(
      cloudTasksAckStatus({
        ok: false,
        reason: 'stale_generation',
        assessmentId: 'a',
        storagePath: 'p',
      }),
    ).toBe(200);
    expect(
      cloudTasksAckStatus({
        ok: false,
        reason: 'assessment_not_found',
        assessmentId: 'a',
        storagePath: 'p',
      }),
    ).toBe(200);
  });
});

describe('task worker route auth + scan', () => {
  function routeLayer(path: string) {
    const layer = (scannerRouter as any).stack.find(
      (l: any) => l.route?.path === path && l.route?.methods?.post,
    );
    expect(layer).toBeTruthy();
    return layer;
  }

  /** Invoke only the final route handler (skips middleware). */
  function invokeHandler(
    path: string,
    req: { headers?: Record<string, unknown>; body?: Record<string, unknown>; ip?: string },
  ) {
    const layer = routeLayer(path);
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    const res = mockRes();
    return handler(req as any, res as any, () => undefined).then(() => res);
  }

  /** Run the full Express route stack (middleware + handler). */
  async function invokeFullRoute(
    path: string,
    req: { headers?: Record<string, unknown>; body?: Record<string, unknown>; ip?: string },
  ) {
    const layer = routeLayer(path);
    const res = mockRes();
    const request = { ip: '127.0.0.1', headers: {}, body: {}, ...req } as any;
    const stack = layer.route.stack as Array<{ handle: Function }>;

    await new Promise<void>((resolve, reject) => {
      let idx = 0;
      const next = (err?: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        if (idx >= stack.length) {
          resolve();
          return;
        }
        const step = stack[idx++];
        let advanced = false;
        const stepNext = (e?: unknown) => {
          advanced = true;
          next(e);
        };
        try {
          const out = step.handle(request, res as any, stepNext);
          if (out && typeof (out as Promise<unknown>).then === 'function') {
            (out as Promise<unknown>).then(() => resolve(), reject);
          } else if (!advanced) {
            // Sync middleware ended the chain (e.g. 429) without calling next.
            resolve();
          }
        } catch (e) {
          reject(e);
        }
      };
      next();
    });
    return res;
  }

  it('task route does not mount the shared IP scannerLimiter', () => {
    const task = routeLayer('/evidence-scan-task');
    const manual = routeLayer('/evidence-scan');
    expect(task.route.stack.length).toBe(1);
    expect(manual.route.stack.length).toBeGreaterThan(1);
    // Manual route keeps rate-limit middleware ahead of the handler.
    expect(manual.route.stack[0].handle.length).toBe(3);
    expect(task.route.stack[0].handle.length).toBe(2);
  });

  it('rejects shared-secret on task route (missing OIDC)', async () => {
    const res = await invokeHandler('/evidence-scan-task', {
      headers: {
        authorization: `Bearer ${TASK_ENV.EVIDENCE_SCANNER_SECRET}`,
        'x-evidence-scanner-secret': TASK_ENV.EVIDENCE_SCANNER_SECRET,
      },
      body: {
        assessmentId: 'asmA',
        storagePath: 'portal/asmA/a.pdf',
        generation: '1',
      },
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('keeps manual shared-secret route protected', async () => {
    const res = await invokeHandler('/evidence-scan', {
      headers: {},
      body: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('manual evidence-scan remains rate limited; task route does not 429 from IP floods', async () => {
    const floodIp = '203.0.113.50';
    let saw429 = false;
    for (let i = 0; i < 130; i++) {
      const res = await invokeFullRoute('/evidence-scan', {
        ip: floodIp,
        headers: {},
        body: { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf' },
      });
      if (res.statusCode === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);

    // Same client IP flooding the task route must not be blocked by the scanner IP limiter.
    for (let i = 0; i < 130; i++) {
      const res = await invokeFullRoute('/evidence-scan-task', {
        ip: floodIp,
        headers: {},
        body: {
          assessmentId: 'asmA',
          storagePath: 'portal/asmA/a.pdf',
          generation: '1',
        },
      });
      expect(res.statusCode).not.toBe(429);
      expect([401, 403]).toContain(res.statusCode);
    }
  });
});

describe('scanPortalEvidenceObject terminals for task worker', () => {
  function deps(overrides: Partial<ScannerDeps> = {}): ScannerDeps {
    const path = 'portal/asmA/a.pdf';
    return {
      getAssessment: async () => ({
        organizationId: 'org1',
        evidenceTrustByStoragePath: {
          [encodeTrustMapKey(path)]: {
            state: 'scan_pending',
            storagePath: path,
            generation: '1001',
            updatedAt: 't',
            validation: 'validated',
          } satisfies EvidenceTrustRecord,
        },
      }),
      downloadObject: async () => ({
        buffer: Buffer.from('%PDF'),
        contentType: 'application/pdf',
        sizeBytes: 4,
        generation: '1001',
      }),
      writeScannerTrustRecord: async (_id, storagePath, record) => record,
      engine: {
        name: 'clamav',
        scanBuffer: async () => ({ verdict: 'clean' as const, engine: 'clamav' }),
      },
      ...overrides,
    };
  }

  it('clean → ok clean; EICAR → quarantined; scan_failed stays untrusted', async () => {
    const clean = await scanPortalEvidenceObject(
      { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf', generation: '1001' },
      deps(),
    );
    expect(clean.ok).toBe(true);
    expect(clean.state).toBe('clean');

    const infected = await scanPortalEvidenceObject(
      { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf', generation: '1001' },
      deps({
        downloadObject: async () => ({
          buffer: Buffer.from(EICAR_SIGNATURE),
          contentType: 'application/pdf',
          sizeBytes: EICAR_SIGNATURE.length,
          generation: '1001',
        }),
        engine: createEicarOnlyEngine(),
      }),
    );
    expect(infected.ok).toBe(true);
    expect(infected.state).toBe('quarantined');

    const failed = await scanPortalEvidenceObject(
      { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf', generation: '1001' },
      deps({
        engine: {
          name: 'clamav',
          scanBuffer: async () => ({ verdict: 'error' as const, engine: 'clamav' }),
        },
      }),
    );
    expect(failed.ok).toBe(true);
    expect(failed.state).toBe('scan_failed');
    expect(failed.state).not.toBe('clean');
  });

  it('stale generation is harmless; same-generation terminal replay is idempotent', async () => {
    const stale = await scanPortalEvidenceObject(
      { assessmentId: 'asmA', storagePath: 'portal/asmA/a.pdf', generation: '999' },
      deps(),
    );
    expect(stale.ok).toBe(false);
    expect(stale.reason).toBe('stale_generation');
    expect(cloudTasksAckStatus(stale)).toBe(200);

    const path = 'portal/asmA/a.pdf';
    const terminal = buildScannerTrustRecord({
      storagePath: path,
      generation: '1001',
      verdict: 'clean',
      engine: 'clamav',
    });
    const replay = await scanPortalEvidenceObject(
      { assessmentId: 'asmA', storagePath: path, generation: '1001' },
      deps({
        getAssessment: async () => ({
          organizationId: 'org1',
          evidenceTrustByStoragePath: {
            [encodeTrustMapKey(path)]: terminal,
          },
        }),
      }),
    );
    expect(replay.ok).toBe(true);
    expect(replay.skipped).toBe(true);
    expect(replay.state).toBe('clean');
  });

  it('cross-tenant protection unchanged', async () => {
    const result = await scanPortalEvidenceObject(
      {
        assessmentId: 'asmA',
        storagePath: 'portal/asmA/a.pdf',
        generation: '1001',
        organizationId: 'other-org',
      },
      deps(),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('cross_tenant');
  });
});

describe('inline enqueue remains available', () => {
  it('enqueuePortalEvidenceScan returns inline mode when delivery unset', async () => {
    const prevEnabled = process.env.EVIDENCE_SCANNER_ENABLED;
    const prevDelivery = process.env.EVIDENCE_SCANNER_DELIVERY;
    process.env.EVIDENCE_SCANNER_ENABLED = 'true';
    delete process.env.EVIDENCE_SCANNER_DELIVERY;
    const result = await enqueuePortalEvidenceScan({
      assessmentId: 'asmA',
      storagePath: 'portal/asmA/a.pdf',
      generation: '1',
    });
    expect(result.mode).toBe('inline');
    process.env.EVIDENCE_SCANNER_ENABLED = prevEnabled;
    if (prevDelivery === undefined) delete process.env.EVIDENCE_SCANNER_DELIVERY;
    else process.env.EVIDENCE_SCANNER_DELIVERY = prevDelivery;
  });
});

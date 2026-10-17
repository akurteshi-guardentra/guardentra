/**
 * Real scanner and evidence adapters against installed @google-cloud/storage.
 * Transport and IAM signing are stubbed. This is not a live Storage acceptance test.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp } from 'firebase-admin/app';
import { initializeApp, cert } from 'firebase-admin/app';
import {
  handleEvidenceDownload,
  handleOrgAttachmentDownload,
  liveEvidenceDeps,
} from '../../server/lib/evidenceAccess';
import {
  liveScannerDeps,
  scanPortalEvidenceObject,
} from '../../server/lib/malwareScanner/scanObject';
import { authoritativeGeneration } from '../../server/lib/storageGeneration';
import {
  buildScannerTrustRecord,
  encodeTrustMapKey,
} from '../../src/lib/vendor/evidenceTrust';

const storageRoot = path.join(process.cwd(), 'node_modules/@google-cloud/storage/build/cjs/src');
const utilPath = path.join(storageRoot, 'nodejs-common/util.js');
const storageRequire = createRequire(utilPath);
const { GoogleAuth } = storageRequire('google-auth-library');
const utilMod = storageRequire(utilPath);
const { CRC32C } = storageRequire(path.join(storageRoot, 'crc32c.js'));
const { URLSigner } = storageRequire(path.join(storageRoot, 'signer.js'));

const BUCKET = 'synthetic-probe-73.appspot.com';
const PROJECT = 'synthetic-probe-73';
const PATH_NAME = 'portal/asm-probe/doc.pdf';
const ATTACH = 'orgs/org-probe/vendors/vendor-probe/attachments/pack.pdf';
const UNSAFE_GENERATION = '9007199254740993';

type Stored = {
  generation: string;
  bytes: Buffer;
  contentType?: string;
  sizeOverride?: number;
  deleted?: boolean;
};

type MediaCall = { uri: string; generation: string | null; ifGenerationMatch: string | null };

const world = {
  latest: null as Stored | null,
  byGeneration: new Map<string, Stored>(),
  jsonCalls: 0,
  media: [] as MediaCall[],
  flipAfterJson: 0,
  flip: null as null | (() => void),
  forceMediaStatus: null as number | null,
  badCrc: false,
};

const canonicalRequests: string[] = [];
const signerVersions: string[] = [];
let signBlobCalls = 0;
let externalHttp = 0;

const original = {
  authorizeRequest: GoogleAuth.prototype.authorizeRequest,
  getProjectId: GoogleAuth.prototype.getProjectId,
  getCredentials: GoogleAuth.prototype.getCredentials,
  sign: GoogleAuth.prototype.sign,
  signBlob: GoogleAuth.prototype.signBlob,
  makeRequest: utilMod.util.makeRequest,
  getCanonicalRequest: URLSigner.prototype.getCanonicalRequest,
  getSignedUrlV2: URLSigner.prototype.getSignedUrlV2,
  getSignedUrlV4: URLSigner.prototype.getSignedUrlV4,
  httpRequest: http.request,
  httpsRequest: https.request,
};

function crcOf(bytes: Uint8Array): string {
  const crc = new CRC32C();
  crc.update(bytes as never);
  return crc.toString();
}

function stored(generation: string, text: string, extra: Partial<Stored> = {}): Stored {
  return {
    generation,
    bytes: Buffer.from(text),
    contentType: 'application/pdf',
    ...extra,
  };
}

function resetWorld(latest: Stored | null, opts: Partial<typeof world> = {}) {
  world.latest = latest;
  world.byGeneration = new Map();
  if (latest) world.byGeneration.set(latest.generation, latest);
  world.jsonCalls = 0;
  world.media = [];
  world.flipAfterJson = opts.flipAfterJson || 0;
  world.flip = opts.flip || null;
  world.forceMediaStatus = opts.forceMediaStatus || null;
  world.badCrc = Boolean(opts.badCrc);
}

function metadataOf(obj: Stored) {
  const body: Record<string, string> = {
    kind: 'storage#object',
    bucket: BUCKET,
    name: PATH_NAME,
    metageneration: '1',
    contentType: obj.contentType || 'application/pdf',
    size: String(obj.sizeOverride != null ? obj.sizeOverride : obj.bytes.length),
    crc32c: crcOf(obj.bytes),
  };
  if (obj.generation) body.generation = obj.generation;
  return body;
}

function blockRequest(originalRequest: typeof http.request): typeof http.request {
  return function blocked(this: unknown, ...args: unknown[]) {
    externalHttp += 1;
    const req = originalRequest.apply(this, args as never);
    process.nextTick(() => req.destroy(new Error('EXTERNAL_HTTP_DENIED')));
    return req;
  } as typeof http.request;
}

function installStubs() {
  GoogleAuth.prototype.authorizeRequest = async function authorizeOffline(opts: { headers?: object }) {
    return {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: 'Bearer synthetic-offline-token' },
    };
  };
  GoogleAuth.prototype.getProjectId = async () => PROJECT;
  GoogleAuth.prototype.getCredentials = async () => ({
    client_email: 'probe-not-a-real-account@synthetic-probe-73.iam.gserviceaccount.com',
  });
  GoogleAuth.prototype.sign = async () => Buffer.from('NOT-A-CAPABILITY').toString('base64');
  GoogleAuth.prototype.signBlob = async () => {
    signBlobCalls += 1;
    throw new Error('IAM signBlob was invoked');
  };
  URLSigner.prototype.getCanonicalRequest = function observedCanon(...args: unknown[]) {
    const text = original.getCanonicalRequest.apply(this, args);
    canonicalRequests.push(text);
    return text;
  };
  URLSigner.prototype.getSignedUrlV2 = function observedV2(...args: unknown[]) {
    signerVersions.push('v2');
    return original.getSignedUrlV2.apply(this, args);
  };
  URLSigner.prototype.getSignedUrlV4 = function observedV4(...args: unknown[]) {
    signerVersions.push('v4');
    return original.getSignedUrlV4.apply(this, args);
  };
  utilMod.util.makeRequest = function syntheticMakeRequest(
    reqOpts: { uri?: string; qs?: Record<string, unknown>; method?: string },
    config: { stream?: { emit: (event: string, payload: unknown) => void } },
    callback: (err: unknown, body?: unknown, res?: unknown) => void,
  ) {
    const qs = reqOpts.qs || {};
    const isMedia = qs.alt === 'media';
    if (!isMedia) {
      world.jsonCalls += 1;
      const viewed = world.latest;
      if (world.flipAfterJson && world.jsonCalls >= world.flipAfterJson && world.flip) world.flip();
      const missing = !viewed || viewed.deleted;
      const body = missing ? { error: { code: 404, message: 'Not Found' } } : metadataOf(viewed);
      utilMod.util.handleResp(
        null,
        { statusCode: missing ? 404 : 200, statusMessage: missing ? 'Not Found' : 'OK', headers: {} },
        body,
        callback,
      );
      return undefined;
    }

    const wanted = qs.generation != null ? String(qs.generation) : null;
    world.media.push({
      uri: String(reqOpts.uri || ''),
      generation: wanted,
      ifGenerationMatch: qs.ifGenerationMatch != null ? String(qs.ifGenerationMatch) : null,
    });
    const target = wanted ? world.byGeneration.get(wanted) || null : world.latest;
    let status = 200;
    let bytes: Uint8Array = Buffer.alloc(0);
    if (world.forceMediaStatus) {
      status = world.forceMediaStatus;
      bytes = Buffer.from('forced-media-failure');
    } else if (!target || target.deleted) {
      status = 404;
      bytes = Buffer.from('generation-not-found');
    } else {
      bytes = target.bytes;
    }
    const headers: Record<string, string> =
      status === 200 && target
        ? {
            'content-type': target.contentType || 'application/pdf',
            'x-goog-stored-content-encoding': 'identity',
            'x-goog-generation': target.generation,
            'x-goog-hash': `crc32c=${world.badCrc ? 'AAAAAAAAAAAAAAAAAAAAAA==' : crcOf(bytes)}`,
          }
        : { 'content-type': 'text/plain' };
    if (config && config.stream) {
      const dup = config.stream;
      const res = new Readable({
        read() {
          if ((this as Readable & { _sent?: boolean })._sent) return;
          (this as Readable & { _sent?: boolean })._sent = true;
          this.push(bytes);
          this.push(null);
        },
      }) as Readable & {
        statusCode: number;
        statusMessage: string;
        headers: Record<string, string>;
        request: object;
        toJSON: () => { headers: Record<string, string> };
      };
      res.statusCode = status;
      res.statusMessage = status === 200 ? 'OK' : 'Error';
      res.headers = headers;
      res.request = {};
      res.toJSON = () => ({ headers: res.headers });
      setImmediate(() => dup.emit('response', res));
      return dup;
    }
    utilMod.util.handleResp(
      null,
      { statusCode: status, statusMessage: status === 200 ? 'OK' : 'Error', headers },
      Buffer.from(bytes).toString('utf8'),
      callback,
    );
    return undefined;
  };
  http.request = blockRequest(original.httpRequest);
  https.request = blockRequest(original.httpsRequest) as typeof https.request;
}

function restoreStubs() {
  GoogleAuth.prototype.authorizeRequest = original.authorizeRequest;
  GoogleAuth.prototype.getProjectId = original.getProjectId;
  GoogleAuth.prototype.getCredentials = original.getCredentials;
  GoogleAuth.prototype.sign = original.sign;
  GoogleAuth.prototype.signBlob = original.signBlob;
  utilMod.util.makeRequest = original.makeRequest;
  URLSigner.prototype.getCanonicalRequest = original.getCanonicalRequest;
  URLSigner.prototype.getSignedUrlV2 = original.getSignedUrlV2;
  URLSigner.prototype.getSignedUrlV4 = original.getSignedUrlV4;
  http.request = original.httpRequest;
  https.request = original.httpsRequest;
}

const scans: Array<{ text: string }> = [];
const writes: Array<{ state?: string; generation?: string; signature?: string; verdict?: string }> = [];
const engine = {
  name: 'probe-recorder',
  async scanBuffer(buf: Buffer) {
    scans.push({ text: buf.toString('utf8') });
    return { verdict: 'clean' as const, engine: 'probe-recorder' };
  },
};

function scanDeps(trustGeneration: string, state: 'scan_pending' | 'clean' = 'scan_pending') {
  const record =
    state === 'clean'
      ? buildScannerTrustRecord({
          storagePath: PATH_NAME,
          generation: trustGeneration,
          verdict: 'clean',
          engine: 'probe-recorder',
        })
      : {
          state,
          storagePath: PATH_NAME,
          generation: trustGeneration,
          updatedAt: '2026-10-16T00:00:00.000Z',
          validation: 'validated' as const,
        };
  return {
    getAssessment: async () => ({
      organizationId: 'org-probe',
      evidenceTrustByStoragePath: { [encodeTrustMapKey(PATH_NAME)]: record },
    }),
    downloadObject: (storagePath: string) => liveScannerDeps(engine).downloadObject(storagePath),
    writeScannerTrustRecord: async (_id: string, _path: string, saved: typeof record) => {
      writes.push({
        state: saved.state,
        generation: saved.generation != null ? String(saved.generation) : undefined,
        signature: (saved as { scanner?: { signature?: string; verdict?: string } }).scanner?.signature,
        verdict: (saved as { scanner?: { verdict?: string } }).scanner?.verdict,
      });
      return saved;
    },
    engine,
  };
}

function mockRes() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.APP_ENV;
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
  process.env.GCLOUD_PROJECT = PROJECT;
  process.env.FIREBASE_STORAGE_BUCKET = BUCKET;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.STORAGE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  delete process.env.CLAMAV_HOST;
  installStubs();
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  initializeApp({
    credential: cert({
      projectId: PROJECT,
      clientEmail: 'probe-not-a-real-account@synthetic-probe-73.iam.gserviceaccount.com',
      privateKey,
    }),
    projectId: PROJECT,
    storageBucket: BUCKET,
  });
});

afterAll(async () => {
  restoreStubs();
  const { getApps } = await import('firebase-admin/app');
  await Promise.all(getApps().map((app) => deleteApp(app)));
});

beforeEach(() => {
  scans.length = 0;
  writes.length = 0;
  canonicalRequests.length = 0;
  signerVersions.length = 0;
  externalHttp = 0;
});

describe('authoritative generation string', () => {
  it('keeps an exact decimal string and rejects numbers that are not safe integers', () => {
    expect(authoritativeGeneration(UNSAFE_GENERATION)).toBe(UNSAFE_GENERATION);
    expect(authoritativeGeneration('1001')).toBe('1001');
    expect(authoritativeGeneration(1001)).toBe('1001');
    expect(authoritativeGeneration(Number(UNSAFE_GENERATION))).toBeNull();
    expect(authoritativeGeneration('')).toBeNull();
    expect(authoritativeGeneration('01')).toBeNull();
    expect(authoritativeGeneration('latest')).toBeNull();
  });
});

describe('live scanner download binding', () => {
  it('scans the stable generation named by metadata', async () => {
    resetWorld(stored('1001', 'STABLE-GEN-1001-BYTES'));
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001'),
    );
    expect(out.ok).toBe(true);
    expect(out.state).toBe('clean');
    expect(out.generation).toBe('1001');
    expect(scans.map((row) => row.text)).toEqual(['STABLE-GEN-1001-BYTES']);
    expect(world.media.map((row) => row.generation)).toEqual(['1001']);
    expect(writes[0]).toMatchObject({ state: 'clean', generation: '1001' });
    expect(externalHttp).toBe(0);
  });

  it('reads the metadata generation after the object is replaced', async () => {
    const first = stored('1001', 'STABLE-GEN-1001-BYTES');
    const second = stored('1002', 'REPLACED-GEN-1002-BYTES');
    resetWorld(first, {
      flipAfterJson: 2,
      flip: () => {
        world.latest = second;
        world.byGeneration.set(second.generation, second);
      },
    });
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001'),
    );
    expect(out.generation).toBe('1001');
    expect(scans.map((row) => row.text)).toEqual(['STABLE-GEN-1001-BYTES']);
    expect(world.media).toEqual([
      expect.objectContaining({ generation: '1001', ifGenerationMatch: null }),
    ]);
    expect(writes[0]).toMatchObject({ generation: '1001' });
  });

  it('does not scan when the pinned generation disappears', async () => {
    const first = stored('1001', 'STABLE-GEN-1001-BYTES');
    resetWorld(first, {
      flipAfterJson: 2,
      flip: () => {
        world.byGeneration.delete('1001');
        world.latest = null;
      },
    });
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001'),
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('storage_object_missing');
    expect(scans).toEqual([]);
    expect(writes).toEqual([]);
    expect(world.media.map((row) => row.generation)).toEqual(['1001']);
  });

  it('does not fall back to latest when the pinned read returns 412', async () => {
    resetWorld(stored('1001', 'STABLE-GEN-1001-BYTES'), { forceMediaStatus: 412 });
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001'),
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('storage_object_missing');
    expect(scans).toEqual([]);
    expect(writes).toEqual([]);
    expect(world.media).toHaveLength(1);
    expect(world.media[0].generation).toBe('1001');
  });

  it('keeps checksum failure closed and does not write a verdict', async () => {
    resetWorld(stored('1001', 'STABLE-GEN-1001-BYTES'), { badCrc: true });
    await expect(
      scanPortalEvidenceObject(
        { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
        scanDeps('1001'),
      ),
    ).rejects.toMatchObject({ code: 'CONTENT_DOWNLOAD_MISMATCH' });
    expect(scans).toEqual([]);
    expect(writes).toEqual([]);
    expect(world.media.map((row) => row.generation)).toEqual(['1001']);
  });

  it('records size_limit from oversized metadata without a media read', async () => {
    resetWorld(stored('1001', 'tiny', { sizeOverride: 25 * 1024 * 1024 + 1 }));
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001'),
    );
    expect(out.state).toBe('scan_failed');
    expect(world.media).toEqual([]);
    expect(scans).toEqual([]);
    expect(writes[0]).toMatchObject({ state: 'scan_failed', generation: '1001', signature: 'size_limit' });
  });

  it('rejects metadata with no generation before a media read', async () => {
    resetWorld(stored('', 'NO-GEN'));
    world.latest = { generation: '', bytes: Buffer.from('NO-GEN') };
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001'),
    );
    expect(out.reason).toBe('storage_object_missing');
    expect(world.media).toEqual([]);
    expect(scans).toEqual([]);
  });

  it('puts an above-safe-integer generation on the media request unchanged', async () => {
    resetWorld(stored(UNSAFE_GENERATION, 'EXACT-UNSAFE-BYTES'));
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: UNSAFE_GENERATION },
      scanDeps(UNSAFE_GENERATION),
    );
    expect(out.generation).toBe(UNSAFE_GENERATION);
    expect(world.media.map((row) => row.generation)).toEqual([UNSAFE_GENERATION]);
    expect(scans.map((row) => row.text)).toEqual(['EXACT-UNSAFE-BYTES']);
    expect(writes[0]?.generation).toBe(UNSAFE_GENERATION);
    expect(Number(UNSAFE_GENERATION).toString()).not.toBe(UNSAFE_GENERATION);
  });

  it('treats a stale task generation as stale after the pinned metadata read', async () => {
    resetWorld(stored('1002', 'CURRENT-1002'));
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1002'),
    );
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('stale_generation');
    expect(scans).toEqual([]);
    expect(writes).toEqual([]);
    expect(world.media.map((row) => row.generation)).toEqual(['1002']);
  });

  it('replays a same-generation terminal verdict without a rescan', async () => {
    resetWorld(stored('1001', 'STABLE-GEN-1001-BYTES'));
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
      scanDeps('1001', 'clean'),
    );
    expect(out.ok).toBe(true);
    expect(out.skipped).toBe(true);
    expect(out.state).toBe('clean');
    expect(scans).toEqual([]);
    expect(writes).toEqual([]);
    expect(world.media.map((row) => row.generation)).toEqual(['1001']);
  });

  it('rejects a pending generation that does not match the pinned object', async () => {
    resetWorld(stored('1002', 'CURRENT-1002'));
    const out = await scanPortalEvidenceObject(
      { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1002' },
      scanDeps('1001'),
    );
    expect(out.reason).toBe('scan_pending_required');
    expect(scans).toEqual([]);
    expect(writes).toEqual([]);
    expect(world.media.map((row) => row.generation)).toEqual(['1002']);
  });

  it('rejects a cross-tenant task before any media read', async () => {
    resetWorld(stored('1001', 'STABLE-GEN-1001-BYTES'));
    const out = await scanPortalEvidenceObject(
      {
        assessmentId: 'asm-probe',
        storagePath: PATH_NAME,
        generation: '1001',
        organizationId: 'org-other',
      },
      scanDeps('1001'),
    );
    expect(out.reason).toBe('cross_tenant');
    expect(world.media).toEqual([]);
    expect(world.jsonCalls).toBe(0);
  });
});

describe('live V4 reviewer signing', () => {
  function reviewerDeps(assessment: Record<string, unknown>, user = {
    organizationId: 'org-probe',
    role: 'admin',
  }) {
    const live = liveEvidenceDeps();
    return {
      verifyIdToken: async () => ({ uid: 'reviewer-probe' }),
      getAssessment: async () => assessment,
      getUser: async () => user,
      getStorageMetadata: (storagePath: string) => live.getStorageMetadata(storagePath),
      signReadUrl: (storagePath: string, generation: string) => live.signReadUrl(storagePath, generation),
      writeTrustRecord: async () => {
        throw new Error('trust write not expected');
      },
      runAssessmentTransaction: async () => {
        throw new Error('transaction not expected');
      },
    };
  }

  function cleanAssessment(generation: string) {
    return {
      organizationId: 'org-probe',
      evidenceTrustByStoragePath: {
        [encodeTrustMapKey(PATH_NAME)]: buildScannerTrustRecord({
          storagePath: PATH_NAME,
          generation,
          verdict: 'clean',
          engine: 'probe-recorder',
        }),
      },
    };
  }

  it('puts the clean generation in the V4 canonical request', async () => {
    resetWorld(stored('1001', 'STABLE-GEN-1001-BYTES'));
    const res = mockRes();
    await handleEvidenceDownload(
      {
        headers: { authorization: 'Bearer synthetic-reviewer-token' },
        query: { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '9999' },
        body: {},
      } as never,
      res as never,
      reviewerDeps(cleanAssessment('1001')) as never,
      'org',
    );
    expect(res.statusCode).toBe(200);
    expect(signerVersions).toEqual(['v4']);
    expect(canonicalRequests.some((row) => row.includes('generation=1001'))).toBe(true);
    expect(canonicalRequests.some((row) => row.includes('generation=9999'))).toBe(false);
    expect(signBlobCalls).toBe(0);
    expect(externalHttp).toBe(0);
    const body = res.body as { url?: string };
    expect(body.url).toContain('generation=1001');
    expect(body.url).toContain('X-Goog-Signature=');
    expect(body.url).not.toContain('GoogleAccessId=');
  });

  it('changes the canonical request when the authorized generation changes', async () => {
    const live = liveEvidenceDeps();
    resetWorld(stored('1001', 'A'));
    await live.signReadUrl(PATH_NAME, '1001');
    await live.signReadUrl(PATH_NAME, '1002');
    expect(canonicalRequests).toHaveLength(2);
    expect(canonicalRequests[0]).toContain('generation=1001');
    expect(canonicalRequests[0]).not.toContain('generation=1002');
    expect(canonicalRequests[1]).toContain('generation=1002');
    expect(canonicalRequests[1]).not.toContain('generation=1001');
    expect(signerVersions).toEqual(['v4', 'v4']);
  });

  it('rejects a mismatched clean generation before signing', async () => {
    resetWorld(stored('1002', 'CURRENT-1002'));
    const res = mockRes();
    await handleEvidenceDownload(
      {
        headers: { authorization: 'Bearer synthetic-reviewer-token' },
        query: { assessmentId: 'asm-probe', storagePath: PATH_NAME },
        body: {},
      } as never,
      res as never,
      reviewerDeps(cleanAssessment('1001')) as never,
      'org',
    );
    expect(res.statusCode).toBe(403);
    expect(canonicalRequests).toEqual([]);
    expect(signerVersions).toEqual([]);
  });

  it('rejects metadata without a generation before signing', async () => {
    resetWorld(stored('1001', 'STABLE'));
    if (world.latest) world.latest.generation = '';
    const res = mockRes();
    await handleEvidenceDownload(
      {
        headers: { authorization: 'Bearer synthetic-reviewer-token' },
        query: { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '1001' },
        body: {},
      } as never,
      res as never,
      reviewerDeps(cleanAssessment('1001')) as never,
      'org',
    );
    expect(res.statusCode).toBe(409);
    expect(canonicalRequests).toEqual([]);
  });

  it('rejects a cross-tenant reviewer before signing', async () => {
    resetWorld(stored('1001', 'STABLE'));
    const res = mockRes();
    await handleEvidenceDownload(
      {
        headers: { authorization: 'Bearer synthetic-reviewer-token' },
        query: { assessmentId: 'asm-probe', storagePath: PATH_NAME },
        body: {},
      } as never,
      res as never,
      reviewerDeps(cleanAssessment('1001'), { organizationId: 'org-other', role: 'admin' }) as never,
      'org',
    );
    expect(res.statusCode).toBe(403);
    expect(world.jsonCalls).toBe(0);
    expect(canonicalRequests).toEqual([]);
  });

  it('rejects an unauthenticated download before signing', async () => {
    resetWorld(stored('1001', 'STABLE'));
    const res = mockRes();
    await handleEvidenceDownload(
      {
        headers: {},
        query: { assessmentId: 'asm-probe', storagePath: PATH_NAME },
        body: {},
      } as never,
      res as never,
      reviewerDeps(cleanAssessment('1001')) as never,
      'org',
    );
    expect(res.statusCode).toBe(401);
    expect(canonicalRequests).toEqual([]);
  });

  it('signs a portal download with the metadata generation, not the request generation', async () => {
    resetWorld(stored('1001', 'PORTAL-BYTES'));
    const res = mockRes();
    await handleEvidenceDownload(
      {
        headers: { authorization: 'Bearer synthetic-portal-token' },
        query: { assessmentId: 'asm-probe', storagePath: PATH_NAME, generation: '9999' },
        body: {},
      } as never,
      res as never,
      {
        ...reviewerDeps({ organizationId: 'org-probe', portalOpen: true }),
        verifyIdToken: async () => ({ uid: 'portal-user', portalAssessmentId: 'asm-probe' }),
      } as never,
      'portal',
    );
    expect(res.statusCode).toBe(200);
    expect(canonicalRequests.some((row) => row.includes('generation=1001'))).toBe(true);
    expect(canonicalRequests.some((row) => row.includes('9999'))).toBe(false);
  });

  it('rejects a cross-tenant attachment before signing and signs a same-tenant attachment generation', async () => {
    resetWorld(stored('1001', 'ATTACH'));
    const denied = mockRes();
    const deps = reviewerDeps({ organizationId: 'org-probe' });
    await handleOrgAttachmentDownload(
      {
        headers: { authorization: 'Bearer synthetic-reviewer-token' },
        query: {
          orgId: 'org-other',
          vendorId: 'vendor-probe',
          storagePath: 'orgs/org-other/vendors/vendor-probe/attachments/pack.pdf',
          generation: '1001',
        },
        body: {},
      } as never,
      denied as never,
      deps as never,
    );
    expect(denied.statusCode).toBe(403);
    expect(canonicalRequests).toEqual([]);

    const allowed = mockRes();
    await handleOrgAttachmentDownload(
      {
        headers: { authorization: 'Bearer synthetic-reviewer-token' },
        query: {
          orgId: 'org-probe',
          vendorId: 'vendor-probe',
          storagePath: ATTACH,
          generation: '9999',
        },
        body: {},
      } as never,
      allowed as never,
      deps as never,
    );
    expect(allowed.statusCode).toBe(200);
    expect(canonicalRequests.some((row) => row.includes('generation=1001'))).toBe(true);
    expect(canonicalRequests.some((row) => row.includes('9999'))).toBe(false);
  });
});

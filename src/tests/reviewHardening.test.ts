/**
 * Regression tests for the 2026-10-26 review hardening:
 *  - auth middleware fails closed on unknown APP_ENV values
 *  - AI canned responses never reach staging/production users
 *  - AI rate-limit key ignores client-supplied org ids
 *  - Stripe redirects never come from the request Origin header
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { isProductionLike } from '../../server/middleware/requireFirebaseAuth';
import { aiRateLimitKey, isLocalAiEnv, sendMock } from '../../server/routes/ai';
import { appBaseUrl } from '../../server/routes/stripe';

function fakeRes() {
  const res: { statusCode: number; body: unknown } & Partial<Response> = {
    statusCode: 200,
    body: undefined,
  };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as unknown as Response['status'];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  }) as unknown as Response['json'];
  return res;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isProductionLike (auth enforcement)', () => {
  it.each(['production', 'prod', 'staging', 'prod-eu', 'Production ', 'qa'])(
    'enforces auth for APP_ENV=%s',
    (v) => {
      expect(isProductionLike({ APP_ENV: v.trim() } as NodeJS.ProcessEnv)).toBe(true);
    },
  );
  it.each(['development', 'dev', 'local', 'test', 'demo'])('allows local bypass for %s', (v) => {
    expect(isProductionLike({ APP_ENV: v } as NodeJS.ProcessEnv)).toBe(false);
  });
  it('enforces auth when APP_ENV and NODE_ENV are both unset', () => {
    expect(isProductionLike({} as NodeJS.ProcessEnv)).toBe(true);
  });
  it('ignores surrounding whitespace in the env name', () => {
    expect(isProductionLike({ APP_ENV: ' development ' } as NodeJS.ProcessEnv)).toBe(false);
  });
  it('treats NODE_ENV=production with no APP_ENV as production-like', () => {
    expect(isProductionLike({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe('sendMock (AI canned responses)', () => {
  it('treats an unset environment as non-local', () => {
    expect(isLocalAiEnv({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it('returns 503 and no fabricated payload in production', () => {
    vi.stubEnv('APP_ENV', 'production');
    const res = fakeRes();
    sendMock(res as Response, { complianceSignal: 'Partial', keyFindings: [{ finding: 'x' }] });
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('keyFindings');
    expect((res.body as { code: string }).code).toBe('AI_UNAVAILABLE');
  });

  it('returns 503 in staging', () => {
    vi.stubEnv('APP_ENV', 'staging');
    expect(isLocalAiEnv()).toBe(false);
    const res = fakeRes();
    sendMock(res as Response, { proposals: [{ proposedAnswer: 'Yes' }] });
    expect(res.statusCode).toBe(503);
  });

  it('labels canned payloads isMock in local dev', () => {
    vi.stubEnv('APP_ENV', 'development');
    const res = fakeRes();
    sendMock(res as Response, { analysis: 'demo' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ analysis: 'demo', isMock: true });
  });
});

describe('aiRateLimitKey', () => {
  it('keys on the verified uid, not the X-Org-Id header', () => {
    const req = {
      user: { uid: 'u1' },
      header: () => 'org-attacker-rotating-value',
      body: { organizationId: 'org-other' },
    } as unknown as Request;
    expect(aiRateLimitKey(req)).toBe('uid:u1');
  });
  it('returns empty (falls back to IP) without a verified user', () => {
    const req = { header: () => 'org-x', body: {} } as unknown as Request;
    expect(aiRateLimitKey(req)).toBe('');
  });
});

describe('appBaseUrl (Stripe redirects)', () => {
  it('uses PUBLIC_APP_URL and strips trailing slashes', () => {
    expect(
      appBaseUrl({ APP_ENV: 'production', PUBLIC_APP_URL: 'https://guardentra.com/' } as NodeJS.ProcessEnv),
    ).toBe('https://guardentra.com');
  });
  it('refuses to guess in production when PUBLIC_APP_URL is unset', () => {
    expect(appBaseUrl({ APP_ENV: 'production' } as NodeJS.ProcessEnv)).toBeNull();
  });
  it('defaults to localhost in local dev', () => {
    expect(appBaseUrl({ APP_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('http://localhost:8080');
  });
});

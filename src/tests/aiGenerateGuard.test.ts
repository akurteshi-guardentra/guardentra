// @vitest-environment node
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import {
  AI_GENERATE_ORG_LIMIT_MESSAGE,
  AI_GENERATE_ORG_MAX,
  AI_GENERATE_ORG_REQUIRED_MESSAGE,
  AI_GENERATE_ORG_UNAVAILABLE_MESSAGE,
  aiGenerateOrgKey,
  createAiGenerateOrgLimiter,
  createResolveGenerateOrganization,
} from '../../server/lib/aiGenerateGuard';
import aiRoutes from '../../server/routes/ai';

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.setHeader = vi.fn(() => res);
  return res;
}

function productionEnv(): NodeJS.ProcessEnv {
  return { APP_ENV: 'production' };
}

async function runGate(
  loadProfile: (uid: string) => Promise<object | null | undefined>,
  req: Request,
  env: NodeJS.ProcessEnv,
) {
  const gate = createResolveGenerateOrganization(loadProfile, () => env);
  const res = mockRes();
  let continued = false;
  const next = (() => {
    continued = true;
  }) as NextFunction;
  await gate(req, res, next);
  return { res, continued };
}

describe('POST /api/ai/generate organization limit', () => {
  it('mounts the server-resolved org gate and limiter ahead of the handler', () => {
    const stack = (aiRoutes as unknown as {
      stack: { route?: { path: string; stack: { handle: { name: string } }[] } }[];
    }).stack;
    const route = stack.find((layer) => layer.route?.path === '/generate');
    const names = route?.route?.stack.map((layer) => layer.handle.name);
    expect(names?.[0]).toBe('resolveGenerateOrganization');
    expect(names?.[1]).toBe('aiGenerateOrgLimit');
  });

  it('keys the bucket from the user profile and ignores X-Org-Id and body.organizationId', async () => {
    const loadProfile = vi.fn(async () => ({ organizationId: 'org-real' }));
    const req = {
      user: { uid: 'member-1' },
      body: { organizationId: 'org-rotated' },
      headers: { 'x-org-id': 'org-header' },
      organizationId: 'org-forged-on-the-request',
    } as unknown as Request;
    expect(aiGenerateOrgKey(req)).toBe('');
    const result = await runGate(loadProfile, req, productionEnv());
    expect(loadProfile).toHaveBeenCalledWith('member-1');
    expect(result.continued).toBe(true);
    expect(aiGenerateOrgKey(req)).toBe('org:org-real');
  });

  it('shares one bucket across members and still serves a different organization', async () => {
    const gate = createResolveGenerateOrganization(
      async (uid) => ({ organizationId: uid.startsWith('other-') ? 'org-other' : 'org-shared' }),
      productionEnv,
    );
    const limit = createAiGenerateOrgLimiter();
    const pass = async (uid: string, bodyOrg: string) => {
      const req = {
        user: { uid },
        body: { organizationId: bodyOrg },
        headers: { 'x-org-id': bodyOrg },
        ip: '203.0.113.10',
      } as unknown as Request;
      const res = mockRes();
      let ready = false;
      await gate(req, res, () => {
        ready = true;
      });
      expect(ready).toBe(true);
      const next = vi.fn();
      limit(req, res, next);
      return { next, res };
    };

    for (let i = 0; i < 20; i += 1) {
      const first = await pass('member-a', `rotated-a-${i}`);
      expect(first.next).toHaveBeenCalledOnce();
    }
    for (let i = 0; i < AI_GENERATE_ORG_MAX - 20; i += 1) {
      const second = await pass('member-b', `rotated-b-${i}`);
      expect(second.next).toHaveBeenCalledOnce();
    }
    const blocked = await pass('member-b', 'brand-new-org');
    expect(blocked.next).not.toHaveBeenCalled();
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.res.body).toEqual({ error: AI_GENERATE_ORG_LIMIT_MESSAGE });

    const other = await pass('other-member', 'org-shared');
    expect(other.next).toHaveBeenCalledOnce();
    expect(other.res.status).not.toHaveBeenCalled();
  });

  it('does not open a new bucket when the client rotates organizationId without a trusted org', () => {
    const limit = createAiGenerateOrgLimiter();
    for (let i = 0; i < AI_GENERATE_ORG_MAX; i += 1) {
      const req = {
        user: { uid: 'solo' },
        body: { organizationId: `org-${i}` },
        headers: { 'x-org-id': `org-${i}` },
        ip: '203.0.113.4',
      } as unknown as Request;
      const next = vi.fn();
      limit(req, mockRes(), next);
      expect(next).toHaveBeenCalledOnce();
    }
    const blocked = mockRes();
    const next = vi.fn();
    limit(
      { user: { uid: 'solo' }, body: { organizationId: 'org-fresh' }, ip: '203.0.113.4' } as unknown as Request,
      blocked,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(blocked.status).toHaveBeenCalledWith(429);

    const otherUser = vi.fn();
    limit(
      { user: { uid: 'someone-else' }, body: { organizationId: 'org-0' }, ip: '203.0.113.4' } as unknown as Request,
      mockRes(),
      otherUser,
    );
    expect(otherUser).toHaveBeenCalledOnce();
  });

  it('refuses a production caller whose profile has no organization before any model work', async () => {
    const cases = [
      async () => null,
      async () => ({ role: 'admin' }),
      async () => ({ organizationId: '   ' }),
      async () => ({ organizationId: 12 }),
    ];
    for (const loadProfile of cases) {
      const result = await runGate(loadProfile, { user: { uid: 'member' } } as unknown as Request, productionEnv());
      expect(result.continued).toBe(false);
      expect(result.res.statusCode).toBe(403);
      expect(result.res.body).toEqual({ error: AI_GENERATE_ORG_REQUIRED_MESSAGE });
    }
  });

  it('fails closed when the profile cannot be read in production', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await runGate(
      async () => {
        throw new Error('firestore unavailable');
      },
      { user: { uid: 'member' } } as unknown as Request,
      productionEnv(),
    );
    warn.mockRestore();
    expect(result.continued).toBe(false);
    expect(result.res.statusCode).toBe(503);
    expect(result.res.body).toEqual({ error: AI_GENERATE_ORG_UNAVAILABLE_MESSAGE });
  });

  it('keeps a local demo working when no organization profile is available', async () => {
    const localReq = { user: { uid: 'local' }, body: { organizationId: 'org-from-client' } } as unknown as Request;
    const missing = await runGate(async () => null, localReq, { APP_ENV: 'development' });
    const anonymous = await runGate(async () => {
      throw new Error('no admin');
    }, {} as Request, { APP_ENV: 'test' });
    expect(missing.continued).toBe(true);
    expect(aiGenerateOrgKey(localReq)).toBe('');
    expect(anonymous.continued).toBe(true);
  });

  it('requires a signed-in caller in production', async () => {
    const result = await runGate(async () => ({ organizationId: 'org-1' }), {} as Request, productionEnv());
    expect(result.continued).toBe(false);
    expect(result.res.statusCode).toBe(401);
  });
});

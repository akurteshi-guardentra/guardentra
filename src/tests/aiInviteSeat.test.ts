import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { INVITE_SEAT_UNCLAIMED_MESSAGE } from '../../server/lib/inviteSeat';
import {
  AI_MEMBERSHIP_REQUIRED_MESSAGE,
  createRequireClaimedInviteSeat,
} from '../../server/middleware/requireClaimedInviteSeat';
import aiRoutes from '../../server/routes/ai';

function run(
  loadProfile: (uid: string) => Promise<object | null | undefined>,
  user: object | undefined,
  env: NodeJS.ProcessEnv,
) {
  const gate = createRequireClaimedInviteSeat(loadProfile, () => env);
  const req = { user } as unknown as Request;
  let statusCode = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  let continued = false;
  const next = (() => {
    continued = true;
  }) as NextFunction;
  return gate(req, res, next).then(() => ({ statusCode, body, continued }));
}

describe('KI#12 signed-in AI invite seat', () => {
  it('mounts the seat gate ahead of the AI handlers', () => {
    const first = (aiRoutes as unknown as { stack: { handle: { name: string } }[] }).stack[0];
    expect(first.handle.name).toBe('requireClaimedInviteSeat');
  });

  it('rejects an explicit unclaimed invite before the handler', async () => {
    const loadProfile = vi.fn(async () => ({ seatCountApplied: false, organizationId: 'org-1' }));
    const result = await run(loadProfile, { uid: 'invitee' }, { APP_ENV: 'production' });
    expect(loadProfile).toHaveBeenCalledWith('invitee');
    expect(result.continued).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.body).toEqual({ error: INVITE_SEAT_UNCLAIMED_MESSAGE });
  });

  it('allows a claimed seat and a profile that omits the marker', async () => {
    const claimed = vi.fn(async () => ({ seatCountApplied: true, organizationId: 'org-1' }));
    const omitted = vi.fn(async () => ({ organizationId: 'org-1', role: 'admin' }));
    expect((await run(claimed, { uid: 'member' }, { APP_ENV: 'staging' })).continued).toBe(true);
    expect((await run(omitted, { uid: 'founder' }, { APP_ENV: 'staging' })).continued).toBe(true);
  });

  it('refuses a signed-in caller with no user profile before the handler', async () => {
    const loadProfile = vi.fn(async () => null);
    const production = await run(loadProfile, { uid: 'stranger' }, { APP_ENV: 'production' });
    const staging = await run(loadProfile, { uid: 'stranger' }, { APP_ENV: 'staging' });
    const local = await run(loadProfile, { uid: 'stranger' }, { APP_ENV: 'development' });
    expect(loadProfile).toHaveBeenCalledWith('stranger');
    expect(production.continued).toBe(false);
    expect(production.statusCode).toBe(403);
    expect(production.body).toEqual({ error: AI_MEMBERSHIP_REQUIRED_MESSAGE });
    expect(staging.continued).toBe(false);
    expect(staging.statusCode).toBe(403);
    expect(local.continued).toBe(true);
  });

  it('refuses a profile with no organization id before the handler', async () => {
    const blank = vi.fn(async () => ({ seatCountApplied: true, organizationId: '  ' }));
    const missing = vi.fn(async () => ({ role: 'admin' }));
    const numeric = vi.fn(async () => ({ organizationId: 12, role: 'member' }));
    const production = await run(blank, { uid: 'member' }, { APP_ENV: 'production' });
    const staging = await run(missing, { uid: 'member' }, { APP_ENV: 'staging' });
    const typed = await run(numeric, { uid: 'member' }, { APP_ENV: 'production' });
    const local = await run(missing, { uid: 'member' }, { APP_ENV: 'development' });
    const unclaimed = await run(
      async () => ({ seatCountApplied: false }),
      { uid: 'invitee' },
      { APP_ENV: 'production' },
    );
    expect(production.continued).toBe(false);
    expect(production.statusCode).toBe(403);
    expect(production.body).toEqual({ error: AI_MEMBERSHIP_REQUIRED_MESSAGE });
    expect(staging.continued).toBe(false);
    expect(staging.statusCode).toBe(403);
    expect(typed.continued).toBe(false);
    expect(typed.statusCode).toBe(403);
    expect(local.continued).toBe(true);
    expect(unclaimed.continued).toBe(false);
    expect(unclaimed.body).toEqual({ error: INVITE_SEAT_UNCLAIMED_MESSAGE });
  });

  it('does not treat a vendor portal token as an org seat', async () => {
    const loadProfile = vi.fn(async () => ({ seatCountApplied: false }));
    const result = await run(
      loadProfile,
      { uid: 'portal_assessment-1', portalAssessmentId: 'assessment-1' },
      { APP_ENV: 'production' },
    );
    expect(loadProfile).not.toHaveBeenCalled();
    expect(result.continued).toBe(true);
  });

  it('requires a signed-in caller in production and allows a local demo', async () => {
    const loadProfile = vi.fn(async () => ({ seatCountApplied: false }));
    const production = await run(loadProfile, undefined, { APP_ENV: 'production' });
    const local = await run(loadProfile, undefined, { APP_ENV: 'development' });
    expect(loadProfile).not.toHaveBeenCalled();
    expect(production.statusCode).toBe(401);
    expect(production.continued).toBe(false);
    expect(local.continued).toBe(true);
  });

  it('fails closed when the profile cannot be read in production', async () => {
    const loadProfile = vi.fn(async () => {
      throw new Error('firestore unavailable');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const production = await run(loadProfile, { uid: 'invitee' }, { APP_ENV: 'production' });
    const local = await run(loadProfile, { uid: 'invitee' }, { APP_ENV: 'test' });
    warn.mockRestore();
    expect(production.statusCode).toBe(503);
    expect(production.body).toEqual({ error: 'Could not verify invite seat.' });
    expect(production.continued).toBe(false);
    expect(local.continued).toBe(true);
  });
});

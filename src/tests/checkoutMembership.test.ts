import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CHECKOUT_MEMBERSHIP_UNAVAILABLE,
  CHECKOUT_ORGANIZATION_REQUIRED,
  CheckoutOrganizationRequiredError,
  checkoutAdminGate,
  requireCheckoutOrganizationId,
  resolveCheckoutMembership,
} from '../../server/lib/checkoutMembership';
import { INVITE_SEAT_UNCLAIMED_MESSAGE, InviteSeatUnclaimedError } from '../../server/lib/inviteSeat';

describe('KI#12 checkout membership read', () => {
  it('refuses a Stripe session when the profile cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const readOrganizationId = vi.fn(async () => {
      throw new Error('firestore unavailable');
    });
    const result = await resolveCheckoutMembership(readOrganizationId);
    warn.mockRestore();
    expect(readOrganizationId).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: false, status: 503, error: CHECKOUT_MEMBERSHIP_UNAVAILABLE });
  });

  it('keeps an explicit unclaimed invite forbidden', async () => {
    const result = await resolveCheckoutMembership(async () => {
      throw new InviteSeatUnclaimedError();
    });
    expect(result).toEqual({ ok: false, status: 403, error: INVITE_SEAT_UNCLAIMED_MESSAGE });
  });

  it('continues after a verified organization id', async () => {
    expect(await resolveCheckoutMembership(async () => 'org-1', {})).toEqual({
      ok: true,
      organizationId: 'org-1',
    });
    expect(await resolveCheckoutMembership(async () => ' org-1 ', {})).toEqual({
      ok: true,
      organizationId: 'org-1',
    });
  });

  it('refuses a missing profile before opening a session', async () => {
    expect(await resolveCheckoutMembership(async () => null, {})).toEqual({
      ok: false,
      status: 403,
      error: CHECKOUT_ORGANIZATION_REQUIRED,
    });
    expect(await resolveCheckoutMembership(async () => null, { APP_ENV: 'production' })).toEqual({
      ok: false,
      status: 403,
      error: CHECKOUT_ORGANIZATION_REQUIRED,
    });
    expect(await resolveCheckoutMembership(async () => '   ', { APP_ENV: 'staging' })).toEqual({
      ok: false,
      status: 403,
      error: CHECKOUT_ORGANIZATION_REQUIRED,
    });
  });

  it('keeps a local demo working when the user profile is missing', async () => {
    expect(await resolveCheckoutMembership(async () => null, { APP_ENV: 'local' })).toEqual({
      ok: true,
      organizationId: null,
    });
  });

  it('reads membership when Firebase Admin is ready', () => {
    expect(checkoutAdminGate(true, {})).toBe('read');
    expect(checkoutAdminGate(true, { APP_ENV: 'local' })).toBe('read');
  });

  it('refuses checkout when Firebase Admin is not initialized', () => {
    expect(checkoutAdminGate(false, {})).toBe('unavailable');
    expect(checkoutAdminGate(false, { APP_ENV: 'production' })).toBe('unavailable');
    expect(checkoutAdminGate(false, { APP_ENV: 'staging' })).toBe('unavailable');
  });

  it('keeps a local demo working when Firebase Admin is not initialized', () => {
    expect(checkoutAdminGate(false, { APP_ENV: 'local' })).toBe('continue');
    expect(checkoutAdminGate(false, { NODE_ENV: 'test' })).toBe('continue');
  });

  it('refuses a profile with no organization id before opening a session', async () => {
    const readOrganizationId = async () => {
      throw new CheckoutOrganizationRequiredError();
    };
    expect(await resolveCheckoutMembership(readOrganizationId, {})).toEqual({
      ok: false,
      status: 403,
      error: CHECKOUT_ORGANIZATION_REQUIRED,
    });
    expect(
      await resolveCheckoutMembership(readOrganizationId, { APP_ENV: 'production' }),
    ).toEqual({
      ok: false,
      status: 403,
      error: CHECKOUT_ORGANIZATION_REQUIRED,
    });
  });

  it('keeps a local demo working when the profile has no organization id', async () => {
    const result = await resolveCheckoutMembership(
      async () => {
        throw new CheckoutOrganizationRequiredError();
      },
      { APP_ENV: 'local' },
    );
    expect(result).toEqual({ ok: true, organizationId: null });
  });

  it('treats a blank or non-string organization id as missing', () => {
    expect(requireCheckoutOrganizationId({ organizationId: ' org-1 ' })).toBe('org-1');
    expect(() => requireCheckoutOrganizationId({})).toThrow(CheckoutOrganizationRequiredError);
    expect(() => requireCheckoutOrganizationId({ organizationId: '   ' })).toThrow(
      CheckoutOrganizationRequiredError,
    );
    expect(() => requireCheckoutOrganizationId({ organizationId: 12 })).toThrow(
      CheckoutOrganizationRequiredError,
    );
  });

  it('returns the refusal before creating a checkout session', () => {
    const route = readFileSync(resolve(process.cwd(), 'server/routes/stripe.ts'), 'utf8');
    const start = route.indexOf("router.post('/create-checkout-session'");
    const create = route.indexOf('stripe.checkout.sessions.create', start);
    const handler = route.slice(start, create);
    expect(start).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(start);
    const init = handler.indexOf('ensureAdmin()');
    const gate = handler.indexOf('checkoutAdminGate');
    const read = handler.indexOf('resolveCheckoutMembership');
    expect(init).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(init);
    expect(read).toBeGreaterThan(gate);
    expect(handler).toContain("adminGate === 'unavailable'");
    expect(handler).toContain("adminGate === 'read'");
    expect(handler).toContain('CHECKOUT_MEMBERSHIP_UNAVAILABLE');
    expect(handler).toContain('if (!membership.ok)');
    expect(handler).toContain('return res.status(membership.status).json({ error: membership.error })');
    expect(handler).toContain('catalogPlanIdForCheckoutPrice');
    expect(handler).toContain('This price is not available.');
    expect(handler.indexOf('catalogPlanIdForCheckoutPrice')).toBeLessThan(
      handler.indexOf('resolveCheckoutMembership'),
    );
    expect(handler).not.toContain("|| 'starter'");
    expect(handler).not.toContain('if (getApps().length > 0)');
    expect(handler).not.toContain('could not resolve organizationId for checkout metadata');

    const readerStart = route.indexOf('async function resolveOrgIdForUser');
    const readerEnd = route.indexOf('function firstSubscriptionPriceId', readerStart);
    const reader = route.slice(readerStart, readerEnd);
    const missing = reader.indexOf('!userSnap.exists');
    const unclaimed = reader.indexOf('inviteSeatUnclaimed');
    const required = reader.indexOf('requireCheckoutOrganizationId');
    expect(readerStart).toBeGreaterThan(-1);
    expect(readerEnd).toBeGreaterThan(readerStart);
    expect(missing).toBeGreaterThan(-1);
    expect(unclaimed).toBeGreaterThan(missing);
    expect(required).toBeGreaterThan(unclaimed);
    expect(reader).toContain('throw new CheckoutOrganizationRequiredError()');
    expect(reader).not.toContain('return null');
    expect(reader).not.toContain('return typeof orgId');
  });
});

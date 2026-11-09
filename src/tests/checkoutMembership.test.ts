import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  CHECKOUT_MEMBERSHIP_UNAVAILABLE,
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

  it('continues after a verified read, including a missing organization', async () => {
    expect(await resolveCheckoutMembership(async () => 'org-1')).toEqual({
      ok: true,
      organizationId: 'org-1',
    });
    expect(await resolveCheckoutMembership(async () => null)).toEqual({
      ok: true,
      organizationId: null,
    });
  });

  it('returns the refusal before creating a checkout session', () => {
    const route = readFileSync(resolve(process.cwd(), 'server/routes/stripe.ts'), 'utf8');
    const start = route.indexOf("router.post('/create-checkout-session'");
    const create = route.indexOf('stripe.checkout.sessions.create', start);
    const handler = route.slice(start, create);
    expect(start).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(start);
    expect(handler).toContain('resolveCheckoutMembership');
    expect(handler).toContain('if (!membership.ok)');
    expect(handler).toContain('return res.status(membership.status).json({ error: membership.error })');
    expect(handler).not.toContain('could not resolve organizationId for checkout metadata');
  });
});

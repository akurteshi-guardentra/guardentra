import { isProductionLike } from '../middleware/requireFirebaseAuth';
import { InviteSeatUnclaimedError } from './inviteSeat';

export const CHECKOUT_MEMBERSHIP_UNAVAILABLE = 'Could not verify organization membership.';
export const CHECKOUT_ORGANIZATION_REQUIRED = 'Organization membership required.';

export class CheckoutOrganizationRequiredError extends Error {
  readonly code = 'organization_required';
  readonly status = 403;

  constructor() {
    super(CHECKOUT_ORGANIZATION_REQUIRED);
    this.name = 'CheckoutOrganizationRequiredError';
  }
}

export type CheckoutMembership =
  | { ok: true; organizationId: string | null }
  | { ok: false; status: 403 | 503; error: string };

/** Blank, missing, or non-string organization ids are not a tenant membership. */
export function requireCheckoutOrganizationId(profile: object): string {
  const orgId = (profile as { organizationId?: unknown }).organizationId;
  const organizationId = typeof orgId === 'string' ? orgId.trim() : '';
  if (!organizationId) throw new CheckoutOrganizationRequiredError();
  return organizationId;
}

/**
 * KI#12. Checkout must not open a Stripe session when the profile read fails,
 * when the invite seat is unclaimed, or when a profile has no organization id
 * outside a local demo. A missing profile still continues. A profile that
 * names an organization and omits the seat marker stays a member.
 */
export async function resolveCheckoutMembership(
  readOrganizationId: () => Promise<string | null>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CheckoutMembership> {
  try {
    return { ok: true, organizationId: await readOrganizationId() };
  } catch (err) {
    if (err instanceof InviteSeatUnclaimedError) {
      return { ok: false, status: 403, error: err.message };
    }
    if (err instanceof CheckoutOrganizationRequiredError) {
      if (!isProductionLike(env)) {
        return { ok: true, organizationId: null };
      }
      return { ok: false, status: 403, error: err.message };
    }
    console.warn('[stripe] could not verify organization membership', err);
    return { ok: false, status: 503, error: CHECKOUT_MEMBERSHIP_UNAVAILABLE };
  }
}

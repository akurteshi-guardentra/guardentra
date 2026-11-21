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

/** What checkout may do once Firebase Admin is or is not initialized. */
export type CheckoutAdminGate = 'read' | 'continue' | 'unavailable';

/** Blank, missing, or non-string organization ids are not a tenant membership. */
export function requireCheckoutOrganizationId(profile: object): string {
  const orgId = (profile as { organizationId?: unknown }).organizationId;
  const organizationId = typeof orgId === 'string' ? orgId.trim() : '';
  if (!organizationId) throw new CheckoutOrganizationRequiredError();
  return organizationId;
}

/**
 * Staging and production must read membership before Stripe opens a session.
 * A local demo may continue while Admin is down. If Admin is still down after
 * the production init attempt, the session is refused.
 */
export function checkoutAdminGate(
  adminReady: boolean,
  env: NodeJS.ProcessEnv = process.env,
): CheckoutAdminGate {
  if (adminReady) return 'read';
  if (!isProductionLike(env)) return 'continue';
  return 'unavailable';
}

/**
 * KI#12. Checkout must not open a Stripe session when the profile read fails,
 * when the invite seat is unclaimed, when the user profile is missing, or when
 * a profile has no organization id outside a local demo. A missing profile and
 * a blank organization id still continue on a local demo. A profile that names
 * an organization and omits the seat marker stays a member.
 */
export async function resolveCheckoutMembership(
  readOrganizationId: () => Promise<string | null>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CheckoutMembership> {
  try {
    const organizationId = await readOrganizationId();
    const trimmed = typeof organizationId === 'string' ? organizationId.trim() : '';
    if (!trimmed) throw new CheckoutOrganizationRequiredError();
    return { ok: true, organizationId: trimmed };
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

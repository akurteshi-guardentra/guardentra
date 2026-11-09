import { InviteSeatUnclaimedError } from './inviteSeat';

export const CHECKOUT_MEMBERSHIP_UNAVAILABLE = 'Could not verify organization membership.';

export type CheckoutMembership =
  | { ok: true; organizationId: string | null }
  | { ok: false; status: 403 | 503; error: string };

/**
 * KI#12. Checkout must not open a Stripe session when the profile read fails.
 * An explicit unclaimed invite is forbidden. A successful read, including a
 * missing profile or a marker that is not false, may continue.
 */
export async function resolveCheckoutMembership(
  readOrganizationId: () => Promise<string | null>,
): Promise<CheckoutMembership> {
  try {
    return { ok: true, organizationId: await readOrganizationId() };
  } catch (err) {
    if (err instanceof InviteSeatUnclaimedError) {
      return { ok: false, status: 403, error: err.message };
    }
    console.warn('[stripe] could not verify organization membership', err);
    return { ok: false, status: 503, error: CHECKOUT_MEMBERSHIP_UNAVAILABLE };
  }
}

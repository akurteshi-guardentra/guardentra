import { describe, expect, it } from 'vitest';
import {
  requireStripeMapping,
  shouldApplyStripeBillingEvent,
  stripeBillingCursorFields,
} from '../../server/lib/stripeWebhookIntegrity';

describe('#144 Stripe webhook integrity helpers', () => {
  it('accepts the first billing event', () => {
    expect(
      shouldApplyStripeBillingEvent(
        { id: 'evt_checkout', created: 100, type: 'checkout.session.completed' },
        null,
      ),
    ).toBe(true);
  });

  it('rejects duplicate and older events', () => {
    const current = {
      id: 'evt_new',
      created: 200,
      type: 'customer.subscription.updated',
    };

    expect(
      shouldApplyStripeBillingEvent(
        { id: 'evt_new', created: 200, type: 'customer.subscription.updated' },
        current,
      ),
    ).toBe(false);

    expect(
      shouldApplyStripeBillingEvent(
        { id: 'evt_old', created: 199, type: 'customer.subscription.deleted' },
        current,
      ),
    ).toBe(false);
  });

  it('uses deterministic same-second precedence so delivery order cannot resurrect a deleted subscription', () => {
    const checkout = { id: 'evt_checkout', created: 300, type: 'checkout.session.completed' as const };
    const updated = { id: 'evt_updated', created: 300, type: 'customer.subscription.updated' as const };
    const deleted = { id: 'evt_deleted', created: 300, type: 'customer.subscription.deleted' as const };

    expect(shouldApplyStripeBillingEvent(updated, checkout)).toBe(true);
    expect(shouldApplyStripeBillingEvent(deleted, updated)).toBe(true);
    expect(shouldApplyStripeBillingEvent(updated, deleted)).toBe(false);
    expect(shouldApplyStripeBillingEvent(checkout, updated)).toBe(false);
  });

  it('persists a stable billing cursor without secrets', () => {
    expect(
      stripeBillingCursorFields({
        id: 'evt_123',
        created: 1234,
        type: 'customer.subscription.updated',
      }),
    ).toEqual({
      stripeLastEventId: 'evt_123',
      stripeLastEventCreated: 1234,
      stripeLastEventType: 'customer.subscription.updated',
    });
  });

  it('fails closed when required internal mapping is absent', () => {
    expect(requireStripeMapping('org_1', 'organization')).toBe('org_1');
    expect(() => requireStripeMapping('', 'organization')).toThrow(
      'Stripe webhook could not resolve required organization',
    );
    expect(() => requireStripeMapping(undefined, 'user')).toThrow(
      'Stripe webhook could not resolve required user',
    );
  });
});

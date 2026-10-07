export type GuardEntraStripeBillingEventType =
  | 'checkout.session.completed'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

export interface StripeBillingEventCursor {
  created?: number | null;
  type?: string | null;
  id?: string | null;
}

const EVENT_PRIORITY: Record<GuardEntraStripeBillingEventType, number> = {
  'checkout.session.completed': 10,
  'customer.subscription.updated': 20,
  'customer.subscription.deleted': 30,
};

export function stripeBillingEventPriority(type: string | null | undefined): number {
  if (!type) return 0;
  return EVENT_PRIORITY[type as GuardEntraStripeBillingEventType] || 0;
}

/**
 * Stripe does not guarantee webhook delivery order. We therefore persist a cursor
 * alongside billing state and refuse to let an older event overwrite newer state.
 *
 * Events created in the same second are resolved by semantic precedence:
 * subscription deletion > subscription update > checkout completion.
 * The same event id is always a duplicate.
 */
export function shouldApplyStripeBillingEvent(
  incoming: { id: string; created: number; type: GuardEntraStripeBillingEventType },
  current: StripeBillingEventCursor | null | undefined,
): boolean {
  if (!current) return true;
  if (current.id === incoming.id) return false;

  const currentCreated =
    typeof current.created === 'number' && Number.isFinite(current.created)
      ? current.created
      : null;

  if (currentCreated === null) return true;
  if (incoming.created > currentCreated) return true;
  if (incoming.created < currentCreated) return false;

  const incomingPriority = stripeBillingEventPriority(incoming.type);
  const currentPriority = stripeBillingEventPriority(current.type);
  if (incomingPriority > currentPriority) return true;
  if (incomingPriority < currentPriority) return false;

  // Same-second, same-precedence events still need a total order so final state
  // is independent of delivery order. Stripe event IDs are opaque; lexical
  // ordering is used only as a deterministic tie-breaker.
  const currentId = typeof current.id === 'string' ? current.id : '';
  return currentId === '' || incoming.id > currentId;
}

export function stripeBillingCursorFields(event: {
  id: string;
  created: number;
  type: GuardEntraStripeBillingEventType;
}) {
  return {
    stripeLastEventId: event.id,
    stripeLastEventCreated: event.created,
    stripeLastEventType: event.type,
  };
}

export function requireStripeMapping(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Stripe webhook could not resolve required ${label}`);
  }
  return value;
}

export function requireMatchingStripeSubscription(
  storedSubscriptionId: unknown,
  incomingSubscriptionId: string,
  ownerLabel: 'user' | 'organization',
): string {
  const stored = requireStripeMapping(storedSubscriptionId, `${ownerLabel} subscription`);
  const incoming = requireStripeMapping(incomingSubscriptionId, 'subscription');
  if (stored !== incoming) {
    throw new Error(`Stripe webhook subscription mapping mismatch for ${ownerLabel}`);
  }
  return incoming;
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(resolve(process.cwd(), 'server/routes/stripe.ts'), 'utf8');

describe('#144 Stripe webhook route contract', () => {
  it('does not acknowledge guarded billing events without Firebase persistence or Stripe reconciliation', () => {
    expect(route).toContain('refusing Stripe webhook acknowledgement');
    expect(route).toContain("res.status(503).send('Billing persistence unavailable')");
    expect(route).toContain('refusing billing reconciliation');
    expect(route).toContain("res.status(503).send('Billing reconciliation unavailable')");
    expect(route).not.toContain('Firebase Admin not initialized — skipping Firestore updates');
  });

  it('uses a durable event-id ledger and one Firestore transaction for guarded side effects', () => {
    expect(route).toContain("collection('stripeWebhookEvents').doc(event.id)");
    expect(route).toMatch(/db\.runTransaction\(async \(tx\) =>/);
    expect(route).toContain("status: 'processed'");
    expect(route).toContain('staleSkipped: !apply');
    expect(route).toContain('Stripe webhook duplicate ignored');
  });

  it('fails closed on unresolved internal identity and organization mapping', () => {
    expect(route).toContain("requireStripeMapping(");
    expect(route).toContain('Stripe webhook user mapping not found');
    expect(route).toContain('Stripe webhook customer mapping not found');
    expect(route).toContain('Stripe webhook organization mapping not found');
    expect(route).toContain('Stripe webhook customer mapping is ambiguous');
  });

  it('reconciles subscription events against Stripe current state before applying them', () => {
    expect(route).toContain('stripe.subscriptions.retrieve(eventSubscription.id)');
    expect(route).toContain("guardedType !== 'customer.subscription.deleted'");
    expect(route).toContain('shouldApplyStripeBillingEvent(cursor, currentCursor)');
  });
});

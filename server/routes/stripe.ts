import { Router } from 'express';
import Stripe from 'stripe';
import { getApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { ensureAdmin, requireFirebaseAuth } from '../middleware/requireFirebaseAuth';
import {
  requireStripeMapping,
  shouldApplyStripeBillingEvent,
  stripeBillingCursorFields,
  type GuardEntraStripeBillingEventType,
} from '../lib/stripeWebhookIntegrity';
import {
  buildServerStripePriceMap,
  DEFAULT_PLAN_ID,
  isPlanId,
  planCaps,
  resolvePlanIdFromPriceId,
  type PlanId,
} from '../lib/plans';

const router = Router();

try {
  ensureAdmin();
} catch (error) {
  console.warn('Firebase Admin initialization failed. Webhook DB updates may not work:', error);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2026-03-25.dahlia' as any,
});

function getAdminDb(): Firestore {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
      return getFirestore(getApp(), config.firestoreDatabaseId);
    }
  }
  return getFirestore();
}

function buildOrgPlanPatch(
  planId: PlanId,
  extras: {
    subscriptionStatus: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  },
) {
  const caps = planCaps(planId);
  return {
    planId: caps.planId,
    vendorCap: caps.vendorCap,
    seatCap: caps.seatCap,
    subscriptionStatus: extras.subscriptionStatus,
    ...(extras.stripeCustomerId ? { stripeCustomerId: extras.stripeCustomerId } : {}),
    ...(extras.stripeSubscriptionId
      ? { stripeSubscriptionId: extras.stripeSubscriptionId }
      : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' && id ? id : null;
  }
  return null;
}

function billingEventType(type: string): GuardEntraStripeBillingEventType | null {
  if (
    type === 'checkout.session.completed' ||
    type === 'customer.subscription.updated' ||
    type === 'customer.subscription.deleted'
  ) {
    return type;
  }
  return null;
}

async function resolveOrgIdForUser(db: Firestore, userId: string): Promise<string | null> {
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return null;
  const orgId = userSnap.data()?.organizationId;
  return typeof orgId === 'string' && orgId ? orgId : null;
}

function firstSubscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === 'string' ? price : price.id;
}

// Auth required: without it, any caller could pass an arbitrary userId/email and
// have a completed checkout misattributed to someone else's account via the webhook.
router.post('/create-checkout-session', requireFirebaseAuth, async (req, res) => {
  try {
    const { priceId } = req.body;
    const verifiedUser = (req as { user?: { uid?: string; email?: string } }).user;
    const userId = verifiedUser?.uid || req.body.userId;
    const email = verifiedUser?.email || req.body.email;

    if (!priceId || typeof priceId !== 'string') {
      return res.status(400).json({ error: 'priceId is required' });
    }
    if (!userId) {
      return res.status(401).json({ error: 'Could not determine the user for this checkout' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY is not set — cannot create a real checkout session.');
      return res.status(503).json({ error: 'Billing is not configured yet. Contact support.' });
    }

    const planId = resolvePlanIdFromPriceId(priceId, buildServerStripePriceMap()) || 'starter';
    let organizationId: string | null = null;
    if (getApps().length > 0) {
      try {
        organizationId = await resolveOrgIdForUser(getAdminDb(), userId);
      } catch (err) {
        console.warn('[stripe] could not resolve organizationId for checkout metadata', err);
      }
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/pricing?canceled=true`,
      customer_email: email,
      client_reference_id: userId,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      metadata: {
        userId,
        planId,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }
    if (!sig) {
      throw new Error('No stripe-signature header value was provided.');
    }

    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const guardedType = billingEventType(event.type);
  if (!guardedType) {
    console.log(`Unhandled event type ${event.type}`);
    return res.send();
  }

  if (getApps().length === 0) {
    console.error('Firebase Admin not initialized — refusing Stripe webhook acknowledgement');
    return res.status(503).send('Billing persistence unavailable');
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set — refusing billing reconciliation');
    return res.status(503).send('Billing reconciliation unavailable');
  }

  try {
    const db = getAdminDb();
    const priceMap = buildServerStripePriceMap();
    const eventRef = db.collection('stripeWebhookEvents').doc(event.id);
    const cursor = {
      id: event.id,
      created: event.created,
      type: guardedType,
    };

    if (guardedType === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = requireStripeMapping(
        session.client_reference_id || session.metadata?.userId,
        'user',
      );
      const customerId = requireStripeMapping(stripeObjectId(session.customer), 'customer');
      const subscriptionId = requireStripeMapping(
        stripeObjectId(session.subscription),
        'subscription',
      );

      let planId: PlanId =
        (isPlanId(session.metadata?.planId) && session.metadata.planId) || DEFAULT_PLAN_ID;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = firstSubscriptionPriceId(subscription);
      const fromPrice = resolvePlanIdFromPriceId(priceId, priceMap);
      if (fromPrice) planId = fromPrice;

      const result = await db.runTransaction(async (tx) => {
        const processed = await tx.get(eventRef);
        if (processed.exists && processed.data()?.status === 'processed') {
          return { duplicate: true, stale: false };
        }

        const userRef = db.collection('users').doc(userId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) {
          throw new Error(`Stripe webhook user mapping not found for ${userId}`);
        }

        const userData = userSnap.data() || {};
        const orgId = requireStripeMapping(
          (typeof session.metadata?.organizationId === 'string' &&
            session.metadata.organizationId) ||
            userData.organizationId,
          'organization',
        );
        const orgRef = db.collection('organizations').doc(orgId);
        const orgSnap = await tx.get(orgRef);
        if (!orgSnap.exists) {
          throw new Error(`Stripe webhook organization mapping not found for ${orgId}`);
        }

        const currentCursor = {
          id: orgSnap.data()?.stripeLastEventId,
          created: orgSnap.data()?.stripeLastEventCreated,
          type: orgSnap.data()?.stripeLastEventType,
        };
        const apply = shouldApplyStripeBillingEvent(cursor, currentCursor);

        if (apply) {
          const cursorFields = stripeBillingCursorFields(cursor);
          tx.set(
            userRef,
            {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: 'active',
              ...cursorFields,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          tx.set(
            orgRef,
            {
              ...buildOrgPlanPatch(planId, {
                subscriptionStatus: 'active',
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
              }),
              ...cursorFields,
            },
            { merge: true },
          );
        }

        tx.set(
          eventRef,
          {
            status: 'processed',
            eventType: guardedType,
            eventCreated: event.created,
            staleSkipped: !apply,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        return { duplicate: false, stale: !apply };
      });

      if (result.duplicate) {
        console.log(`Stripe webhook duplicate ignored: ${event.id}`);
      } else if (result.stale) {
        console.log(`Stripe webhook stale event ignored: ${event.id}`);
      } else {
        console.log(`Applied plan ${planId} for Stripe checkout event ${event.id}`);
      }
      return res.send();
    }

    const eventSubscription = event.data.object as Stripe.Subscription;
    let subscription = eventSubscription;
    try {
      // Reconcile against Stripe's current subscription object so an out-of-order
      // update event cannot restore stale status/price state.
      subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
    } catch (error) {
      if (guardedType !== 'customer.subscription.deleted') throw error;
      // A deleted subscription may no longer be retrievable. The signed delete event
      // remains authoritative for the terminal cancellation path.
    }

    const customerId = requireStripeMapping(stripeObjectId(subscription.customer), 'customer');
    const status = subscription.status;
    const priceId = firstSubscriptionPriceId(subscription);
    const fromPrice = resolvePlanIdFromPriceId(priceId, priceMap);
    const inactive =
      guardedType === 'customer.subscription.deleted' ||
      status === 'canceled' ||
      status === 'unpaid' ||
      status === 'incomplete_expired';

    if (!inactive && !fromPrice) {
      throw new Error(`Stripe webhook has no mapped plan for subscription ${subscription.id}`);
    }

    const planId: PlanId = inactive ? DEFAULT_PLAN_ID : (fromPrice as PlanId);

    const result = await db.runTransaction(async (tx) => {
      const processed = await tx.get(eventRef);
      if (processed.exists && processed.data()?.status === 'processed') {
        return { duplicate: true, stale: false };
      }

      const userQuery = db
        .collection('users')
        .where('stripeCustomerId', '==', customerId)
        .limit(2);
      const usersSnapshot = await tx.get(userQuery);
      if (usersSnapshot.empty) {
        throw new Error(`Stripe webhook customer mapping not found for ${customerId}`);
      }
      if (usersSnapshot.size !== 1) {
        throw new Error(`Stripe webhook customer mapping is ambiguous for ${customerId}`);
      }

      const userDoc = usersSnapshot.docs[0];
      const userRef = userDoc.ref;
      const userData = userDoc.data() || {};
      const orgId = requireStripeMapping(userData.organizationId, 'organization');
      const orgRef = db.collection('organizations').doc(orgId);
      const orgSnap = await tx.get(orgRef);
      if (!orgSnap.exists) {
        throw new Error(`Stripe webhook organization mapping not found for ${orgId}`);
      }

      const currentCursor = {
        id: orgSnap.data()?.stripeLastEventId,
        created: orgSnap.data()?.stripeLastEventCreated,
        type: orgSnap.data()?.stripeLastEventType,
      };
      const apply = shouldApplyStripeBillingEvent(cursor, currentCursor);

      if (apply) {
        const cursorFields = stripeBillingCursorFields(cursor);
        tx.set(
          userRef,
          {
            subscriptionStatus: inactive ? 'canceled' : status,
            stripeSubscriptionId: subscription.id,
            ...cursorFields,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        tx.set(
          orgRef,
          {
            ...buildOrgPlanPatch(planId, {
              subscriptionStatus: inactive ? 'canceled' : status,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
            }),
            ...cursorFields,
          },
          { merge: true },
        );
      }

      tx.set(
        eventRef,
        {
          status: 'processed',
          eventType: guardedType,
          eventCreated: event.created,
          staleSkipped: !apply,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return { duplicate: false, stale: !apply };
    });

    if (result.duplicate) {
      console.log(`Stripe webhook duplicate ignored: ${event.id}`);
    } else if (result.stale) {
      console.log(`Stripe webhook stale event ignored: ${event.id}`);
    } else {
      console.log(`Applied Stripe subscription event ${event.id}`);
    }

    return res.send();
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return res.status(500).send('Internal Server Error');
  }
});

export default router;

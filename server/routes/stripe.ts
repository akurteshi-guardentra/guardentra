import { Router } from 'express';
import Stripe from 'stripe';
import { getApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { ensureAdmin, requireFirebaseAuth } from '../middleware/requireFirebaseAuth';
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

async function applyOrgPlan(
  db: Firestore,
  orgId: string,
  planId: PlanId,
  extras: {
    subscriptionStatus: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
  }
) {
  const caps = planCaps(planId);
  await db
    .collection('organizations')
    .doc(orgId)
    .set(
      {
        planId: caps.planId,
        vendorCap: caps.vendorCap,
        seatCap: caps.seatCap,
        subscriptionStatus: extras.subscriptionStatus,
        ...(extras.stripeCustomerId
          ? { stripeCustomerId: extras.stripeCustomerId }
          : {}),
        ...(extras.stripeSubscriptionId
          ? { stripeSubscriptionId: extras.stripeSubscriptionId }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
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

  try {
    if (getApps().length === 0) {
      console.warn('Firebase Admin not initialized — skipping Firestore updates');
      res.send();
      return;
    }

    const db = getAdminDb();
    const priceMap = buildServerStripePriceMap();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log(`Checkout completed for user: ${userId}, subscription: ${subscriptionId}`);

        if (!userId) {
          console.warn('checkout.session.completed missing userId');
          break;
        }

        let planId: PlanId =
          (isPlanId(session.metadata?.planId) && session.metadata.planId) || DEFAULT_PLAN_ID;

        if (subscriptionId && process.env.STRIPE_SECRET_KEY) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const priceId = firstSubscriptionPriceId(subscription);
            const fromPrice = resolvePlanIdFromPriceId(priceId, priceMap);
            if (fromPrice) planId = fromPrice;
          } catch (err) {
            console.warn('[stripe] could not load subscription for plan resolution', err);
          }
        }

        await db
          .collection('users')
          .doc(userId)
          .set(
            {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: 'active',
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

        const orgId =
          (typeof session.metadata?.organizationId === 'string' &&
            session.metadata.organizationId) ||
          (await resolveOrgIdForUser(db, userId));

        if (orgId) {
          await applyOrgPlan(db, orgId, planId, {
            subscriptionStatus: 'active',
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          });
          console.log(`Applied plan ${planId} to org ${orgId}`);
        } else {
          console.warn(`No organizationId for user ${userId}; org caps not updated`);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const priceId = firstSubscriptionPriceId(subscription);
        const fromPrice = resolvePlanIdFromPriceId(priceId, priceMap);

        console.log(`Subscription ${subscription.id} updated to status: ${status}`);

        const usersSnapshot = await db
          .collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (usersSnapshot.empty) break;

        const userDoc = usersSnapshot.docs[0];
        const userId = userDoc.id;
        await db.collection('users').doc(userId).set(
          {
            subscriptionStatus: status,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        const orgId = await resolveOrgIdForUser(db, userId);
        if (!orgId) break;

        // Cancelled / unpaid → Starter caps (block new over-cap creates; keep existing vendors).
        const inactive =
          event.type === 'customer.subscription.deleted' ||
          status === 'canceled' ||
          status === 'unpaid' ||
          status === 'incomplete_expired';

        const planId: PlanId = inactive
          ? DEFAULT_PLAN_ID
          : fromPrice || DEFAULT_PLAN_ID;

        await applyOrgPlan(db, orgId, planId, {
          subscriptionStatus: inactive ? 'canceled' : status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
        });
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
  } catch (error) {
    console.error('Error processing webhook event:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;

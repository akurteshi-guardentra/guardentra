import { Router } from 'express';
import Stripe from 'stripe';
import * as admin from 'firebase-admin';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const router = Router();

// Initialize Firebase Admin for server-side database updates
try {
  if (getApps().length === 0) {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      initializeApp({
        projectId: config.projectId,
      });
    } else {
      initializeApp();
    }
  }
} catch (error) {
  console.warn("Firebase Admin initialization failed. Webhook DB updates may not work:", error);
}

// Initialize Stripe (will use process.env.STRIPE_SECRET_KEY automatically if set)
// We use a dummy key if not set to prevent crashing, but it won't work for real transactions.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
  apiVersion: '2026-03-25.dahlia' as any,
});

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, userId, email } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      // Mock response for development without Stripe keys
      console.warn("STRIPE_SECRET_KEY is not set. Returning a mock checkout URL.");
      return res.json({ url: 'https://checkout.stripe.com/pay/cs_test_mock123' });
    }

    // Create a Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'sepa_debit', 'sofort', 'giropay'], // Added European payment methods
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
        userId: userId // Store userId in metadata for the webhook
      }
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Stripe Webhook Endpoint
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }
    if (!sig) {
      throw new Error("No stripe-signature header value was provided.");
    }
    
    // req.body must be the raw buffer here. We configured express.raw() in server.ts
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        console.log(`Checkout completed for user: ${userId}, subscription: ${subscriptionId}`);

        if (userId && getApps().length > 0) {
          // Update user's subscription status in Firestore
          const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
          let db;
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
               db = getFirestore(getApp(), config.firestoreDatabaseId);
            } else {
               db = getFirestore();
            }
          } else {
            db = getFirestore();
          }

          await db.collection('users').doc(userId).set({
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: 'active',
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          
          console.log(`Successfully updated Firestore for user ${userId}`);
        } else {
          console.warn(`Could not update Firestore. userId: ${userId}, admin initialized: ${getApps().length > 0}`);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        
        console.log(`Subscription ${subscription.id} updated to status: ${status}`);
        
        if (getApps().length > 0) {
          const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
          let db;
          if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
               db = getFirestore(getApp(), config.firestoreDatabaseId);
            } else {
               db = getFirestore();
            }
          } else {
            db = getFirestore();
          }

          // Find the user with this customerId
          const usersSnapshot = await db.collection('users').where('stripeCustomerId', '==', customerId).get();
          
          if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].id;
            await db.collection('users').doc(userId).set({
              subscriptionStatus: status,
              updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`Successfully updated subscription status for user ${userId}`);
          }
        }
        break;
      }
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  } catch (error) {
    console.error("Error processing webhook event:", error);
    res.status(500).send("Internal Server Error");
  }
});

export default router;

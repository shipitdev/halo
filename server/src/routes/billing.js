/**
 * Halo Server — Billing Routes (Stripe)
 * POST /create-checkout, POST /webhook, GET /subscription
 */

const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

let stripe;
try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch {
  console.warn('Stripe not configured — billing routes will return 503.');
}

/**
 * POST /api/billing/create-checkout
 * Create a Stripe Checkout Session for Pro upgrade.
 */
router.post('/create-checkout', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured.' });

  try {
    const user = req.user;

    // Create or retrieve Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { haloUserId: String(user.id) },
      });
      customerId = customer.id;

      await query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, user.id]
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID_PRO,
          quantity: 1,
        },
      ],
      success_url: `${req.headers.origin || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'http://localhost:3000'}/billing/cancel`,
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout creation error:', err);
    res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events.
 * Note: This route receives raw body (configured in index.js).
 */
router.post('/webhook', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Billing not configured.' });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature.' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer;

        await query(
          "UPDATE users SET plan = 'pro', updated_at = NOW() WHERE stripe_customer_id = $1",
          [customerId]
        );
        console.log(`✦ User upgraded to Pro: ${customerId}`);
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const isActive = ['active', 'trialing'].includes(subscription.status);

        await query(
          'UPDATE users SET plan = $1, updated_at = NOW() WHERE stripe_customer_id = $2',
          [isActive ? 'pro' : 'free', customerId]
        );
        console.log(`✦ Subscription ${isActive ? 'active' : 'cancelled'}: ${customerId}`);
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

/**
 * GET /api/billing/subscription
 * Get current subscription info.
 */
router.get('/subscription', requireAuth, async (req, res) => {
  try {
    res.json({
      plan: req.user.plan || 'free',
      hasStripeCustomer: !!req.user.stripe_customer_id,
    });
  } catch (err) {
    console.error('Subscription query error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription.' });
  }
});

module.exports = router;

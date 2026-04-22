import Stripe from 'stripe';
import { requireAuth } from './_lib/authMiddleware.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const PLAN_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_id',
  premium: process.env.STRIPE_PRICE_PREMIUM || 'price_premium_id'
};

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.split('/').pop(); // Gets 'billing' or the last part

  // Determine if it's a webhook based on path or header
  if (req.headers['stripe-signature'] || path === 'webhook') {
    return handleWebhook(req, res);
  }

  // Otherwise treat as checkout (default)
  return handleCheckout(req, res);
}

async function handleCheckout(req, res) {
  // Manual body parsing since we disabled it globally
  let body = {};
  try {
    const rawBody = await buffer(req);
    body = JSON.parse(rawBody.toString());
  } catch (e) { /* ignore */ }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { plan, successUrl, cancelUrl } = body;

  if (!plan || !PLAN_PRICES[plan]) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
      success_url: successUrl || `${req.headers.origin || 'http://localhost:5173'}/app?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.origin || 'http://localhost:5173'}/app?checkout=canceled`,
      client_reference_id: auth.user.id,
      customer_email: auth.user.email,
      metadata: { userId: auth.user.id, plan: plan }
    });
    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar sessão de checkout' });
  }
}

async function handleWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const { query } = await import('./_lib/db.js');
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan || 'pro';
        if (userId) {
          let tokensLimit = plan === 'pro' ? 500000 : (plan === 'premium' ? 5000000 : 50000);
          await query('UPDATE profiles SET plan = $1, tokens_limit = $2, updated_at = NOW() WHERE id = $3', [plan, tokensLimit, userId]);
        }
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

import Stripe from 'stripe';
import { requireAuth } from '../_lib/authMiddleware.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_pro_id',
  premium: process.env.STRIPE_PRICE_PREMIUM || 'price_premium_id'
};

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { plan, successUrl, cancelUrl } = req.body;

  if (!plan || !PLAN_PRICES[plan]) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  try {
    // In a real app, you'd fetch the user's stripe_customer_id from the DB first
    // For now, we'll let Stripe create a new customer and link via client_reference_id
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: PLAN_PRICES[plan],
          quantity: 1,
        },
      ],
      success_url: successUrl || `${req.headers.origin || 'http://localhost:5173'}/app?checkout=success`,
      cancel_url: cancelUrl || `${req.headers.origin || 'http://localhost:5173'}/app?checkout=canceled`,
      client_reference_id: auth.user.id, // Very important: this links the payment to the user
      customer_email: auth.user.email,
      metadata: {
        userId: auth.user.id,
        plan: plan
      }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout Error]', error);
    res.status(500).json({ error: 'Erro ao criar sessão de checkout com Stripe. Verifique as chaves da API.' });
  }
}

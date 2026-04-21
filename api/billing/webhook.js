import Stripe from 'stripe';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Desativar o body parser padrão do Vercel/Express para ler o raw body (necessário para o Webhook do Stripe)
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`[Stripe Webhook Error] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Lidar com eventos do Stripe
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan || 'pro';
        
        if (userId) {
          console.log(`[Stripe] Checkout success for user ${userId}, upgrading to ${plan}`);
          
          let tokensLimit = 50000;
          if (plan === 'pro') tokensLimit = 500000;
          if (plan === 'premium') tokensLimit = 5000000;

          await supabaseAdmin
            .from('profiles')
            .update({ 
              plan: plan,
              tokens_limit: tokensLimit
            })
            .eq('id', userId);
        }
        break;
      }
      
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        // Se a assinatura for cancelada ou o pagamento falhar, fazer downgrade para 'free'
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        // Em um app real, você buscaria o userId pelo customerId
        // Por enquanto, apenas um log, já que não estamos salvando o customerId na tabela profiles ainda.
        console.log(`[Stripe] Payment failed or subscription deleted for customer ${customerId}`);
        break;
      }

      default:
        console.log(`[Stripe] Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`[Stripe Webhook DB Error]:`, err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

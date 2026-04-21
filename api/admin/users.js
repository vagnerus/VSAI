import { requireAdmin } from '../_lib/authMiddleware.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  // Config CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Protect route
  const auth = await requireAdmin(req, res);
  if (!auth) return; // res already sent 403 or 401

  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      // List users
      const { data: users, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url,
          role,
          plan,
          tokens_used_month,
          tokens_limit,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ users });
    }

    if (req.method === 'PUT') {
      // Update user role or plan
      const { id, role, plan } = req.body;
      if (!id) return res.status(400).json({ error: 'User ID is required' });

      const updates = {};
      if (role) updates.role = role;
      if (plan) {
        updates.plan = plan;
        // Adjust limits based on plan
        if (plan === 'free') updates.tokens_limit = 50000;
        else if (plan === 'pro') updates.tokens_limit = 500000;
        else if (plan === 'premium') updates.tokens_limit = 5000000;
      }
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, user: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

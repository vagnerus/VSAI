import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const supabase = getSupabaseClient(auth.token);
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('custom_instructions, plan, tokens_used_month, tokens_limit')
      .eq('id', auth.user.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ profile: data || {} });
  }

  if (req.method === 'POST') {
    const { custom_instructions } = req.body;
    
    const { data, error } = await supabase
      .from('profiles')
      .update({ custom_instructions })
      .eq('id', auth.user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: 'updated', profile: data });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

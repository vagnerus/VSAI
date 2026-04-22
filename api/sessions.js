import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const supabase = auth.token ? getSupabaseClient(auth.token) : null;
  const sessionId = req.query.id || req.body?.id || (req.query.path && req.query.path[0]);

  if (req.method === 'GET') {
    if (!supabase) return res.json({ sessions: [], messages: [] });

    // ─── Case A: Specific Session Detail ──────────────────────
    if (sessionId) {
      // In a real app, we'd fetch messages here
      return res.json({ sessionId, messages: [] });
    }

    // ─── Case B: List Sessions ───────────────────────────────
    const limit = parseInt(req.query.limit) || 20;
    const { data, error } = await supabase
      .from('sessions')
      .select('*, messages(count)')
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    
    const formatted = data.map(s => ({
      ...s,
      message_count: s.messages?.[0]?.count || 0
    }));

    return res.json({ sessions: formatted });
  }

  if (req.method === 'DELETE') {
    if (!sessionId || !supabase) return res.status(400).json({ error: 'Session ID required' });
    const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deleted: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

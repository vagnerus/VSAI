/**
 * GET /api/sessions — List sessions for authenticated user
 * DELETE /api/sessions?id=xxx — Delete a session
 */

import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const supabase = auth.token ? getSupabaseClient(auth.token) : null;

  if (req.method === 'GET') {
    if (!supabase) return res.json({ sessions: [] });

    const limit = parseInt(req.query.limit) || 20;
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });

    const sessions = (data || []).map(s => ({
      sessionId: s.id,
      title: s.title,
      projectId: s.project_id,
      messageCount: s.message_count,
      createdAt: s.created_at,
      lastModified: s.updated_at,
    }));
    return res.json({ sessions });
  }

  if (req.method === 'DELETE') {
    const sessionId = req.query.id || req.body?.id;
    if (!sessionId || !supabase) return res.status(400).json({ error: 'Session ID required' });

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deleted: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

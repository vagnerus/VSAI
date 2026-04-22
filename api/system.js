import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.split('/').pop();

  // 1. Health Check (No Auth needed)
  if (path === 'health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // 2. Auth needed for Teams
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const supabase = getSupabaseClient(auth.token);
  if (!supabase) return res.status(500).json({ error: 'DB not configured' });

  // Handle Teams Logic
  if (path === 'teams' || req.query.service === 'teams') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('team_members').select('role, teams(id, name, owner_id)').eq('user_id', auth.user.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ teams: data.map(m => ({ ...m.teams, my_role: m.role })) });
    }
    if (req.method === 'POST') {
      const { name } = req.body;
      const { data: team, error } = await supabase.from('teams').insert({ name, owner_id: auth.user.id }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      await supabase.from('team_members').insert({ team_id: team.id, user_id: auth.user.id, role: 'owner' });
      return res.json({ success: true, team });
    }
  }

  // Default system status
  res.status(200).json({ status: 'System service active', version: 'Alpha-1000' });
}

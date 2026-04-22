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

  // 2. Dashboard Logic
  if (path === 'dashboard') {
    try {
      const { count: totalSessions } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
      const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
      const { data: profile } = await supabase.from('profiles').select('tokens_used_month, tokens_limit, plan').eq('id', auth.user.id).single();
      const { data: recent } = await supabase.from('sessions').select('*').eq('user_id', auth.user.id).order('last_modified', { ascending: false }).limit(5);

      return res.json({
        stats: {
          totalSessions: totalSessions || 0,
          activeSessions: (totalSessions || 0) > 0 ? 1 : 0,
          totalTools: 28,
          totalMessages: totalMessages || 0,
          totalHooks: 12,
          uptime: Math.floor(process.uptime()),
          model: 'gemini-2.0-flash',
          apiConfigured: true,
          tokensUsed: profile?.tokens_used_month || 0,
          tokensLimit: profile?.tokens_limit || 50000,
          plan: profile?.plan || 'free'
        },
        recentSessions: recent || []
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 3. Handle Teams Logic
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

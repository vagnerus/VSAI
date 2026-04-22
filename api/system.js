import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = req.query.route || url.pathname.split('/').pop();

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

  // 3. Tools & Modules
  if (path === 'tools') {
    return res.json({
      tools: [
        { id: 't1', name: 'Web Search', category: 'Search', status: 'active' },
        { id: 't2', name: 'SEO Analyzer', category: 'Marketing', status: 'active' },
        { id: 't3', name: 'Code Executor', category: 'Dev', status: 'active' },
        { id: 't4', name: 'Image Gen', category: 'Media', status: 'active' }
      ]
    });
  }

  // 4. Hooks & Automations
  if (path === 'hooks') {
    return res.json({
      hooks: [
        { id: 'h1', name: 'Slack Notify', event: 'session_end', status: 'active' },
        { id: 'h2', name: 'Lead Export', event: 'new_lead', status: 'disabled' }
      ]
    });
  }

  // 5. System Config & Models
  if (path === 'config' || path === 'models') {
    return res.json({
      models: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', speed: 'ultra' },
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', speed: 'high' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', speed: 'high' }
      ],
      settings: {
        defaultModel: 'gemini-2.5-flash',
        maxTokens: 4096,
        safetyMode: 'enterprise'
      }
    });
  }

  // 6. Handle Teams Logic
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

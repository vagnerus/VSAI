import { requireAdmin } from './_lib/authMiddleware.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

const ALLOWED_TABLES = ['profiles', 'projects', 'sessions', 'messages', 'usage_logs', 'knowledge_files'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean);
  // Expected path: /api/admin/users or /api/admin?action=users
  const action = segments[1] || req.query.action || req.query.path?.[0];

  try {
    if (action === 'users') {
      if (req.method === 'GET') {
        const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return res.status(200).json({ users });
      }
      if (req.method === 'PUT') {
        const { id, role, plan, bonus_tokens } = req.body;
        const updates = {};
        if (role) updates.role = role;
        if (plan) updates.plan = plan;
        if (bonus_tokens) {
          const { data: current } = await supabase.from('profiles').select('tokens_limit').eq('id', id).single();
          updates.tokens_limit = (current?.tokens_limit || 0) + Number(bonus_tokens);
        }
        const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
        if (error) throw error;
        return res.status(200).json({ success: true, user: data });
      }
    }

    if (action === 'analytics') {
      const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: activeSessions } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
      const { data: usage } = await supabase.from('usage_logs').select('tokens_input, tokens_output, cost_usd');
      let totalTokens = 0, totalCost = 0;
      if (usage) usage.forEach(r => { totalTokens += (r.tokens_input || 0) + (r.tokens_output || 0); totalCost += Number(r.cost_usd || 0); });
      
      const { data: bi } = await supabase.from('sessions').select('sentiment_score, lead_score').limit(100);
      const sentiment = { positivo: 0, neutro: 0, negativo: 0 };
      let leads = 0;
      if (bi) bi.forEach(s => { if (s.sentiment_score) sentiment[s.sentiment_score]++; if (s.lead_score >= 7) leads++; });

      return res.status(200).json({ totalUsers, activeSessions, totalTokens, totalCostUSD: totalCost, bi: { sentiment, totalLeads: leads }, recentActivity: [] });
    }

    if (action === 'db') {
      const { table } = req.query;
      if (!table || !ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Denied' });
      const { data, error } = await supabase.from(table).select('*').limit(100);
      if (error) throw error;
      return res.status(200).json({ data });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

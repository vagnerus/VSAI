import { requireAdmin } from '../_lib/authMiddleware.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  // Config CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Protect route
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      // Fetch platform aggregates

      // 1. Total users
      const { count: totalUsers, error: usersErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 2. Active sessions
      const { count: activeSessions, error: sessErr } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true });

      // 3. Total usage sum
      const { data: usageData, error: usageErr } = await supabase
        .from('usage_logs')
        .select('tokens_input, tokens_output, cost_usd');

      let totalTokens = 0;
      let totalCost = 0;
      if (usageData) {
        usageData.forEach(row => {
          totalTokens += (row.tokens_input || 0) + (row.tokens_output || 0);
          totalCost += Number(row.cost_usd || 0);
        });
      }

      if (usersErr || sessErr || usageErr) {
        throw usersErr || sessErr || usageErr;
      }

      // 4. Recent Activity
      const { data: recent } = await supabase
        .from('')
        .select('name, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(3);

      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('title, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(3);

      const recentActivity = [];
      if (recent) {
        recent.forEach(p => recentActivity.push({ type: 'Projeto Criado', title: p.name, date: p.created_at }));
      }
      if (recentSessions) {
        recentSessions.forEach(s => recentActivity.push({ type: 'Nova Sessão', title: s.title, date: s.created_at }));
      }

      // Sort combined activity
      recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

      return res.status(200).json({
        totalUsers: totalUsers || 0,
        activeSessions: activeSessions || 0,
        totalTokens,
        totalCostUSD: totalCost,
        recentActivity: recentActivity.slice(0, 5)
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Admin Analytics] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

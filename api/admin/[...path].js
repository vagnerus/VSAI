/**
 * Combined admin API handler — catch-all route.
 * Handles: /api/admin/users, /api/admin/analytics, /api/admin/db
 * req.query.path = ['users'] | ['analytics'] | ['db']
 */

import { requireAdmin } from '../_lib/authMiddleware.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const ALLOWED_TABLES = ['profiles', 'projects', 'sessions', 'messages', 'usage_logs', 'knowledge_files'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

// ─── Users ───────────────────────────────────────────────────

async function handleUsers(req, res, supabase) {
  if (req.method === 'GET') {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, plan, tokens_used_month, tokens_limit, created_at, updated_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ users });
  }

  if (req.method === 'PUT') {
    const { id, role, plan, bonus_tokens } = req.body;
    if (!id) return res.status(400).json({ error: 'User ID is required' });
    const updates = {};
    if (role) updates.role = role;
    if (plan) {
      updates.plan = plan;
      if (plan === 'free') updates.tokens_limit = 50000;
      else if (plan === 'pro') updates.tokens_limit = 500000;
      else if (plan === 'premium') updates.tokens_limit = 5000000;
    }
    
    // Process bonus tokens
    if (bonus_tokens) {
      const { data: currentUser } = await supabase.from('profiles').select('tokens_limit').eq('id', id).single();
      updates.tokens_limit = (currentUser?.tokens_limit || 50000) + Number(bonus_tokens);
    }
    
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return res.status(200).json({ success: true, user: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ─── Analytics ───────────────────────────────────────────────

async function handleAnalytics(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { count: activeSessions } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
  const { data: usageData } = await supabase.from('usage_logs').select('tokens_input, tokens_output, cost_usd');

  let totalTokens = 0, totalCost = 0;
  if (usageData) {
    usageData.forEach(row => {
      totalTokens += (row.tokens_input || 0) + (row.tokens_output || 0);
      totalCost += Number(row.cost_usd || 0);
    });
  }

  // 📈 Business Intelligence: Sentiment & Leads (Optimized for Pillar 3)
  const { data: biSessions, error: biError } = await supabase
    .from('sessions')
    .select('sentiment_score, lead_score, title, user_id')
    .order('created_at', { ascending: false })
    .limit(500); // Guardrail to prevent memory spikes

  if (biError) console.error('[BI_ANALYTICS_ERROR]', biError);

  const sentimentStats = { positivo: 0, neutro: 0, negativo: 0 };
  const hotLeads = [];

  if (biSessions) {
    biSessions.forEach(s => {
      if (s.sentiment_score) sentimentStats[s.sentiment_score] = (sentimentStats[s.sentiment_score] || 0) + 1;
      if (s.lead_score >= 7) hotLeads.push(s);
    });
  }

  const { data: recent } = await supabase.from('projects').select('name, created_at, user_id').order('created_at', { ascending: false }).limit(3);
  const { data: recentSessions } = await supabase.from('sessions').select('title, created_at, user_id').order('created_at', { ascending: false }).limit(3);

  const recentActivity = [];
  if (recent) recent.forEach(p => recentActivity.push({ type: 'Projeto Criado', title: p.name, date: p.created_at }));
  if (recentSessions) recentSessions.forEach(s => recentActivity.push({ type: 'Nova Sessão', title: s.title, date: s.created_at }));
  recentActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

  return res.status(200).json({
    totalUsers: totalUsers || 0,
    activeSessions: activeSessions || 0,
    totalTokens,
    totalCostUSD: totalCost,
    recentActivity: recentActivity.slice(0, 5),
    bi: {
      sentiment: sentimentStats,
      hotLeads: hotLeads.slice(0, 5),
      totalLeads: hotLeads.length
    }
  });
}

// ─── DB Explorer ─────────────────────────────────────────────

async function handleDb(req, res, supabase) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { table } = req.query;
  // 🛡️ Zero Trust: Strict Whitelist Validation
  if (!table || !ALLOWED_TABLES.includes(table)) {
    console.error(`[SECURITY_ALERT] Unauthorized table access attempt: ${table}`);
    return res.status(403).json({ error: 'Acesso negado: Tabela não permitida ou inexistente.' });
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) {
      // Fallback for tables without created_at (Pillar 2: Resilience)
      if (error.code === '42703') {
        const { data: fallbackData, error: fallbackErr } = await supabase.from(table).select('*').limit(100);
        if (fallbackErr) throw fallbackErr;
        return res.status(200).json({ data: fallbackData });
      }
      throw error;
    }

    return res.status(200).json({ data });
  } catch (err) {
    console.error(`[DB_EXPLORER_ERROR][${table}]`, err);
    return res.status(500).json({ error: 'Erro ao consultar o banco de dados.' });
  }
}

// ─── Main router ─────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const supabase = getSupabaseAdmin();
  const pathSegments = req.query.path || [];
  const action = pathSegments[0];

  try {
    switch (action) {
      case 'users':     return await handleUsers(req, res, supabase);
      case 'analytics': return await handleAnalytics(req, res, supabase);
      case 'db':        return await handleDb(req, res, supabase);
      default:          return res.status(404).json({ error: 'Unknown admin route' });
    }
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

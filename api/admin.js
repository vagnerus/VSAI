import { requireAdmin } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

const ALLOWED_TABLES = ['profiles', 'projects', 'sessions', 'messages', 'usage_logs', 'project_knowledge', 'agents'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = req.query.action || req.query.route || url.pathname.split('/').pop();

  try {
    if (action === 'users') {
      if (req.method === 'GET') {
        const { rows: users } = await query('SELECT id, email, full_name, role, plan, tokens_used_month, tokens_limit, created_at FROM profiles ORDER BY created_at DESC');
        return res.status(200).json({ users });
      }
      if (req.method === 'PUT') {
        const { id, role, plan, bonus_tokens } = req.body;
        
        let updateQuery = 'UPDATE profiles SET updated_at = NOW()';
        let params = [];
        let paramCount = 1;

        if (role) { updateQuery += `, role = $${paramCount++}`; params.push(role); }
        if (plan) { updateQuery += `, plan = $${paramCount++}`; params.push(plan); }
        if (bonus_tokens) { 
          updateQuery += `, tokens_limit = tokens_limit + $${paramCount++}`; 
          params.push(Number(bonus_tokens)); 
        }

        updateQuery += ` WHERE id = $${paramCount} RETURNING id, email, full_name, role, plan, tokens_limit`;
        params.push(id);

        const { rows } = await query(updateQuery, params);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        
        return res.status(200).json({ success: true, user: rows[0] });
      }
    }

    if (action === 'analytics') {
      const { rows: totalUsersRow } = await query('SELECT COUNT(*) FROM profiles');
      const { rows: activeSessionsRow } = await query('SELECT COUNT(*) FROM sessions');
      const { rows: usage } = await query('SELECT SUM(tokens_input) as ti, SUM(tokens_output) as to_out, SUM(cost_usd) as cost FROM usage_logs');
      
      const totalUsers = parseInt(totalUsersRow[0].count, 10) || 0;
      const activeSessions = parseInt(activeSessionsRow[0].count, 10) || 0;
      
      const totalTokens = (parseInt(usage[0]?.ti || 0, 10)) + (parseInt(usage[0]?.to_out || 0, 10));
      const totalCost = parseFloat(usage[0]?.cost || 0);
      
      const { rows: biRows } = await query('SELECT sentiment_score, lead_score FROM sessions WHERE sentiment_score IS NOT NULL LIMIT 100');
      const sentiment = { positivo: 0, neutro: 0, negativo: 0 };
      let leads = 0;
      
      biRows.forEach(s => { 
        if (s.sentiment_score && sentiment[s.sentiment_score] !== undefined) sentiment[s.sentiment_score]++; 
        if (s.lead_score >= 7) leads++; 
      });

      // Gerar dados temporais simulados para os gráficos
      const timeseries = Array.from({length: 7}).map((_, i) => ({
        day: new Date(Date.now() - (6-i) * 86400000).toLocaleDateString('pt-BR', {weekday: 'short'}),
        tokens: Math.floor(Math.random() * 50000) + 10000
      }));

      // Top usuários
      const { rows: topUsers } = await query('SELECT full_name, email, tokens_used_month, plan FROM profiles ORDER BY tokens_used_month DESC LIMIT 5');

      return res.status(200).json({ 
        totalUsers, activeSessions, totalTokens, totalCostUSD: totalCost, 
        bi: { sentiment, totalLeads: leads }, recentActivity: [],
        timeseries, topUsers
      });
    }

    if (action === 'db') {
      const { table } = req.query;
      if (!table || !ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Acesso à tabela negado' });
      // B12 Fix: Use identifier quoting to prevent SQL injection even with allowlist
      const safeTable = table.replace(/[^a-z_]/g, '');
      if (!ALLOWED_TABLES.includes(safeTable)) return res.status(403).json({ error: 'Acesso à tabela negado' });
      const { rows: data } = await query(`SELECT * FROM "${safeTable}" LIMIT 100`);
      return res.status(200).json({ data });
    }

    if (action === 'memory') {
      const { rows: data } = await query('SELECT id, full_name, email, long_term_memory, user_personality FROM profiles WHERE long_term_memory IS NOT NULL OR user_personality IS NOT NULL');
      const { rows: count } = await query('SELECT COUNT(*) FROM project_knowledge');
      return res.status(200).json({ memories: data, systemVectors: parseInt(count[0].count, 10) || 0 });
    }

    if (action === 'settings') {
      if (req.method === 'GET') {
        const { rows } = await query('SELECT config FROM system_settings WHERE id = $1', ['main']).catch(() => ({ rows: [] }));
        return res.status(200).json({ settings: rows[0]?.config || {} });
      }
      if (req.method === 'PUT') {
        await query('CREATE TABLE IF NOT EXISTS system_settings (id VARCHAR(50) PRIMARY KEY, config JSONB NOT NULL)');
        const { rows } = await query('SELECT config FROM system_settings WHERE id = $1', ['main']);
        const currentConfig = rows[0]?.config || {};
        const newConfig = { ...currentConfig, ...req.body };
        await query('INSERT INTO system_settings (id, config) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET config = $2', ['main', newConfig]);
        return res.status(200).json({ success: true, settings: newConfig });
      }
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error) {
    console.error('[ADMIN_DB_ERROR]', error);
    return res.status(500).json({ error: error.message });
  }
}

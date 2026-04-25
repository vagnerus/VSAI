import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = req.query.route || url.pathname.split('/').pop();

  // 1. Health Check (No Auth needed)
  if (path === 'health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }

  // Auth needed for everything else
  const auth = await requireAuth(req, res);
  if (!auth) return;

  // Force admin role for specific email
  if (auth.user.email === 'vagneroliveira.us@gmail.com') {
    auth.user.role = 'admin';
  }

  // 2. Dashboard Logic
  if (path === 'dashboard') {
    try {
      const { rows: sessionCount } = await query('SELECT COUNT(*) FROM sessions');
      const { rows: messageCount } = await query('SELECT COUNT(*) FROM messages');
      const { rows: profile } = await query('SELECT tokens_used_month, tokens_limit, plan FROM profiles WHERE id = $1', [auth.user.id]);
      const { rows: recent } = await query('SELECT * FROM sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5', [auth.user.id]);

      const totalSessions = parseInt(sessionCount[0].count, 10);
      const totalMessages = parseInt(messageCount[0].count, 10);
      const p = profile[0] || {};

      return res.json({
        stats: {
          totalSessions: totalSessions || 0,
          activeSessions: totalSessions > 0 ? 1 : 0,
          totalTools: 28,
          totalMessages: totalMessages || 0,
          totalHooks: 12,
          uptime: Math.floor(process.uptime()),
          model: 'gemini-1.5-flash',
          apiConfigured: true,
          tokensUsed: p.tokens_used_month || 0,
          tokensLimit: p.tokens_limit || 50000,
          plan: p.plan || 'free'
        },
        recentSessions: recent || []
      });
    } catch (err) {
      console.error('[System_DB_Error]', err);
      return res.status(500).json({ error: 'Erro ao buscar dados do dashboard.' });
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
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', speed: 'ultra' },
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', speed: 'high' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', speed: 'high' }
      ],
      settings: {
        defaultModel: 'gemini-1.5-flash',
        maxTokens: 4096,
        safetyMode: 'enterprise'
      }
    });
  }

  // Default system status
  res.status(200).json({ status: 'System service active', version: 'PostgreSQL-1.0' });
}

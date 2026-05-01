import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';
import fs from 'fs';
import pathLib from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathLib.dirname(__filename);
const configPath = pathLib.join(__dirname, '../nexus.config.json');

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = req.query.route || url.pathname.split('/').pop();

  // 1. Health & Vector Diagnostic Check
  if (path === 'health') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  if (path === 'test-vector') {
    try {
      await query('CREATE EXTENSION IF NOT EXISTS vector;');
      return res.status(200).json({ status: 'SUCCESS', message: 'Extensão pgvector está ATIVADA e suportada no banco!' });
    } catch (err) {
      return res.status(200).json({ status: 'FAILED', message: 'Banco de dados não suporta pgvector.', error: err.message });
    }
  }

  // Auth needed for everything else
  const auth = await requireAuth(req, res);
  if (!auth) return;

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
    if (req.method === 'POST') {
      try {
        const { tool, apiKey, ...rest } = req.body;
        
        // Buscar config atual
        const { rows: currentRows } = await query('SELECT config FROM profiles WHERE id = $1', [auth.user.id]);
        const currentConfig = currentRows[0]?.config || {};
        
        let newConfig = { ...currentConfig, ...rest };

        // Se for uma configuração de ferramenta específica (ex: webSearch)
        if (tool && apiKey) {
          newConfig.tools = newConfig.tools || {};
          newConfig.tools[tool] = { 
            apiKey, 
            active: true,
            updatedAt: new Date().toISOString() 
          };
          
          // Mapeamento de chaves legadas para compatibilidade
          if (tool === 'webSearch') newConfig.tavilyApiKey = apiKey;
          if (tool === 'python') newConfig.pythonKey = apiKey;
        }

        // Atualizar campos globais se presentes
        if (req.body.geminiApiKey) newConfig.geminiApiKey = req.body.geminiApiKey;
        if (req.body.anthropicApiKey) newConfig.anthropicApiKey = req.body.anthropicApiKey;
        if (req.body.defaultProvider) newConfig.defaultProvider = req.body.defaultProvider;

        await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;`).catch(() => {});
        await query('UPDATE profiles SET config = $1 WHERE id = $2', [newConfig, auth.user.id]);
        
        return res.json({ status: 'success', message: 'Configurações sincronizadas com a nuvem VSAI.', config: newConfig });
      } catch (err) {
        console.error('[CONFIG_SAVE_ERROR]', err);
        return res.status(500).json({ error: 'Falha ao processar configurações.', details: err.message });
      }
    }

    // GET handler
    try {
      let savedConfig = {};
      try {
        await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;`);
        
        const resDb = await query('SELECT config FROM profiles WHERE id = $1', [auth.user.id]);
        if (resDb.rows.length > 0 && resDb.rows[0].config) {
          savedConfig = resDb.rows[0].config;
        }
      } catch (e) { console.error('Erro ao ler config do perfil', e.message); }

      return res.json({
        showOtherModels: false, // Default
        ...savedConfig,
        models: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', speed: 'ultra' },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', speed: 'high' },
          { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', speed: 'high' },
          { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', speed: 'high' }
        ],
        settings: {
          defaultModel: savedConfig.googleModel || 'gemini-2.5-flash',
          maxTokens: 4096,
          safetyMode: 'enterprise'
        }
      });
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao carregar config', details: e.message });
    }
  }

  // Default system status
  res.status(200).json({ status: 'System service active', version: 'PostgreSQL-1.0' });
}

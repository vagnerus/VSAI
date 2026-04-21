/**
 * Combined system API handler — consolidates multiple endpoints into one serverless function.
 * Routed via vercel.json rewrites using ?route= query parameter.
 * Handles: health, dashboard, config, settings, models, tools, hooks, permissions, permissions-mode
 */

import { getApiClient, resetClient } from './_lib/clientFactory.js';
import { verifyAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';
import { getAllTools } from '../src/tools/registry.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../nexus.config.json');

const HOOK_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse',
  'AIResponseGenerated', 'ErrorOccurred', 'PermissionDenied', 'PermissionGranted',
  'ContextWindowOptimized', 'CostThresholdReached', 'ModelSwitched',
  'CompactTriggered', 'SessionSaved', 'ToolRegistered', 'PluginLoaded',
  'WorkerSpawned', 'WorkerCompleted', 'SwarmMessage', 'ProjectCreated',
];

let currentMode = 'default';

// ─── Sub-handlers ────────────────────────────────────────────

function handleHealth(req, res) {
  const apiClient = getApiClient();
  res.json({
    status: 'ok', version: '1.0.0', name: 'NexusAI',
    apiConfigured: apiClient.isConfigured(),
    provider: apiClient.constructor.name,
  });
}

async function handleDashboard(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  const supabase = auth?.token ? getSupabaseClient(auth.token) : null;

  if (!supabase) {
    return res.json({
      stats: {
        totalSessions: 0, activeSessions: 0, totalMessages: 0, totalTools: 0,
        totalHooks: 0, apiConfigured: !!process.env.GEMINI_API_KEY, uptime: 0,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', provider: 'Gemini',
        plan: 'free', tokensUsed: 0, tokensLimit: 50000,
      },
      recentSessions: [],
    });
  }

  try {
    const { data: profile } = await supabase.from('profiles').select('plan, tokens_used_month, tokens_limit').eq('id', auth.user.id).single();
    const { count: sessionCount } = await supabase.from('sessions').select('*', { count: 'exact', head: true });
    const { count: messageCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    const { data: recentSessions } = await supabase.from('sessions').select('*').order('updated_at', { ascending: false }).limit(5);

    return res.json({
      stats: {
        totalSessions: sessionCount || 0, activeSessions: 0, totalMessages: messageCount || 0,
        totalTools: 20, totalHooks: 0, apiConfigured: true, uptime: 0,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        provider: process.env.DEFAULT_PROVIDER === 'anthropic' ? 'Anthropic' : 'Gemini',
        plan: profile?.plan || 'free', tokensUsed: profile?.tokens_used_month || 0,
        tokensLimit: profile?.tokens_limit || 50000,
      },
      recentSessions: (recentSessions || []).map(s => ({
        sessionId: s.id, firstPrompt: s.title, messageCount: s.message_count, lastModified: s.updated_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function handleConfig(req, res) {
  if (req.method === 'GET') {
    if (!fs.existsSync(CONFIG_PATH)) {
      return res.json({ geminiApiKey: '', anthropicApiKey: '', defaultProvider: 'gemini', googleModel: 'gemini-2.5-flash', anthropicModel: 'claude-sonnet-4-20250514' });
    }
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      const masked = { ...data };
      if (masked.geminiApiKey) masked.geminiApiKey = '••••••••' + masked.geminiApiKey.slice(-4);
      if (masked.anthropicApiKey) masked.anthropicApiKey = '••••••••' + masked.anthropicApiKey.slice(-4);
      return res.json(masked);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'POST') {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(req.body, null, 2));
      resetClient();
      const apiClient = getApiClient();
      return res.json({ status: 'success', provider: apiClient.constructor.name });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}

function handleSettings(req, res) {
  const apiClient = getApiClient();
  if (req.method === 'GET') {
    return res.json({
      apiConfigured: apiClient.isConfigured(),
      provider: apiClient.constructor.name,
      model: process.env.GEMINI_MODEL || process.env.ANTHROPIC_MODEL || 'gemini-2.5-flash',
      maxTokens: parseInt(process.env.MAX_TOKENS) || 8192,
      permissionMode: 'default',
    });
  }
  if (req.method === 'POST') {
    return res.json({ status: 'updated', note: 'No Vercel, altere as configurações nas Environment Variables do painel Vercel.' });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

function handleModels(req, res) {
  const apiClient = getApiClient();
  res.json({ models: apiClient.getAvailableModels() });
}

function handleTools(req, res) {
  try {
    const tools = getAllTools().map(t => ({
      name: t.name, description: t.description || '',
      isReadOnly: t.isReadOnly ? t.isReadOnly({}) : false,
      isConcurrencySafe: t.isConcurrencySafe ? t.isConcurrencySafe({}) : false,
      isEnabled: t.isEnabled ? t.isEnabled() : true,
      inputSchema: t.inputSchema || {},
    }));
    res.json({ tools });
  } catch {
    res.json({ tools: [] });
  }
}

function handleHooks(req, res) {
  if (req.method === 'GET') return res.json({ hooks: [], eventTypes: HOOK_EVENTS });
  if (req.method === 'POST') return res.json({ id: `hook_${Date.now()}`, status: 'registered' });
  res.status(405).json({ error: 'Method not allowed' });
}

function handlePermissions(req, res) {
  if (req.method === 'GET') {
    return res.json({ mode: currentMode, denyRules: [], askRules: [], alwaysAllowRules: [] });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

function handlePermissionsMode(req, res) {
  if (req.method === 'POST') {
    const { mode } = req.body || {};
    currentMode = mode || 'default';
    return res.json({ mode: currentMode });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

// ─── Main router ─────────────────────────────────────────────

export default async function handler(req, res) {
  const route = req.query.route;

  switch (route) {
    case 'health':           return handleHealth(req, res);
    case 'dashboard':        return handleDashboard(req, res);
    case 'config':           return handleConfig(req, res);
    case 'settings':         return handleSettings(req, res);
    case 'models':           return handleModels(req, res);
    case 'tools':            return handleTools(req, res);
    case 'hooks':            return handleHooks(req, res);
    case 'permissions':      return handlePermissions(req, res);
    case 'permissions-mode': return handlePermissionsMode(req, res);
    default:
      return res.status(404).json({ error: 'Unknown system route' });
  }
}

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

import { QueryEngine } from '../engine/QueryEngine.js';
import { swarmCoordinator } from '../engine/SwarmCoordinator.js';
import { readAndClearMailbox } from '../session/mailbox.js';
import { GeminiClient } from '../api/geminiClient.js';
import { AnthropicClient } from '../api/anthropicClient.js';
import { getAllTools } from '../tools/registry.js';
import { SessionStorage } from '../session/storage.js';
import { PermissionPipeline } from '../permissions/pipeline.js';
import { HookEngine } from '../hooks/hookEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _DIR = path.join(__dirname, '../../data/');
const TMP_DIR = path.join(__dirname, '../../data/tmp');
const CONFIG_PATH = path.join(__dirname, '../../nexus.config.json');

if (!fs.existsSync(_DIR)) fs.mkdirSync(_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const upload = multer({ dest: TMP_DIR });

config(); // Load .env

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// ─── CORS ────────────────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
  credentials: corsOrigin !== '*',
}));
app.use(express.json({ limit: '50mb' }));

// ─── Core Instances ──────────────────────────────────────────

const sessionStorage = new SessionStorage(process.env.SESSION_STORAGE_PATH);
const hookEngine = new HookEngine();
const permissionPipeline = new PermissionPipeline({ mode: 'default' });

let apiClient;

async function loadApiClient() {
  // Load persisted nexus.config.json first
  let nexusConfig = {
    geminiApiKey: '',
    anthropicApiKey: '',
    defaultProvider: process.env.DEFAULT_PROVIDER || 'gemini',
    googleModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  };

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      nexusConfig = { ...nexusConfig, ...saved };
    } catch (e) {
      console.error('[NexusAI] Failed to load nexus.config.json:', e.message);
    }
  }

  // Env vars override config file if set
  if (process.env.GEMINI_API_KEY) nexusConfig.geminiApiKey = process.env.GEMINI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) nexusConfig.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.DEFAULT_PROVIDER) nexusConfig.defaultProvider = process.env.DEFAULT_PROVIDER;

  if (nexusConfig.defaultProvider === 'anthropic' && nexusConfig.anthropicApiKey) {
    apiClient = new AnthropicClient({
      apiKey: nexusConfig.anthropicApiKey,
      model: nexusConfig.anthropicModel,
    });
    console.log('[NexusAI] Provider: Anthropic');
  } else {
    apiClient = new GeminiClient({
      apiKey: nexusConfig.geminiApiKey,
      model: nexusConfig.googleModel,
    });
    console.log('[NexusAI] Provider: Gemini');
  }
}

// Global active sessions: sessionId -> QueryEngine
const activeEngines = new Map();

// Initialize
await sessionStorage.init();
await loadApiClient();

// Run SessionStart hooks
await hookEngine.run('SessionStart', { timestamp: Date.now() });

// ─── Config API ──────────────────────────────────────────────

app.get('/api/config', (req, res) => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return res.json({
      geminiApiKey: '',
      anthropicApiKey: '',
      defaultProvider: 'gemini',
      googleModel: 'gemini-2.5-flash',
      anthropicModel: 'claude-sonnet-4-20250514',
    });
  }
  try {
    const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    // Mask API keys before sending to frontend
    const masked = { ...configData };
    if (masked.geminiApiKey) masked.geminiApiKey = '••••••••' + masked.geminiApiKey.slice(-4);
    if (masked.anthropicApiKey) masked.anthropicApiKey = '••••••••' + masked.anthropicApiKey.slice(-4);
    res.json(masked);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    await loadApiClient();
    res.json({ status: 'success', provider: apiClient.constructor.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REST API ────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    name: 'NexusAI',
    apiConfigured: apiClient.isConfigured(),
    provider: apiClient.constructor.name,
    uptime: process.uptime(),
  });
});

// Get dashboard stats
app.get('/api/dashboard', async (req, res) => {
  const sessions = await sessionStorage.listSessions(100);
  const tools = getAllTools();

  let totalMessages = 0;
  let totalSize = 0;
  for (const s of sessions) {
    totalMessages += s.messageCount || 0;
    totalSize += s.size || 0;
  }

  res.json({
    stats: {
      totalSessions: sessions.length,
      activeSessions: activeEngines.size,
      totalMessages,
      totalStorageBytes: totalSize,
      totalTools: tools.length,
      totalHooks: hookEngine.getAllHooks().length,
      apiConfigured: apiClient.isConfigured(),
      uptime: Math.floor(process.uptime()),
      model: process.env.GEMINI_MODEL || process.env.ANTHROPIC_MODEL || 'gemini-2.5-flash',
    },
    recentSessions: sessions.slice(0, 5),
  });
});

// List tools
app.get('/api/tools', (req, res) => {
  const tools = getAllTools().map(t => ({
    name: t.name,
    description: t.description || '',
    isReadOnly: t.isReadOnly ? t.isReadOnly({}) : false,
    isConcurrencySafe: t.isConcurrencySafe ? t.isConcurrencySafe({}) : false,
    isEnabled: t.isEnabled ? t.isEnabled() : true,
    inputSchema: t.inputSchema || {},
  }));
  res.json({ tools });
});

// List sessions
app.get('/api/sessions', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const sessions = await sessionStorage.listSessions(limit);
  res.json({ sessions });
});

// Get session messages
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const messages = await sessionStorage.loadSession(req.params.id);
    res.json({ sessionId: req.params.id, messages });
  } catch (err) {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Delete session
app.delete('/api/sessions/:id', async (req, res) => {
  const ok = await sessionStorage.deleteSession(req.params.id);
  res.json({ deleted: ok });
});

// Get hooks
app.get('/api/hooks', (req, res) => {
  res.json({
    hooks: hookEngine.getAllHooks(),
    eventTypes: hookEngine.getEventTypes(),
  });
});

// Register hook
app.post('/api/hooks', (req, res) => {
  try {
    const id = hookEngine.register(req.body.event, req.body);
    res.json({ id, status: 'registered' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete hook
app.delete('/api/hooks/:id', (req, res) => {
  const ok = hookEngine.unregister(req.params.id);
  res.json({ deleted: ok });
});

// Get permissions
app.get('/api/permissions', (req, res) => {
  res.json(permissionPipeline.getRules());
});

// Update permission mode
app.post('/api/permissions/mode', (req, res) => {
  permissionPipeline.setMode(req.body.mode);
  res.json({ mode: req.body.mode });
});

// Get models
app.get('/api/models', (req, res) => {
  res.json({ models: apiClient.getAvailableModels() });
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json({
    apiConfigured: apiClient.isConfigured(),
    provider: apiClient.constructor.name,
    model: process.env.GEMINI_MODEL || process.env.ANTHROPIC_MODEL || 'gemini-2.5-flash',
    maxTokens: parseInt(process.env.MAX_TOKENS) || 8192,
    permissionMode: permissionPipeline.mode,
  });
});

app.post('/api/settings', async (req, res) => {
  if (req.body.maxTokens) process.env.MAX_TOKENS = String(req.body.maxTokens);
  if (req.body.permissionMode) permissionPipeline.setMode(req.body.permissionMode);

  // Update nexus.config.json if provider/model/key changes are sent
  if (req.body.geminiApiKey || req.body.anthropicApiKey || req.body.defaultProvider || req.body.model) {
    try {
      let nexusConfig = fs.existsSync(CONFIG_PATH)
        ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
        : {};

      if (req.body.geminiApiKey !== undefined) nexusConfig.geminiApiKey = req.body.geminiApiKey;
      if (req.body.anthropicApiKey !== undefined) nexusConfig.anthropicApiKey = req.body.anthropicApiKey;
      if (req.body.defaultProvider !== undefined) nexusConfig.defaultProvider = req.body.defaultProvider;
      if (req.body.model !== undefined) {
        // Route model to correct field based on provider
        if (nexusConfig.defaultProvider === 'anthropic') {
          nexusConfig.anthropicModel = req.body.model;
        } else {
          nexusConfig.googleModel = req.body.model;
        }
      }

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(nexusConfig, null, 2));
      await loadApiClient();
    } catch (e) {
      console.error('[NexusAI] Failed to save settings:', e.message);
    }
  }

  res.json({ status: 'updated', provider: apiClient.constructor.name });
});

// ───  API ──────────────────────────────────────────────────

// List 
app.get('/api/', (req, res) => {
  try {
    const  = fs.readdirSync(_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const projDir = path.join(_DIR, dirent.name);
        const stats = fs.statSync(projDir);
        let cfg = {};
        const cfgPath = path.join(projDir, 'nexus.config.json');
        if (fs.existsSync(cfgPath)) {
          try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { }
        }

        let knowledgeFiles = [];
        const knowledgeDir = path.join(projDir, 'knowledge');
        if (fs.existsSync(knowledgeDir)) {
          knowledgeFiles = fs.readdirSync(knowledgeDir);
        }

        return {
          id: dirent.name,
          name: cfg.name || dirent.name,
          description: cfg.description || '',
          systemPrompt: cfg.systemPrompt || '',
          workspacePath: cfg.workspacePath || '',
          createdAt: stats.birthtime,
          language: cfg.language || 'Agnóstico',
          path: projDir,
          knowledgeCount: knowledgeFiles.length,
        };
      });
    res.json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create project
app.post('/api/', (req, res) => {
  const { name, description, language } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const projDir = path.join(_DIR, id);

  if (fs.existsSync(projDir)) {
    return res.status(400).json({ error: 'Project already exists' });
  }

  try {
    fs.mkdirSync(projDir, { recursive: true });
    fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });

    const cfg = { name, description, language, id };
    fs.writeFileSync(path.join(projDir, 'nexus.config.json'), JSON.stringify(cfg, null, 2));

    res.json({ status: 'created', project: cfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project (Custom Instructions & Workspace)
app.put('/api//:id', (req, res) => {
  const projDir = path.join(_DIR, req.params.id);
  if (!fs.existsSync(projDir)) return res.status(404).json({ error: 'Project not found' });

  const cfgPath = path.join(projDir, 'nexus.config.json');
  let cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};

  if (req.body.systemPrompt !== undefined) cfg.systemPrompt = req.body.systemPrompt;
  if (req.body.description !== undefined) cfg.description = req.body.description;
  if (req.body.name !== undefined) cfg.name = req.body.name;
  if (req.body.workspacePath !== undefined) cfg.workspacePath = req.body.workspacePath;

  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  res.json({ status: 'updated', config: cfg });
});

// ─── Workspace API ────────────────────────────────────────────

function getWorkspaceTree(dir, rootDir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  return items.map(item => {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(rootDir, fullPath);
    const isDirectory = item.isDirectory();

    return {
      name: item.name,
      path: fullPath,
      relativePath,
      isDirectory,
      children: isDirectory ? getWorkspaceTree(fullPath, rootDir) : null,
    };
  });
}

app.get('/api//:id/workspace', (req, res) => {
  const projDir = path.join(_DIR, req.params.id);
  const cfgPath = path.join(projDir, 'nexus.config.json');
  if (!fs.existsSync(cfgPath)) return res.status(404).json({ error: 'Project not found' });

  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const wsp = cfg.workspacePath;

  if (!wsp || !fs.existsSync(wsp)) {
    return res.json({ tree: [], workspacePath: wsp, exists: false });
  }

  try {
    const tree = getWorkspaceTree(wsp, wsp);
    res.json({ tree, workspacePath: wsp, exists: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Workspace Staging System ──────────────────────────────────
const stagedChanges = new Map(); // Store: projectId -> { [filePath]: content }

app.post('/api//:id/workspace/propose', (req, res) => {
  const { id } = req.params;
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });

  if (!stagedChanges.has(id)) stagedChanges.set(id, {});
  stagedChanges.get(id)[filePath] = content;

  res.json({ status: 'proposed', path: filePath });
});

app.post('/api//:id/workspace/commit', (req, res) => {
  const { id } = req.params;
  const { filePath } = req.body;
  const taging = stagedChanges.get(id);

  if (!taging || !taging[filePath]) {
    return res.status(404).json({ error: 'No proposed changes for this file' });
  }

  try {
    const content = taging[filePath];
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, content);
    delete taging[filePath];

    res.json({ status: 'committed', path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api//:id/workspace/reject', (req, res) => {
  const { id } = req.params;
  const { filePath } = req.body;
  const taging = stagedChanges.get(id);

  if (taging && taging[filePath]) {
    delete taging[filePath];
  }
  res.json({ status: 'rejected' });
});

// Direct file write
app.post('/api//:id/workspace/file', (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });

  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content || '');
    res.json({ status: 'success', path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api//:id/workspace/file', (req, res) => {
  const { filePath } = req.body;
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    res.json({ status: 'deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload Knowledge Files
app.post('/api//:id/knowledge', upload.array('files'), (req, res) => {
  const projDir = path.join(_DIR, req.params.id);
  if (!fs.existsSync(projDir)) return res.status(404).json({ error: 'Project not found' });

  const knowledgeDir = path.join(projDir, 'knowledge');
  if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });

  const files = req.files || [];
  for (const f of files) {
    fs.renameSync(f.path, path.join(knowledgeDir, f.originalname));
  }

  res.json({ status: 'uploaded', count: files.length });
});

app.delete('/api//:id/knowledge/:filename', (req, res) => {
  const filePath = path.join(_DIR, req.params.id, 'knowledge', req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ status: 'deleted' });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ─── WebSocket — Real-time Chat ──────────────────────────────────

wss.on('connection', (ws) => {
  let currentSessionId = null;
  let currentEngine = null;
  let swarmPollTimer = null;

  function cleanup() {
    if (swarmPollTimer) clearInterval(swarmPollTimer);
    if (currentEngine) currentEngine.abort();
    if (currentSessionId) activeEngines.delete(currentSessionId);
  }

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    console.error('[WS] Connection error:', err.message);
    cleanup();
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);

      // Lazy init swarm poller
      if (!swarmPollTimer) {
        swarmPollTimer = setInterval(async () => {
          if (!currentSessionId) return;
          const team = swarmCoordinator.findTeamByLeaderSession(currentSessionId);
          if (!team) return;

          const messages = await readAndClearMailbox(team.name, currentSessionId);
          for (const inboxMsg of messages) {
            ws.send(JSON.stringify({
              type: 'swarm_event',
              agent: inboxMsg.from,
              content: inboxMsg.content,
            }));

            if (currentEngine && !currentEngine.isRunning) {
              const autoPrompt = `[System: Swarm agent ${inboxMsg.from} reports]: ${inboxMsg.content}`;
              const stream = currentEngine.submitMessage(autoPrompt, { maxTurns: 5 });
              try {
                for await (const event of stream) {
                  if (event.type === 'stream_event') {
                    ws.send(JSON.stringify({ type: 'stream', text: event.text }));
                  } else if (event.type === 'assistant') {
                    ws.send(JSON.stringify({
                      type: 'assistant', content: event.content, toolCalls: event.toolCalls, uuid: event.uuid,
                    }));
                  }
                }
              } catch (e) {
                console.error('[WS] Swarm auto-response error:', e.message);
              }
            }
          }
        }, 2000);
      }

      switch (msg.type) {
        case 'chat': {
          if (!currentSessionId || msg.newSession) {
            currentSessionId = msg.sessionId || uuidv4();
          }

          const tools = getAllTools();
          currentEngine = new QueryEngine({
            sessionId: currentSessionId,
            projectId: msg.projectId,
            apiClient,
            tools,
            model: msg.model || process.env.GEMINI_MODEL || process.env.ANTHROPIC_MODEL || 'gemini-2.5-flash',
            maxTokens: parseInt(process.env.MAX_TOKENS) || 8192,
            sessionStorage,
            permissionPipeline,
            hooks: {
              PreToolUse: hookEngine.getHooksForEvent('PreToolUse')
                .filter(h => h.enabled && h.handler)
                .map(h => h.handler),
              PostToolUse: hookEngine.getHooksForEvent('PostToolUse')
                .filter(h => h.enabled && h.handler)
                .map(h => h.handler),
            },
            initialMessages: msg.resumeSession
              ? await sessionStorage.loadSession(currentSessionId)
              : [],
          });

          activeEngines.set(currentSessionId, currentEngine);

          await hookEngine.run('UserPromptSubmit', { prompt: msg.content, sessionId: currentSessionId });

          ws.send(JSON.stringify({ type: 'session', sessionId: currentSessionId }));

          try {
            for await (const event of currentEngine.submitMessage(msg.content)) {
              if (ws.readyState !== ws.OPEN) break;

              switch (event.type) {
                case 'stream_event':
                  ws.send(JSON.stringify({ type: 'stream', text: event.text }));
                  break;
                case 'assistant':
                  ws.send(JSON.stringify({
                    type: 'assistant',
                    content: event.content,
                    toolCalls: event.toolCalls,
                    uuid: event.uuid,
                  }));
                  break;
                case 'tool_use':
                  ws.send(JSON.stringify({ type: 'tool_use', toolName: event.toolName, toolInput: event.toolInput }));
                  break;
                case 'status_update':
                  ws.send(JSON.stringify({ type: 'status', message: event.message, toolName: event.toolName, timestamp: event.timestamp }));
                  break;
                case 'tool_result':
                  ws.send(JSON.stringify({ type: 'tool_result', toolName: event.toolName, content: event.content, isError: event.isError }));
                  break;
                case 'tool_propose':
                  ws.send(JSON.stringify({ type: 'tool_propose', toolName: event.toolName, toolUseId: event.toolUseId, path: event.path, proposal: event.proposal, original: event.original }));
                  break;
                case 'quota_warning':
                  ws.send(JSON.stringify({ type: 'quota_warning', message: event.message }));
                  break;
                case 'usage':
                  ws.send(JSON.stringify({ type: 'usage', usage: { inputTokens: event.input_tokens, outputTokens: event.output_tokens } }));
                  break;
                case 'error':
                  ws.send(JSON.stringify({ type: 'error', message: event.message }));
                  break;
                case 'result':
                  ws.send(JSON.stringify({ type: 'result', subtype: event.subtype, text: event.text, usage: event.usage, cost: event.cost, turnCount: event.turnCount, error: event.error }));
                  break;
              }
            }
          } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message || 'Unknown error' }));
          }

          ws.send(JSON.stringify({ type: 'done' }));
          break;
        }

        case 'abort': {
          if (currentEngine) {
            currentEngine.abort();
            ws.send(JSON.stringify({ type: 'aborted' }));
          }
          break;
        }

        case 'resume': {
          currentSessionId = msg.sessionId;
          const messages = await sessionStorage.loadSession(msg.sessionId);
          ws.send(JSON.stringify({
            type: 'session_resumed',
            sessionId: msg.sessionId,
            messages: messages.filter(m => m.role === 'user' || m.role === 'assistant'),
          }));
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.warn('[WS] Unknown message type:', msg.type);
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });
});

// ─── Vercel Serverless Simulator (for local dev) ────────────
app.all('/api/*', async (req, res, next) => {
  try {
    // Exclude paths already handled by Express
    const handledRoutes = ['/api/config', '/api/keys', '/api/', '/api/sessions', '/api/chat'];
    if (handledRoutes.some(r => req.path.startsWith(r))) return next();

    // Map /api/admin/users -> ../../api/admin/users.js
    const pathParts = req.path.split('?')[0].replace('/api/', '').split('/');
    const handlerPath = path.join(__dirname, '../../api', ...pathParts) + '.js';

    if (fs.existsSync(handlerPath)) {
      const module = await import(`file://${handlerPath}?update=${Date.now()}`);
      if (module.default) {
        return await module.default(req, res);
      }
    }
    next();
  } catch (err) {
    console.error(`[Serverless Simulator] Error executing ${req.path}:`, err);
    res.status(500).json({ error: 'Local serverless simulation failed' });
  }
});

// ─── Start Server ────────────────────────────────────────────

const PORT = process.env.PORT || 3777;
server.listen(PORT, () => {
  const isConfigured = apiClient.isConfigured();
  const providerName = apiClient.constructor.name.replace('Client', '');
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗         ║
║     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝         ║
║     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗         ║
║     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║         ║
║     ██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║         ║
║     ╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝╚══════╝         ║
║                     AI Platform v1.0                      ║
║                                                          ║
║     🌐  Panel:    http://localhost:5173                   ║
║     ⚡  API:      http://localhost:${PORT}                   ║
║     🔌  WS:       ws://localhost:${PORT}/ws                  ║
║     🤖  Provider: ${providerName.padEnd(38)}║
║     🔑  API Key:  ${(isConfigured ? 'Configured ✅' : 'Not configured — Demo Mode ⚠️').padEnd(38)}║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

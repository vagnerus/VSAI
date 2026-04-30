import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config(); // Load .env

const app = express();
const server = createServer(app);

// ─── CORS & Body Parsing ─────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
  credentials: corsOrigin !== '*',
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Static Files (Production) ───────────────────────────────
const distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  console.log('[Server] Serving static files from dist/');
}

// ─── Health Check (Direct) ───────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()) });
});

// ─── AI Manager Health ───────────────────────────────────────
app.get('/api/ai-health', async (req, res) => {
  try {
    const { aiManager } = await import('../engine/AIManager.js');
    res.status(200).json(aiManager.getHealthReport());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Vercel Serverless Simulator (for local dev) ────────────
// This ensures local development perfectly matches Vercel production by routing ALL /api/* requests to the /api directory.
app.all('/api/*', async (req, res, next) => {
  try {
    // Map /api/auth?action=login -> ../../api/auth.js
    // Map /api/admin/users -> ../../api/admin.js
    const pathParts = req.path.split('?')[0].replace('/api/', '').split('/');
    
    // We try to match the exact file first (e.g. /api/auth.js)
    let handlerPath = path.join(__dirname, '../../api', `${pathParts[0]}.js`);
    
    // If not found, check if it's a sub-route handled by a main controller
    if (!fs.existsSync(handlerPath) && pathParts.length > 1) {
      handlerPath = path.join(__dirname, '../../api', `${pathParts[0]}/${pathParts[1]}.js`);
    }

    if (fs.existsSync(handlerPath)) {
      // Simulate Vercel environment by passing req/res directly
      const module = await import(`file://${handlerPath}?update=${Date.now()}`);
      if (module.default) {
        return await module.default(req, res);
      }
    } else {
      console.warn(`[Local Server] Route not found: ${req.path} (Looked for ${handlerPath})`);
      return res.status(404).json({ error: 'API route not found locally' });
    }
  } catch (err) {
    console.error(`[Serverless Simulator] Error executing ${req.path}:`, err);
    res.status(500).json({ error: 'Local serverless simulation failed', details: err.message });
  }
});

// ─── SPA Fallback (Production) ───────────────────────────────
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ─── Graceful Shutdown ───────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 3777;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗         ║
║     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝         ║
║     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗         ║
║     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║         ║
║     ██║ ╚████║███████╗██╔╝ ╚██╗╚██████╔╝███████║         ║
║     ╚═╝  ╚═══╝╚══════╝╚═╝   ╚═╝ ╚═════╝╚══════╝         ║
║            NexusAI Enterprise API Simulator              ║
║                                                          ║
║     🌐  Frontend: http://localhost:5173                  ║
║     ⚡  API:      http://localhost:${PORT}/api                  ║
║     🏥  Health:   http://localhost:${PORT}/health               ║
║     🧠  AI:       http://localhost:${PORT}/api/ai-health        ║
║     🗄️  Database: PostgreSQL (P4Admin)                    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

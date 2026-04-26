import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// No Vercel, usamos /tmp para cache ou desativamos se falhar
let CACHE_DIR = path.join(__dirname, '../../data/cache');
let cacheEnabled = true;

try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('[SemanticCache] Falha ao criar diretório local, tentando /tmp:', e.message);
  CACHE_DIR = path.join(os.tmpdir(), 'nexus-cache');
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (e2) {
    console.error('[SemanticCache] Falha crítica ao criar diretório de cache:', e2.message);
    cacheEnabled = false;
  }
}

class SemanticCache {
  constructor(ttl = 3600 * 24) { // Padrão: 24 horas
    this.ttl = ttl;
  }

  _generateKey(messages, systemPrompt) {
    // Cria um hash baseado no prompt do sistema e nas últimas mensagens
    const content = JSON.stringify({
      system: systemPrompt,
      messages: messages.slice(-3).map(m => ({ role: m.role, content: m.content }))
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  get(messages, systemPrompt) {
    if (!cacheEnabled) return null;
    const key = this._generateKey(messages, systemPrompt);
    const cachePath = path.join(CACHE_DIR, `${key}.json`);

    if (fs.existsSync(cachePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const now = Math.floor(Date.now() / 1000);
        
        if (now - data.timestamp < this.ttl) {
          console.log(`[SemanticCache] Hit for key: ${key.substring(0, 8)}`);
          return data.response;
        } else {
          // Expired
          try { fs.unlinkSync(cachePath); } catch {}
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  set(messages, systemPrompt, response) {
    if (!cacheEnabled) return;
    const key = this._generateKey(messages, systemPrompt);
    const cachePath = path.join(CACHE_DIR, `${key}.json`);

    try {
      const data = {
        timestamp: Math.floor(Date.now() / 1000),
        response
      };
      fs.writeFileSync(cachePath, JSON.stringify(data), 'utf8');
      console.log(`[SemanticCache] Saved key: ${key.substring(0, 8)}`);
    } catch (e) {
      // Ignora erro de gravação silenciosamente
    }
  }
}

export const semanticCache = new SemanticCache();

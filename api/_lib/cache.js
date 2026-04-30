/**
 * SemanticCache — Caches AI responses based on conversation context hash.
 *
 * B13 Fix: Removed race condition (existsSync + readFileSync → try/catch atomic read).
 * Added: In-memory LRU cache to reduce filesystem I/O.
 * Added: Max entries enforcement and automatic eviction.
 */

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

const MAX_MEMORY_ENTRIES = 200;
const MAX_DISK_ENTRIES = 1000;

class SemanticCache {
  constructor(ttl = 3600 * 24) { // Padrão: 24 horas
    this.ttl = ttl;
    this.memoryCache = new Map(); // In-memory LRU
    this.accessOrder = []; // LRU tracking
  }

  _generateKey(messages, systemPrompt) {
    // Cria um hash baseado no prompt do sistema e nas últimas mensagens
    const content = JSON.stringify({
      system: systemPrompt,
      messages: (messages || []).slice(-3).map(m => ({ role: m.role, content: m.content }))
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get a cached response.
   * B13 Fix: Uses try/catch for atomic read instead of existsSync + readFileSync.
   */
  get(messages, systemPrompt) {
    if (!cacheEnabled) return null;
    const key = this._generateKey(messages, systemPrompt);
    const now = Math.floor(Date.now() / 1000);

    // 1. Check in-memory LRU first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (now - entry.timestamp < this.ttl) {
        this._touchLRU(key);
        console.log(`[SemanticCache] Memory hit: ${key.substring(0, 8)}`);
        return entry.response;
      }
      // Expired — remove from memory
      this.memoryCache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    // 2. Check disk
    const cachePath = path.join(CACHE_DIR, `${key}.json`);
    try {
      const raw = fs.readFileSync(cachePath, 'utf8');
      const data = JSON.parse(raw);

      if (now - data.timestamp < this.ttl) {
        // Promote to memory cache
        this._setMemory(key, data);
        console.log(`[SemanticCache] Disk hit: ${key.substring(0, 8)}`);
        return data.response;
      }

      // Expired — try to remove (non-blocking)
      try { fs.unlinkSync(cachePath); } catch { /* ignore */ }
    } catch (e) {
      // File doesn't exist or is corrupt — not an error
    }

    return null;
  }

  /**
   * Store a response in cache (memory + disk).
   */
  set(messages, systemPrompt, response) {
    if (!cacheEnabled || !response) return;
    const key = this._generateKey(messages, systemPrompt);

    const data = {
      timestamp: Math.floor(Date.now() / 1000),
      response
    };

    // Store in memory
    this._setMemory(key, data);

    // Store on disk (non-blocking)
    const cachePath = path.join(CACHE_DIR, `${key}.json`);
    try {
      fs.writeFileSync(cachePath, JSON.stringify(data), 'utf8');
      console.log(`[SemanticCache] Saved: ${key.substring(0, 8)}`);
    } catch (e) {
      // Ignore write errors silently (e.g., read-only filesystem)
    }

    // Periodic disk cleanup
    this._evictDiskIfNeeded();
  }

  /**
   * In-memory LRU helpers
   */
  _setMemory(key, data) {
    if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      // Evict oldest entry
      const oldest = this.accessOrder.shift();
      if (oldest) this.memoryCache.delete(oldest);
    }
    this.memoryCache.set(key, data);
    this._touchLRU(key);
  }

  _touchLRU(key) {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }

  /**
   * Evict expired entries from disk if too many files.
   */
  _evictDiskIfNeeded() {
    try {
      const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
      if (files.length <= MAX_DISK_ENTRIES) return;

      const now = Math.floor(Date.now() / 1000);
      let evicted = 0;

      for (const file of files) {
        if (evicted >= files.length - MAX_DISK_ENTRIES) break;
        const filePath = path.join(CACHE_DIR, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(raw);
          if (now - data.timestamp >= this.ttl) {
            fs.unlinkSync(filePath);
            evicted++;
          }
        } catch {
          // Corrupt file — delete it
          try { fs.unlinkSync(filePath); evicted++; } catch { /* ignore */ }
        }
      }

      if (evicted > 0) {
        console.log(`[SemanticCache] Evicted ${evicted} expired entries from disk.`);
      }
    } catch {
      // Directory read failed — skip cleanup
    }
  }

  /**
   * Clear all cache (memory + disk).
   */
  clear() {
    this.memoryCache.clear();
    this.accessOrder = [];
    try {
      const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try { fs.unlinkSync(path.join(CACHE_DIR, file)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
}

export const semanticCache = new SemanticCache();

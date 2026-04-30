/**
 * SemanticCache — Caches AI responses based on conversation context hash.
 * Migrated to PostgreSQL to support distributed Vercel environments.
 */

import crypto from 'crypto';
import { query } from './db.js';

class SemanticCache {
  constructor(ttlSeconds = 3600 * 24) { // Padrão: 24 horas
    this.ttlSeconds = ttlSeconds;
    this.initialized = false;
  }

  async _init() {
    if (this.initialized) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS query_cache (
          hash VARCHAR(64) PRIMARY KEY,
          prompt JSONB NOT NULL,
          response TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      // Cleanup de caches antigos em background
      query(`DELETE FROM query_cache WHERE created_at < NOW() - INTERVAL '${this.ttlSeconds} seconds'`).catch(() => {});
      
      this.initialized = true;
    } catch (e) {
      console.warn('[SemanticCache] Falha ao inicializar tabela:', e.message);
    }
  }

  _generateKey(messages, systemPrompt) {
    const content = JSON.stringify({
      system: systemPrompt,
      messages: (messages || []).slice(-3).map(m => ({ role: m.role, content: m.content }))
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get a cached response asynchronously.
   */
  async get(messages, systemPrompt) {
    await this._init();
    try {
      const hash = this._generateKey(messages, systemPrompt);
      const res = await query('SELECT response FROM query_cache WHERE hash = $1 AND created_at >= NOW() - INTERVAL \'$2 seconds\'', [hash, this.ttlSeconds]);
      
      if (res.rows.length > 0) {
        console.log('[SemanticCache] 🟢 Cache Hit (PostgreSQL):', hash);
        return res.rows[0].response;
      }
      return null;
    } catch (e) {
      console.error('[SemanticCache] Erro de leitura DB:', e.message);
      return null;
    }
  }

  /**
   * Set a cached response asynchronously.
   */
  async set(messages, systemPrompt, responseText) {
    await this._init();
    if (!responseText || responseText.length < 10) return; // Não faz cache de respostas vazias ou minúsculas

    try {
      const hash = this._generateKey(messages, systemPrompt);
      const promptData = JSON.stringify({
        system: systemPrompt,
        messages: (messages || []).slice(-3).map(m => ({ role: m.role, content: m.content }))
      });
      
      await query(`
        INSERT INTO query_cache (hash, prompt, response, created_at) 
        VALUES ($1, $2, $3, NOW()) 
        ON CONFLICT (hash) DO UPDATE SET response = $3, created_at = NOW()
      `, [hash, promptData, responseText]);
      
      console.log('[SemanticCache] 💾 Cache Saved (PostgreSQL):', hash);
    } catch (e) {
      console.error('[SemanticCache] Erro ao salvar no DB:', e.message);
    }
  }
}

export const semanticCache = new SemanticCache();

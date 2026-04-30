import { config } from 'dotenv';
import { GeminiClient } from '../../src/api/geminiClient.js';
import { AnthropicClient } from '../../src/api/anthropicClient.js';
import { OpenAIClient } from '../../src/api/openaiClient.js';
import { OllamaClient } from '../../src/api/ollamaClient.js';

import { query } from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../nexus.config.json');

class GatewayClient {
  constructor(primary, fallback) {
    this.primary = primary;
    this.fallback = fallback;
    // Fixamos o nome do construtor original para manter compatibilidade com o frontend
    this.constructorName = primary.constructor.name;
  }

  isConfigured() {
    return this.primary.isConfigured() || (this.fallback && this.fallback.isConfigured());
  }

  getAvailableModels() {
    let models = this.primary.getAvailableModels();
    if (this.fallback) {
      // Evita modelos duplicados
      const existingIds = new Set(models.map(m => m.id));
      const fallbackModels = this.fallback.getAvailableModels().filter(m => !existingIds.has(m.id));
      models = [...models, ...fallbackModels];
    }
    return models;
  }

  async *stream(params) {
    let primaryError = null;
    try {
      yield* this.primary.stream(params);
    } catch (error) {
      primaryError = error;
      console.warn(`[Gateway] Primary API (${this.constructorName}) failed: ${error.message}`);
      
      if (this.fallback && this.fallback.isConfigured()) {
        console.log(`[Gateway] Switching to fallback API (${this.fallback.constructor.name})...`);
        yield { 
          type: 'content_block_delta', 
          delta: { type: 'text_delta', text: '\n\n> ⚠️ *Nota: O provedor primário falhou ou está indisponível. Alternando automaticamente para o provedor reserva...*\n\n' } 
        };
        
        try {
          yield* this.fallback.stream(params);
        } catch (fallbackError) {
          console.error(`[Gateway] Fallback API also failed: ${fallbackError.message}`);
          yield { 
            type: 'content_block_delta', 
            delta: { type: 'text_delta', text: `\n\n> ❌ **Erro Crítico:** O provedor reserva também falhou ao tentar responder. Detalhes: ${fallbackError.message}\n\n` } 
          };
          throw fallbackError;
        }
      } else {
        yield { 
          type: 'content_block_delta', 
          delta: { type: 'text_delta', text: `\n\n> ❌ **Erro:** O provedor primário falhou (${error.message}) e não há provedor reserva configurado.\n\n` } 
        };
        throw error;
      }
    }
  }
}

export async function getApiClient(requestedProvider, userId = null) {
  let cfg = {
    geminiApiKey: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    ollamaHost: '',
    defaultProvider: 'gemini',
    googleModel: 'gemini-2.5-flash',
    anthropicModel: 'claude-3-5-sonnet-20240620',
    openaiModel: 'gpt-4o',
    ollamaModel: 'llama3:8b',
  };

  try {
    // 1. Fallback Global (system_settings)
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id VARCHAR(50) PRIMARY KEY,
        config JSONB NOT NULL
      )
    `);
    const sysRes = await query('SELECT config FROM system_settings WHERE id = $1', ['main']);
    if (sysRes.rows.length > 0) {
      cfg = { ...cfg, ...sysRes.rows[0].config };
    }

    // 2. ENV VARS (Vercel) - Aplicado ANTES do Personal Config para servir de fallback global real
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      cfg.geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) cfg.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (process.env.OPENAI_API_KEY) cfg.openaiApiKey = process.env.OPENAI_API_KEY;
    if (process.env.OLLAMA_HOST) cfg.ollamaHost = process.env.OLLAMA_HOST;
    if (process.env.DEFAULT_PROVIDER) cfg.defaultProvider = process.env.DEFAULT_PROVIDER;
    if (process.env.GEMINI_MODEL) cfg.googleModel = process.env.GEMINI_MODEL;
    if (process.env.OLLAMA_MODEL) cfg.ollamaModel = process.env.OLLAMA_MODEL;

    // 3. Personal Config (profiles) - Tem PRIORIDADE MAXIMA
    if (userId) {
      const userRes = await query('SELECT config FROM profiles WHERE id = $1', [userId]);
      if (userRes.rows.length > 0 && userRes.rows[0].config) {
        const userCfg = userRes.rows[0].config;
        if (userCfg.geminiApiKey) cfg.geminiApiKey = userCfg.geminiApiKey;
        if (userCfg.anthropicApiKey) cfg.anthropicApiKey = userCfg.anthropicApiKey;
        if (userCfg.openaiApiKey) cfg.openaiApiKey = userCfg.openaiApiKey;
        if (userCfg.defaultProvider) cfg.defaultProvider = userCfg.defaultProvider;
      }
    }
  } catch (err) {
    console.warn('[DB_CONFIG_WARN] Failed to load config from DB:', err.message);
  }

  const clients = {
    gemini: new GeminiClient({ apiKey: cfg.geminiApiKey, model: cfg.googleModel }),
    anthropic: new AnthropicClient({ apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel }),
    openai: new OpenAIClient({ apiKey: cfg.openaiApiKey, model: cfg.openaiModel }),
    local: new OllamaClient({ host: cfg.ollamaHost, model: cfg.ollamaModel })
  };

  // Roteamento Dinâmico: O provedor pedido é o Primário. O padrão vira Fallback.
  const primaryKey = requestedProvider || cfg.defaultProvider;
  const primary = clients[primaryKey] || clients.gemini;
  
  // Escolhe um fallback diferente do primário que esteja configurado
  const fallbackKey = Object.keys(clients).find(k => k !== primaryKey && clients[k].isConfigured());
  const fallback = fallbackKey ? clients[fallbackKey] : null;

  return new GatewayClient(primary, fallback);
}

export function resetClient() {}

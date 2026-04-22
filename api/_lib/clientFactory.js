import { config } from 'dotenv';
import { GeminiClient } from '../../src/api/geminiClient.js';
import { AnthropicClient } from '../../src/api/anthropicClient.js';
import { OpenAIClient } from '../../src/api/openaiClient.js';
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
    try {
      yield* this.primary.stream(params);
    } catch (error) {
      console.warn(`[Gateway] Primary API (${this.primary.constructor.name}) failed: ${error.message}`);
      
      if (this.fallback && this.fallback.isConfigured()) {
        console.log(`[Gateway] Switching to fallback API (${this.fallback.constructor.name})...`);
        // Adiciona um aviso sutil na resposta para o usuário saber do fallback
        yield { 
          type: 'content_block_delta', 
          delta: { type: 'text_delta', text: '\n\n> ⚠️ *Nota: O provedor primário falhou ou está indisponível. Alternando automaticamente para o provedor reserva...*\n\n' } 
        };
        yield* this.fallback.stream(params);
      } else {
        throw error;
      }
    }
  }
}

export function getApiClient(requestedProvider) {
  let cfg = {
    geminiApiKey: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    defaultProvider: 'gemini',
    googleModel: 'gemini-2.5-flash',
    anthropicModel: 'claude-3-5-sonnet-20240620',
    openaiModel: 'gpt-4o',
  };

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg = { ...cfg, ...saved };
    } catch {}
  }

  // ENV VARS sempre tem prioridade (Vercel)
  if (process.env.GEMINI_API_KEY) cfg.geminiApiKey = process.env.GEMINI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) cfg.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.OPENAI_API_KEY) cfg.openaiApiKey = process.env.OPENAI_API_KEY;
  if (process.env.DEFAULT_PROVIDER) cfg.defaultProvider = process.env.DEFAULT_PROVIDER;

  const clients = {
    google: new GeminiClient({ apiKey: cfg.geminiApiKey, model: cfg.googleModel }),
    anthropic: new AnthropicClient({ apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel }),
    openai: new OpenAIClient({ apiKey: cfg.openaiApiKey, model: cfg.openaiModel })
  };

  // Roteamento Dinâmico: O provedor pedido é o Primário. O padrão vira Fallback.
  const primaryKey = requestedProvider || cfg.defaultProvider;
  const primary = clients[primaryKey] || clients.google;
  
  // Escolhe um fallback diferente do primário que esteja configurado
  const fallbackKey = Object.keys(clients).find(k => k !== primaryKey && clients[k].isConfigured());
  const fallback = fallbackKey ? clients[fallbackKey] : null;

  return new GatewayClient(primary, fallback);
}

export function resetClient() {}

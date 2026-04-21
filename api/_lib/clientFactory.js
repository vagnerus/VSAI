import { config } from 'dotenv';
import { GeminiClient } from '../../src/api/geminiClient.js';
import { AnthropicClient } from '../../src/api/anthropicClient.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../../nexus.config.json');

export function getApiClient() {
  // Começa com defaults do config file (se existir)
  let cfg = {
    geminiApiKey: '',
    anthropicApiKey: '',
    defaultProvider: 'gemini',
    googleModel: 'gemini-2.5-flash',
    anthropicModel: 'claude-sonnet-4-20250514',
  };

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg = { ...cfg, ...saved };
    } catch {}
  }

  // ENV VARS sempre tem prioridade (essencial no Vercel onde filesystem é read-only)
  if (process.env.GEMINI_API_KEY) cfg.geminiApiKey = process.env.GEMINI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) cfg.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (process.env.DEFAULT_PROVIDER) cfg.defaultProvider = process.env.DEFAULT_PROVIDER;
  if (process.env.GEMINI_MODEL) cfg.googleModel = process.env.GEMINI_MODEL;
  if (process.env.ANTHROPIC_MODEL) cfg.anthropicModel = process.env.ANTHROPIC_MODEL;

  if (cfg.defaultProvider === 'anthropic' && cfg.anthropicApiKey) {
    return new AnthropicClient({ apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel });
  }
  return new GeminiClient({ apiKey: cfg.geminiApiKey, model: cfg.googleModel });
}

export function resetClient() {
  // No-op on Vercel (each invocation is a fresh start)
}

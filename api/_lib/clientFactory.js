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

let _client = null;

export function getApiClient() {
  if (_client) return _client;

  let cfg = {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    defaultProvider: process.env.DEFAULT_PROVIDER || 'gemini',
    googleModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  };

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg = { ...cfg, ...saved };
    } catch {}
  }

  if (cfg.defaultProvider === 'anthropic' && cfg.anthropicApiKey) {
    _client = new AnthropicClient({ apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel });
  } else {
    _client = new GeminiClient({ apiKey: cfg.geminiApiKey, model: cfg.googleModel });
  }

  return _client;
}

export function resetClient() {
  _client = null;
}

import { config } from 'dotenv';
import { getApiClient, resetClient } from './_lib/clientFactory.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../nexus.config.json');

export default function handler(req, res) {
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

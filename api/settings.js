import { getApiClient } from './_lib/clientFactory.js';

export default function handler(req, res) {
  const apiClient = getApiClient();

  if (req.method === 'GET') {
    return res.json({
      apiConfigured: apiClient.isConfigured(),
      provider: apiClient.constructor.name,
      model: process.env.GEMINI_MODEL || process.env.ANTHROPIC_MODEL || 'gemini-2.5-flash',
      maxTokens: parseInt(process.env.MAX_TOKENS) || 8192,
      permissionMode: 'default',
    });
  }

  if (req.method === 'POST') {
    return res.json({ status: 'updated', note: 'No Vercel, altere as configurações nas Environment Variables do painel Vercel.' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

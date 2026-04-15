import { getApiClient } from './_lib/clientFactory.js';
import { getAllTools } from '../src/tools/registry.js';

export default function handler(req, res) {
  const apiClient = getApiClient();
  const tools = getAllTools();

  res.json({
    stats: {
      totalSessions: 0,
      activeSessions: 0,
      totalMessages: 0,
      totalStorageBytes: 0,
      totalTools: tools.length,
      totalHooks: 0,
      apiConfigured: apiClient.isConfigured(),
      uptime: 0,
      model: process.env.GEMINI_MODEL || process.env.ANTHROPIC_MODEL || 'gemini-2.5-flash',
      provider: apiClient.constructor.name,
    },
    recentSessions: [],
  });
}

import { getApiClient } from './_lib/clientFactory.js';

export default function handler(req, res) {
  const apiClient = getApiClient();
  res.json({
    status: 'ok',
    version: '1.0.0',
    name: 'NexusAI',
    apiConfigured: apiClient.isConfigured(),
    provider: apiClient.constructor.name,
  });
}

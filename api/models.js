import { getApiClient } from './_lib/clientFactory.js';

export default function handler(req, res) {
  const apiClient = getApiClient();
  res.json({ models: apiClient.getAvailableModels() });
}

import { query } from './_lib/db.js';
import { getApiClient } from './_lib/clientFactory.js';

export default async function handler(req, res) {
  const debug = {
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      nodeVersion: process.version,
    },
    database: 'Checking...',
    gemini: 'Checking...',
  };

  try {
    const { rows } = await query('SELECT NOW() as now');
    debug.database = `OK: ${rows[0].now}`;
  } catch (e) {
    debug.database = `ERROR: ${e.message}`;
  }

  try {
    const client = getApiClient('google');
    const isConfig = client.isConfigured();
    debug.gemini = isConfig ? 'Configured' : 'NOT Configured';
    
    if (isConfig) {
       // Optional: try a very small call
       // const stream = client.stream({ messages: [{role: 'user', content: 'hi'}] });
       // ...
    }
  } catch (e) {
    debug.gemini = `ERROR: ${e.message}`;
  }

  res.status(200).json(debug);
}

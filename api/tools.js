import { getAllTools } from '../src/tools/registry.js';

export default function handler(req, res) {
  const tools = getAllTools().map(t => ({
    name: t.name,
    description: t.description || '',
    isReadOnly: t.isReadOnly ? t.isReadOnly({}) : false,
    isConcurrencySafe: t.isConcurrencySafe ? t.isConcurrencySafe({}) : false,
    isEnabled: t.isEnabled ? t.isEnabled() : true,
    inputSchema: t.inputSchema || {},
  }));
  res.json({ tools });
}

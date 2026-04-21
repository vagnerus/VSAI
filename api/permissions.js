let currentMode = 'default';

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({
      mode: currentMode,
      denyRules: [],
      askRules: [],
      alwaysAllowRules: [],
    });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

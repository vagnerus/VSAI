export default function handler(req, res) {
  if (req.method === 'POST') {
    const { mode } = req.body || {};
    return res.json({ mode: mode || 'default' });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

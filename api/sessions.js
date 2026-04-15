export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ sessions: [] });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

export default function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    return res.json({ sessionId: id, messages: [] });
  }
  if (req.method === 'DELETE') {
    return res.json({ deleted: false, note: 'Sessions não persistem no Vercel' });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

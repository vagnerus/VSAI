export default function handler(req, res) {
  if (req.method === 'POST') {
    return res.json({ status: 'uploaded', count: 0, note: 'Upload não disponível no Vercel' });
  }
  res.status(405).json({ error: 'Method not allowed' });
}

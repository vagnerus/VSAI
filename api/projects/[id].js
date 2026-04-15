export default function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    return res.json({ id, name: id, systemPrompt: '', workspacePath: '', knowledgeCount: 0 });
  }

  if (req.method === 'PUT') {
    return res.json({ status: 'updated', config: req.body || {} });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

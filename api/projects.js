// In-memory store (resets on each cold start — ok for Vercel demo)
let projects = [];

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ projects });
  }

  if (req.method === 'POST') {
    const { name, description, language } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (projects.find(p => p.id === id)) {
      return res.status(400).json({ error: 'Project already exists' });
    }

    const project = {
      id,
      name,
      description: description || '',
      language: language || 'Agnóstico',
      systemPrompt: '',
      workspacePath: '',
      createdAt: new Date().toISOString(),
      knowledgeCount: 0,
    };

    projects.push(project);
    return res.json({ status: 'created', project });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

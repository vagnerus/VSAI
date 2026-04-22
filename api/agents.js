import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = req.query.id || url.pathname.split('/').pop();

  if (req.method === 'GET') {
    try {
      if (id && id !== 'agents') {
        const { rows } = await query('SELECT * FROM agents WHERE id = $1 AND (user_id = $2 OR is_public = true)', [id, auth.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Agente não encontrado' });
        return res.status(200).json(rows[0]);
      } else {
        const { rows } = await query('SELECT * FROM agents WHERE user_id = $1 OR is_public = true ORDER BY created_at DESC', [auth.user.id]);
        return res.status(200).json(rows);
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, system_prompt, model, icon } = req.body;
      if (!name || !system_prompt) return res.status(400).json({ error: 'Nome e Prompt são obrigatórios' });
      
      const { rows } = await query(
        'INSERT INTO agents (user_id, name, description, system_prompt, model, icon) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [auth.user.id, name, description, system_prompt, model || 'gemini-2.5-flash', icon || '🤖']
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      if (!id) return res.status(400).json({ error: 'ID é obrigatório' });
      const { rowCount } = await query('DELETE FROM agents WHERE id = $1 AND user_id = $2', [id, auth.user.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Agente não encontrado' });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

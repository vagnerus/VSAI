import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = req.query.id || url.pathname.split('/').pop();

  // Ensure advanced columns exist
  await query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS system_prompt TEXT').catch(() => {});
  await query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_path TEXT').catch(() => {});
  await query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7').catch(() => {});
  await query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS model_name VARCHAR(100)').catch(() => {});
  await query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS knowledge_count INTEGER DEFAULT 0').catch(() => {});

  if (req.method === 'GET') {
    try {
      if (id && id !== 'projects') {
        const { rows } = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [id, auth.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
        return res.status(200).json(rows[0]);
      } else {
        const { rows } = await query('SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC', [auth.user.id]);
        return res.status(200).json(rows);
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, description, language } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
      
      const { rows } = await query(
        'INSERT INTO projects (user_id, name, description, language) VALUES ($1, $2, $3, $4) RETURNING *',
        [auth.user.id, name, description, language || 'Agnóstico']
      );
      return res.status(201).json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { name, description, language, systemPrompt, workspacePath, temperature, model_name } = req.body;
      if (!id) return res.status(400).json({ error: 'ID do projeto é obrigatório' });
      
      let updateQuery = 'UPDATE projects SET updated_at = NOW()';
      let params = [];
      let i = 1;

      if (name) { updateQuery += `, name = $${i++}`; params.push(name); }
      if (description !== undefined) { updateQuery += `, description = $${i++}`; params.push(description); }
      if (language) { updateQuery += `, language = $${i++}`; params.push(language); }
      if (systemPrompt !== undefined) { updateQuery += `, system_prompt = $${i++}`; params.push(systemPrompt); }
      if (workspacePath !== undefined) { updateQuery += `, workspace_path = $${i++}`; params.push(workspacePath); }
      if (temperature !== undefined) { updateQuery += `, temperature = $${i++}`; params.push(parseFloat(temperature)); }
      if (model_name) { updateQuery += `, model_name = $${i++}`; params.push(model_name); }

      updateQuery += ` WHERE id = $${i++} AND user_id = $${i++} RETURNING *`;
      params.push(id, auth.user.id);

      const { rows } = await query(updateQuery, params);
      if (rows.length === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
      return res.status(200).json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      if (!id) return res.status(400).json({ error: 'ID do projeto é obrigatório' });
      const { rowCount } = await query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, auth.user.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Projeto não encontrado' });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

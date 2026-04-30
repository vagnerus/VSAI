import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = req.query.id || url.pathname.split('/').pop();

  if (req.method === 'GET') {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            language VARCHAR(100) DEFAULT 'Agnóstico',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
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
      // Lazy table creation to prevent "relation does not exist" errors
      await query(`
        CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            language VARCHAR(100) DEFAULT 'Agnóstico',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

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
      const { name, description, language } = req.body;
      if (!id) return res.status(400).json({ error: 'ID do projeto é obrigatório' });
      
      const { rows } = await query(
        'UPDATE projects SET name = $1, description = $2, language = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING *',
        [name, description, language, id, auth.user.id]
      );
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

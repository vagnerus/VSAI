import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = req.query.action || url.pathname.split('/').pop();

  // Lazy Initialization of Teams/Workspaces Tables
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        plan VARCHAR(50) DEFAULT 'free',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member',
        PRIMARY KEY (workspace_id, user_id)
      );
    `);
  } catch (err) {
    console.error('[DB_WARN] Falha ao inicializar tabelas de times:', err.message);
  }

  if (req.method === 'GET') {
    try {
      // Find all teams where user is member or owner
      const { rows } = await query(`
        SELECT w.*, wm.role as my_role 
        FROM workspaces w 
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE w.owner_id = $1 OR wm.user_id = $1
      `, [auth.user.id]);
      
      return res.status(200).json({ teams: rows });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Nome do time é obrigatório' });

      // Create new workspace
      const { rows: wRows } = await query(`
        INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING *
      `, [name, auth.user.id]);

      // Add owner as admin member
      await query(`
        INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')
      `, [wRows[0].id, auth.user.id]);

      return res.status(201).json({ team: wRows[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    try {
      // Garantir que as colunas existem
      await query(`
        ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS bio TEXT,
        ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
        ADD COLUMN IF NOT EXISTS avatar_url TEXT
      `).catch(() => {});

      const { rows } = await query(
        'SELECT full_name, email, bio, phone, avatar_url, custom_instructions, plan, tokens_used_month, tokens_limit FROM profiles WHERE id = $1',
        [auth.user.id]
      );
      return res.json({ profile: rows[0] || {} });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const { full_name, bio, phone, avatar_url, custom_instructions } = req.body;
    try {
      const { rows } = await query(
        `UPDATE profiles 
         SET full_name = COALESCE($1, full_name), 
             bio = $2, 
             phone = $3, 
             avatar_url = $4, 
             custom_instructions = $5, 
             updated_at = NOW() 
         WHERE id = $6 RETURNING *`,
        [full_name, bio, phone, avatar_url, custom_instructions, auth.user.id]
      );
      return res.json({ status: 'updated', profile: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}

import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  if (req.method === 'GET') {
    try {
      const { rows } = await query(
        'SELECT custom_instructions, plan, tokens_used_month, tokens_limit FROM profiles WHERE id = $1',
        [auth.user.id]
      );
      return res.json({ profile: rows[0] || {} });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method === 'POST') {
    const { custom_instructions } = req.body;
    try {
      const { rows } = await query(
        'UPDATE profiles SET custom_instructions = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [custom_instructions, auth.user.id]
      );
      return res.json({ status: 'updated', profile: rows[0] });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}

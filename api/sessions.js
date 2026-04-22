import { requireAuth } from './_lib/authMiddleware.js';
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = req.query.id || url.pathname.split('/').pop();

  if (req.method === 'GET') {
    try {
      if (id && id !== 'sessions') {
        // Fetch specific session
        const { rows: sessionRows } = await query('SELECT * FROM sessions WHERE id = $1 AND user_id = $2', [id, auth.user.id]);
        if (sessionRows.length === 0) return res.status(404).json({ error: 'Sessão não encontrada' });
        
        // Fetch messages for session
        const { rows: messageRows } = await query('SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC', [id]);
        
        const sessionData = sessionRows[0];
        sessionData.messages = messageRows;
        return res.status(200).json(sessionData);
      } else {
        // Fetch all sessions with message count
        const { rows } = await query(`
          SELECT s.*, COUNT(m.id) as message_count 
          FROM sessions s 
          LEFT JOIN messages m ON s.id = m.session_id 
          WHERE s.user_id = $1 
          GROUP BY s.id 
          ORDER BY s.updated_at DESC
        `, [auth.user.id]);
        return res.status(200).json(rows);
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      if (!id) return res.status(400).json({ error: 'ID é obrigatório' });
      const { rowCount } = await query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [id, auth.user.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Sessão não encontrada' });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

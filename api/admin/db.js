import { requireAdmin } from '../_lib/authMiddleware.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const ALLOWED_TABLES = [
  'profiles',
  'projects',
  'sessions',
  'messages',
  'usage_logs',
  'knowledge_files'
];

export default async function handler(req, res) {
  // Config CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Protect route
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const supabase = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      const { table } = req.query;

      if (!table || !ALLOWED_TABLES.includes(table)) {
        return res.status(400).json({ error: 'Tabela inválida ou não permitida' });
      }

      // Fetch the latest 100 rows from the requested table
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(100);

      if (error) {
        // Fallback for tables without created_at
        if (error.code === '42703') { // undefined_column
           const { data: fallbackData, error: fallbackErr } = await supabase
            .from(table)
            .select('*')
            .limit(100);
            
            if (fallbackErr) throw fallbackErr;
            return res.status(200).json({ data: fallbackData });
        }
        throw error;
      }

      return res.status(200).json({ data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(`[Admin DB] Error fetching table ${req.query.table}:`, error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

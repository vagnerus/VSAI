import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { requireAuth, requireAdmin } from './_lib/authMiddleware.js';

export default async function handler(req, res) {
  // Allow GET for all authenticated users to see available agents
  if (req.method === 'GET') {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // Require ADMIN for sensitive operations (POST/DELETE)
  const auth = await requireAdmin(req, res);
  if (!auth) return;

  const supabase = getSupabaseAdmin();

  if (req.method === 'POST') {
    const { name, description, model, system_prompt, tools, icon } = req.body;
    
    if (!name || !system_prompt) {
      return res.status(400).json({ error: 'Nome e System Prompt são obrigatórios.' });
    }

    const { data, error } = await supabase
      .from('agents')
      .insert({
        name,
        description,
        model: model || 'gemini-2.5-flash',
        system_prompt,
        tools: tools || [],
        icon: icon || '🤖',
        created_by: auth.user.id
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID do agente é obrigatório.' });

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Método não permitido' });
}

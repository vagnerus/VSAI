/**
 * GET/POST/DELETE /api/agents — Manage autonomous agents
 */
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { verifyAuth } from './_lib/authMiddleware.js';

export default async function handler(req, res) {
  const auth = await verifyAuth(req);
  if (!auth || auth.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem gerenciar agentes.' });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

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

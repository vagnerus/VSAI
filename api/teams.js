import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const supabase = getSupabaseClient(auth.token);
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // 1. Listar as equipes que o usuário participa
  if (req.method === 'GET') {
    const { data: memberships, error: mErr } = await supabase
      .from('team_members')
      .select('role, teams(id, name, owner_id)')
      .eq('user_id', auth.user.id);

    if (mErr) return res.status(500).json({ error: mErr.message });
    return res.json({ teams: memberships.map(m => ({ ...m.teams, my_role: m.role })) });
  }

  // 2. Criar uma nova equipe (Organização)
  if (req.method === 'POST') {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome da equipe é obrigatório.' });

    // Iniciar a criação da equipe
    const { data: team, error: tErr } = await supabase
      .from('teams')
      .insert({ name, owner_id: auth.user.id })
      .select()
      .single();

    if (tErr) return res.status(500).json({ error: tErr.message });

    // Inserir o criador como 'owner' na tabela de membros
    await supabase.from('team_members').insert({
      team_id: team.id,
      user_id: auth.user.id,
      role: 'owner'
    });

    return res.json({ success: true, team });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient, getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const { method, query, body } = req;
  const userId = auth.user.id;
  const supabase = auth.token ? getSupabaseClient(auth.token) : null;
  const supabaseAdmin = getSupabaseAdmin(); // For some admin ops if needed

  // Extract path segments
  const projectId = query.id || (query.path && query.path[0]);
  const subRoute = query.route || (query.path && query.path[1]);

  // ─── 1. LIST OR CREATE (No Project ID) ────────────────────────
  if (!projectId) {
    if (method === 'GET') {
      if (!supabase) return res.json({ projects: [] }); // Fallback
      const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ projects: data || [] });
    }

    if (method === 'POST') {
      const { name, description, language } = body || {};
      if (!name) return res.status(400).json({ error: 'Name is required' });
      if (!supabase) return res.status(500).json({ error: 'Database not configured' });
      const { data, error } = await supabase.from('projects').insert({ user_id: userId, name, description: description || '', language: language || 'Agnóstico' }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ status: 'created', project: data });
    }
  }

  // ─── 2. SPECIFIC PROJECT OPS (With Project ID) ────────────────
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // subRoute: /api/projects/:id/knowledge
  if (subRoute === 'knowledge') {
    if (method === 'POST') {
      const { files } = body || {};
      if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'Files required' });
      const inserts = files.map(f => ({ project_id: projectId, file_name: f.name, content: f.content }));
      const { error } = await supabase.from('project_knowledge').insert(inserts);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ status: 'uploaded', count: files.length });
    }
    if (method === 'GET') {
      const { data, error } = await supabase.from('project_knowledge').select('*').eq('project_id', projectId);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ files: data || [] });
    }
  }

  // GET PROJECT BY ID
  if (method === 'GET') {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) return res.status(404).json({ error: 'Project not found' });
    return res.json({ project: data });
  }

  // UPDATE PROJECT
  if (method === 'PUT') {
    const { data, error } = await supabase.from('projects').update(body).eq('id', projectId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: 'updated', project: data });
  }

  // DELETE PROJECT
  if (method === 'DELETE') {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: 'deleted' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

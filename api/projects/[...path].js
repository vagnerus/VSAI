/**
 * Combined projects sub-routes handler — catch-all route.
 * Handles: /api/projects/:id, /api/projects/:id/knowledge, /api/projects/:id/workspace
 * req.query.path = ['<id>'] | ['<id>', 'knowledge'] | ['<id>', 'workspace']
 */

import { requireAuth } from '../_lib/authMiddleware.js';
import { getSupabaseClient } from '../_lib/supabaseAdmin.js';

// ─── Project by ID ───────────────────────────────────────────

async function handleProjectById(req, res, supabase, projectId) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) return res.status(404).json({ error: 'Project not found' });
    return res.json({ project: data });
  }

  if (req.method === 'PUT') {
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.system_prompt !== undefined) updates.system_prompt = req.body.system_prompt;
    if (req.body.systemPrompt !== undefined) updates.system_prompt = req.body.systemPrompt;
    if (req.body.workspace_path !== undefined) updates.workspace_path = req.body.workspace_path;
    if (req.body.workspacePath !== undefined) updates.workspace_path = req.body.workspacePath;
    if (req.body.language !== undefined) updates.language = req.body.language;

    const { data, error } = await supabase.from('projects').update(updates).eq('id', projectId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: 'updated', project: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ status: 'deleted' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// ─── Knowledge ───────────────────────────────────────────────

async function handleKnowledge(req, res, supabase, projectId) {
  if (req.method === 'POST') {
    const { files } = req.body || {};
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo de texto fornecido' });
    }

    try {
      const inserts = files.map(f => ({
        project_id: projectId,
        file_name: f.name,
        content: f.content
      }));

      const { error } = await supabase.from('project_knowledge').insert(inserts);
      
      if (error) throw error;

      return res.json({ status: 'uploaded', count: files.length });
    } catch (err) {
      console.error('[Knowledge Upload]', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Permite listar os arquivos salvos se precisar no futuro
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('project_knowledge').select('id, file_name, created_at').eq('project_id', projectId);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ files: data || [] });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// ─── Workspace ───────────────────────────────────────────────

function handleWorkspace(req, res) {
  res.json({ tree: [], workspacePath: '', exists: false });
}

// ─── Main router ─────────────────────────────────────────────

export default async function handler(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const pathSegments = req.query.path || [];
  const projectId = pathSegments[0];

  if (!projectId) return res.status(400).json({ error: 'Project ID required' });

  const subRoute = pathSegments[1];

  if (subRoute === 'workspace') return handleWorkspace(req, res);

  // Everything else needs supabase
  const supabase = auth.token ? getSupabaseClient(auth.token) : null;
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  if (subRoute === 'knowledge') return handleKnowledge(req, res, supabase, projectId);
  if (!subRoute) return handleProjectById(req, res, supabase, projectId);

  res.status(404).json({ error: 'Unknown project sub-route' });
}

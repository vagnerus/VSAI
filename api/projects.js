/**
 * GET/POST /api/projects
 * Lists or creates projects for the authenticated user.
 * Uses Supabase if configured, falls back to in-memory for local dev.
 */

import { requireAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

// In-memory fallback for local dev
let localProjects = [];

export default async function handler(req, res) {
  // Try auth (optional for local dev)
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const userId = auth.user.id;
  const supabase = auth.token ? getSupabaseClient(auth.token) : null;

  if (req.method === 'GET') {
    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });

      const projects = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        systemPrompt: p.system_prompt || '',
        workspacePath: p.workspace_path || '',
        language: p.language || 'Agnóstico',
        createdAt: p.created_at,
        knowledgeCount: 0,
      }));
      return res.json({ projects });
    }

    // Fallback: local
    return res.json({ projects: localProjects.filter(p => p.userId === userId) });
  }

  if (req.method === 'POST') {
    const { name, description, language } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });

    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name,
          description: description || '',
          language: language || 'Agnóstico',
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ status: 'created', project: data });
    }

    // Fallback: local
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const project = {
      id, userId, name,
      description: description || '',
      language: language || 'Agnóstico',
      systemPrompt: '', workspacePath: '',
      createdAt: new Date().toISOString(),
      knowledgeCount: 0,
    };
    localProjects.push(project);
    return res.json({ status: 'created', project });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

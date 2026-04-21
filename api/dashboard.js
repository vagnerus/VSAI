/**
 * GET /api/dashboard — Dashboard stats for authenticated user
 */

import { verifyAuth } from './_lib/authMiddleware.js';
import { getSupabaseClient } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAuth(req);
  const supabase = auth?.token ? getSupabaseClient(auth.token) : null;

  if (!supabase) {
    // Local dev fallback
    return res.json({
      stats: {
        totalSessions: 0,
        activeSessions: 0,
        totalMessages: 0,
        totalTools: 0,
        totalHooks: 0,
        apiConfigured: !!process.env.GEMINI_API_KEY,
        uptime: 0,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        provider: 'Gemini',
        plan: 'free',
        tokensUsed: 0,
        tokensLimit: 50000,
      },
      recentSessions: [],
    });
  }

  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, tokens_used_month, tokens_limit')
      .eq('id', auth.user.id)
      .single();

    // Count sessions
    const { count: sessionCount } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });

    // Count messages
    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Recent sessions
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(5);

    return res.json({
      stats: {
        totalSessions: sessionCount || 0,
        activeSessions: 0,
        totalMessages: messageCount || 0,
        totalTools: 20,
        totalHooks: 0,
        apiConfigured: true,
        uptime: 0,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        provider: process.env.DEFAULT_PROVIDER === 'anthropic' ? 'Anthropic' : 'Gemini',
        plan: profile?.plan || 'free',
        tokensUsed: profile?.tokens_used_month || 0,
        tokensLimit: profile?.tokens_limit || 50000,
      },
      recentSessions: (recentSessions || []).map(s => ({
        sessionId: s.id,
        firstPrompt: s.title,
        messageCount: s.message_count,
        lastModified: s.updated_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

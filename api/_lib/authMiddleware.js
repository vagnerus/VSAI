/**
 * NexusAI — Auth Middleware for Vercel Serverless
 * Verifica JWT do Supabase e extrai user info
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks = null;

/**
 * Verifica o token JWT do Supabase
 * @returns {{ user: { id: string, email: string, role: string } }} | null
 */
export async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

  if (!supabaseUrl) {
    // No Supabase configured — allow passthrough for local dev
    return { user: { id: 'local-dev', email: 'dev@local', role: 'admin' } };
  }

  try {
    // Use JWKS endpoint for verification
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    }

    const { payload } = await jwtVerify(token, jwks, {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    });

    return {
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role || 'authenticated',
      },
      token,
    };
  } catch (err) {
    console.error('[Auth] JWT verification failed:', err.message);
    return null;
  }
}

/**
 * Middleware helper — returns 401 if not authenticated
 */
export async function requireAuth(req, res) {
  const auth = await verifyAuth(req);
  if (!auth) {
    res.status(401).json({ error: 'Não autenticado. Faça login para continuar.' });
    return null;
  }
  return auth;
}

/**
 * Middleware helper — returns 403 if user is not an admin
 */
export async function requireAdmin(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return null;

  try {
    const { getSupabaseAdmin } = await import('./supabaseAdmin.js');
    const supabase = getSupabaseAdmin();
    
    // Check role in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
      return null;
    }

    // Attach role to auth object
    auth.user.appRole = profile.role;
    return auth;
  } catch (err) {
    console.error('[Auth] Error checking admin role:', err);
    res.status(500).json({ error: 'Erro ao verificar permissões.' });
    return null;
  }
}

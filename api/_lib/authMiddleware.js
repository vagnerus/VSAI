/**
 * NexusAI — Custom Auth Middleware
 * Verifica JWT gerado internamente e extrai user info
 */

import { jwtVerify } from 'jose';
import dotenv from 'dotenv';

dotenv.config();

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key');

/**
 * Verifica o token JWT
 * @returns {{ user: { id: string, email: string, role: string } }} | null
 */
export async function verifyAuth(req) {
  const authHeader = req.headers.authorization || req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { payload } = await jwtVerify(token, SECRET);

    const userRole = payload.email === 'vagneroliveira.us@gmail.com' ? 'admin' : (payload.role || 'user');

    return {
      user: {
        id: payload.id,
        email: payload.email,
        role: userRole,
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
    const { query } = await import('./db.js');
    
    // Check role in profiles table
    const { rows } = await query('SELECT role FROM profiles WHERE id = $1', [auth.user.id]);

    if (rows.length === 0 || (rows[0].role !== 'admin' && rows[0].role !== 'superadmin')) {
      res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
      return null;
    }

    // Attach role to auth object
    auth.user.appRole = rows[0].role;
    return auth;
  } catch (err) {
    console.error('[Auth] Error checking admin role:', err);
    res.status(500).json({ error: 'Erro ao verificar permissões.' });
    return null;
  }
}

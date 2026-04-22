import { query } from './_lib/db.js';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import dotenv from 'dotenv';

dotenv.config();

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key');

/**
 * Função utilitária para gerar um token JWT
 */
async function generateToken(user) {
  const jwt = await new SignJWT({ id: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Sessão de 7 dias
    .sign(SECRET);
  return jwt;
}

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = req.query.action || url.pathname.split('/').pop();
  
  const { email, password, full_name } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    if (action === 'register') {
      // 1. Checar se o e-mail já existe
      const { rows } = await query('SELECT id FROM profiles WHERE email = $1', [email]);
      if (rows.length > 0) {
        return res.status(400).json({ error: 'Este e-mail já está em uso.' });
      }

      // 2. Hash da senha (segurança)
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // 3. Inserir no banco
      const result = await query(
        `INSERT INTO profiles (email, password_hash, full_name, role, plan) 
         VALUES ($1, $2, $3, 'user', 'free') RETURNING id, email, full_name, role, plan`,
        [email, passwordHash, full_name || 'Usuário Nexus']
      );

      const user = result.rows[0];
      const token = await generateToken(user);

      return res.status(201).json({ user, session: { access_token: token } });
    }

    if (action === 'login') {
      // 1. Buscar usuário
      const { rows } = await query('SELECT * FROM profiles WHERE email = $1', [email]);
      if (rows.length === 0) {
        return res.status(400).json({ error: 'Credenciais inválidas.' });
      }

      const user = rows[0];

      // 2. Checar senha
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(400).json({ error: 'Credenciais inválidas.' });
      }

      // 3. Checar banimento
      if (user.role === 'banned') {
        return res.status(403).json({ error: 'Sua conta foi suspensa.' });
      }

      // 4. Gerar Token
      const token = await generateToken(user);
      
      // Remover senha da resposta
      delete user.password_hash;

      return res.status(200).json({ user, session: { access_token: token } });
    }

    return res.status(400).json({ error: 'Ação inválida (?action=login ou register)' });

  } catch (error) {
    console.error('[AUTH_ERROR]', error);
    return res.status(500).json({ error: 'Erro interno no servidor de autenticação.' });
  }
}

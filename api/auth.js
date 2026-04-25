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
  
  const { email, password, full_name, google_token } = req.body || {};

  try {
    // ─── REGISTRO POR E-MAIL ─────────────────────────────
    if (action === 'register') {
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }
      console.log(`[AUTH] Tentando registrar usuário: ${email}`);
      
      // 1. Checar se o e-mail já existe
      const { rows } = await query('SELECT id FROM profiles WHERE email = $1', [email]);
      if (rows.length > 0) {
        return res.status(400).json({ error: 'Este e-mail já está em uso.' });
      }

      // 2. Hash da senha
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

      console.log(`[AUTH] Usuário registrado com sucesso: ${email}`);
      return res.status(201).json({ user, session: { access_token: token } });
    }

    // ─── LOGIN POR E-MAIL ──────────────────────────────
    if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }
      
      const { rows } = await query('SELECT * FROM profiles WHERE email = $1', [email]);
      if (rows.length === 0) {
        return res.status(400).json({ error: 'Credenciais inválidas.' });
      }

      const user = rows[0];

      // O login via Google não terá password_hash
      if (!user.password_hash) {
        return res.status(400).json({ error: 'Este e-mail está vinculado a uma conta do Google. Faça login com o Google.' });
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(400).json({ error: 'Credenciais inválidas.' });
      }

      if (user.role === 'banned') {
        return res.status(403).json({ error: 'Sua conta foi suspensa.' });
      }

      const token = await generateToken(user);
      delete user.password_hash;

      return res.status(200).json({ user, session: { access_token: token } });
    }

    // ─── LOGIN COM GOOGLE ──────────────────────────────
    if (action === 'google') {
      console.log('[AUTH_GOOGLE] Iniciando validação de token...');
      if (!google_token) {
        console.warn('[AUTH_GOOGLE] Token não fornecido.');
        return res.status(400).json({ error: 'Token do Google não fornecido.' });
      }

      // Validar o token do Google usando a API pública deles
      const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${google_token}`);
      const googleData = await googleRes.json();

      if (!googleRes.ok || !googleData.email) {
        console.error('[AUTH_GOOGLE] Token inválido ou expirado:', googleData);
        return res.status(400).json({ error: 'Falha ao autenticar com o Google.' });
      }

      const { email: gEmail, name: gName } = googleData;
      console.log(`[AUTH_GOOGLE] Token válido para: ${gEmail}`);

      // Verifica se o usuário já existe no banco
      let { rows } = await query('SELECT * FROM profiles WHERE email = $1', [gEmail]);
      let user;

      if (rows.length === 0) {
        console.log(`[AUTH_GOOGLE] Novo usuário detectado, criando perfil: ${gEmail}`);
        // Cadastrar novo usuário com Google
        const result = await query(
          `INSERT INTO profiles (email, password_hash, full_name, role, plan) 
           VALUES ($1, $2, $3, 'user', 'free') RETURNING id, email, full_name, role, plan`,
          [gEmail, '', gName || 'Usuário Nexus'] 
        );
        user = result.rows[0];
      } else {
        console.log(`[AUTH_GOOGLE] Usuário existente encontrado: ${gEmail}`);
        user = rows[0];
        if (user.role === 'banned') {
          return res.status(403).json({ error: 'Sua conta foi suspensa.' });
        }
      }

      const token = await generateToken(user);
      console.log(`[AUTH_GOOGLE] Login concluído com sucesso para: ${gEmail}`);
      
      delete user.password_hash; 
      return res.status(200).json({ user, session: { access_token: token } });
    }

    return res.status(400).json({ error: 'Ação inválida (?action=login, register ou google)' });

  } catch (error) {
    console.error('[AUTH_ERROR_CATCH]', error);
    // Verificar se é um erro do PostgreSQL (código começa com número ex: 42501, 23505)
    if (error.code) {
      console.error(`[PG_ERROR] Código: ${error.code}, Detalhe: ${error.detail || error.message}`);
      return res.status(500).json({ error: `Erro no banco de dados (Cód: ${error.code}).` });
    }
    return res.status(500).json({ 
      error: 'Erro interno no servidor de autenticação.', 
      details: error.message,
      code: error.code
    });
  }
}

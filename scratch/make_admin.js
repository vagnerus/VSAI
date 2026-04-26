import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Desativado para compatibilidade com o servidor atual
});

async function makeAdmin(email) {
  try {
    console.log(`[DB] Atualizando usuário: ${email}`);
    
    // Tenta atualizar o usuário para admin e plano premium com limite alto de tokens
    const result = await pool.query(
      `UPDATE profiles 
       SET role = 'admin', 
           plan = 'premium', 
           tokens_limit = 999999999 
       WHERE email = $1 
       RETURNING id, email, role, plan`,
      [email]
    );

    if (result.rowCount === 0) {
      console.error(`[ERRO] Usuário não encontrado: ${email}. Ele já se cadastrou no sistema?`);
    } else {
      console.log('[SUCESSO] Usuário atualizado com sucesso!');
      console.table(result.rows);
    }
  } catch (err) {
    console.error('[ERRO_DB]', err.message);
  } finally {
    await pool.end();
  }
}

const targetEmail = 'vagneroliveira.us@gmail.com';
makeAdmin(targetEmail);

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Inicializa a conexão com o PostgreSQL usando a DATABASE_URL
// postgresql://irmao_user:12345@187.45.255.14:5432/VSAI
const dbUrl = process.env.DATABASE_URL || '';
const isRemoteIrmao = dbUrl.includes('187.45.255.14');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: (isRemoteIrmao || dbUrl.includes('sslmode=disable')) 
    ? false 
    : (dbUrl.includes('sslmode=') ? { rejectUnauthorized: false } : false)
});

pool.on('error', (err, client) => {
  console.error('[DB_POOL_ERROR] Erro inesperado no PostgreSQL', err);
});

/**
 * Função utilitária para executar queries SQL
 * @param {string} text - O comando SQL
 * @param {Array} params - Parâmetros para evitar SQL Injection
 */
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG === 'true') {
      console.log(`[DB] executou query em ${duration}ms:`, text);
    }
    return res;
  } catch (error) {
    console.error(`[DB_ERROR] Query falhou:`, text);
    console.error(error.message);
    console.error(error.stack);
    throw error;
  }
};

/**
 * Função utilitária para transações seguras (múltiplas queries que devem ter sucesso juntas)
 */
export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  // Patch client.query to catch errors
  const timeout = setTimeout(() => {
    console.error('Um client foi mantido por muito tempo (vazamento de conexão).');
  }, 5000);
  
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  return client;
};

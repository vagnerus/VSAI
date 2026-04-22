import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Inicializa a conexão com o PostgreSQL usando a DATABASE_URL
// postgresql://irmao_user:12345@187.45.255.14:5432/VSAI
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL pode ser necessário dependendo da configuração do P4Admin. 
  // Descomente a linha abaixo se der erro de SSL (self-signed certificate)
  // ssl: { rejectUnauthorized: false }
});

pool.on('error', (err, client) => {
  console.error('[DB_POOL_ERROR] Erro inesperado no PostgreSQL', err);
  process.exit(-1);
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

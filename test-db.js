import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

// Usar a DATABASE_URL do arquivo .env
const dbUrl = process.env.DATABASE_URL;

console.log('🔄 Iniciando teste de conexão ao PostgreSQL...');
console.log(`📡 URL Alvo: ${dbUrl.replace(/:([^:@]{1,})@/, ':*****@')}`); // Esconde a senha no console

const client = new Client({
  connectionString: dbUrl,
  // Dependendo do servidor, SSL pode ser obrigatório. 
  // Vamos tentar sem SSL primeiro.
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ SUCESSO ABSOLUTO! Conexão estabelecida com o banco de dados VSAI.');
    
    // Testa se consegue ler a hora do servidor
    const res = await client.query('SELECT NOW() as current_time');
    console.log('⏱️ Resposta do Servidor:', res.rows[0].current_time);
    
    await client.end();
  } catch (err) {
    console.log('\n❌ ERRO DE CONEXÃO DETECTADO:\n');
    
    if (err.code === '3D000') {
      console.log('MOTIVO: O banco de dados chamado "VSAI" ainda NÃO EXISTE no servidor.');
      console.log('SOLUÇÃO: Conecte-se usando o banco padrão "postgres" e crie o banco "VSAI" primeiro.');
    } else if (err.code === '28P01') {
      console.log('MOTIVO: Senha incorreta para o usuário "irmao_user".');
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      console.log('MOTIVO: O servidor 187.45.255.14 não está acessível na porta 5432.');
      console.log('SOLUÇÃO: Verifique se o servidor está ligado ou se o Firewall está bloqueando o seu IP.');
    } else if (err.message.includes('SSL off')) {
      console.log('MOTIVO: O servidor exige uma conexão criptografada (SSL).');
      console.log('SOLUÇÃO: Precisamos adicionar "?sslmode=require" na sua DATABASE_URL do .env');
    } else {
      console.log('CÓDIGO DO ERRO:', err.code);
      console.log('DETALHES:', err.message);
    }
    
    process.exit(1);
  }
}

testConnection();

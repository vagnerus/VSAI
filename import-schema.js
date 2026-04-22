import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;
const dbUrl = process.env.DATABASE_URL;

const client = new Client({
  connectionString: dbUrl,
});

async function importSchema() {
  try {
    console.log('🔄 Conectando ao banco de dados...');
    await client.connect();
    
    console.log('📖 Lendo o arquivo schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('⚡ Executando o schema (criando tabelas)...');
    await client.query(schemaSql);
    
    console.log('✅ SUCESSO! Todas as tabelas foram criadas com sucesso no servidor novo.');
  } catch (err) {
    console.error('❌ ERRO AO IMPORTAR O SCHEMA:');
    console.error(err);
  } finally {
    await client.end();
  }
}

importSchema();

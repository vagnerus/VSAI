import { query } from './api/_lib/db.js';

async function testVector() {
  try {
    console.log('Testing pgvector extension...');
    await query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('SUCCESS: pgvector is supported!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR: pgvector failed.', err.message);
    process.exit(1);
  }
}

testVector();

import { query } from './api/_lib/db.js';

async function checkTables() {
  try {
    const { rows } = await query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    console.log('Tables:', rows.map(r => r.tablename));
  } catch (e) {
    console.error('Error checking tables:', e);
  }
}

checkTables();

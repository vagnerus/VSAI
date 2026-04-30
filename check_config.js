import { query } from './api/_lib/db.js';

async function checkUserConfig() {
  try {
    const res = await query('SELECT email, config FROM profiles');
    console.log("PROFILES CONFIG:");
    res.rows.forEach(r => {
      console.log(`Email: ${r.email}`);
      console.log(`Config: ${JSON.stringify(r.config, null, 2)}`);
      console.log('---');
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkUserConfig();

/**
 * Run this script to clean up old API files that have been consolidated.
 * Execute: node cleanup_old_api.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const filesToDelete = [
  'api/health.js',
  'api/dashboard.js',
  'api/config.js',
  'api/settings.js',
  'api/models.js',
  'api/tools.js',
  'api/hooks.js',
  'api/permissions.js',
  'api/permissions/mode.js',
  'api/admin/users.js',
  'api/admin/analytics.js',
  'api/admin/db.js',
  'api/projects/[id].js',
  'api/projects/[id]/knowledge.js',
  'api/projects/[id]/workspace.js',
];

const dirsToDelete = [
  'api/projects/[id]',
  'api/permissions',
];

let deleted = 0;
for (const f of filesToDelete) {
  const full = path.join(__dirname, f);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
    console.log(`✓ Deleted ${f}`);
    deleted++;
  } else {
    console.log(`  Skipped ${f} (not found)`);
  }
}

for (const d of dirsToDelete) {
  const full = path.join(__dirname, d);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`✓ Removed directory ${d}`);
  }
}

console.log(`\nDone! Deleted ${deleted} files.`);
console.log('You can now delete this script: cleanup_old_api.js');

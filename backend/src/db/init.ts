import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Execute raw SQL schema script
  db.exec(schema);
  console.log('✓ Database schema successfully initialized.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

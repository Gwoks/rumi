import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, 'rumi.db');

export const db: Database.Database = new Database(DB_PATH);

// Enforce foreign key constraints and use Write-Ahead Logging for concurrency
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export default db;

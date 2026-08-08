#!/usr/bin/env node
/**
 * Apply migrations/audit/*.sql in lexical order using AUDIT_DATABASE_URL_MIGRATOR
 * (falls back to AUDIT_DATABASE_URL).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Client } = pg;
const dir = path.join(process.cwd(), 'migrations', 'audit');

async function main() {
  const url = process.env.AUDIT_DATABASE_URL_MIGRATOR || process.env.AUDIT_DATABASE_URL;
  if (!url) {
    console.error('Set AUDIT_DATABASE_URL_MIGRATOR or AUDIT_DATABASE_URL');
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    for (const file of files) {
      const id = file;
      const exists = await client.query(`SELECT 1 FROM schema_migrations WHERE id = $1`, [id]);
      if (exists.rowCount) {
        console.log(`skip ${id}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`apply ${id}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('migrate:audit complete');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

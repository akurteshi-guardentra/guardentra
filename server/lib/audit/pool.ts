import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isAuditSpineEnabled(): boolean {
  const raw = (process.env.AUDIT_SPINE_ENABLED || '').toLowerCase();
  return raw === 'true' || raw === '1';
}

export function getAuditPool(): pg.Pool | null {
  if (!isAuditSpineEnabled()) return null;
  const url = process.env.AUDIT_DATABASE_URL;
  if (!url) {
    console.warn('[audit] AUDIT_SPINE_ENABLED but AUDIT_DATABASE_URL missing');
    return null;
  }
  if (!pool) {
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export async function closeAuditPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function isAuditSpineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.AUDIT_SPINE_ENABLED || '').toLowerCase();
  return raw === 'true' || raw === '1';
}

export function assertAuditRuntimeConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (!isAuditSpineEnabled(env)) return;
  if (!env.AUDIT_DATABASE_URL?.trim()) {
    throw new Error('AUDIT_SPINE_ENABLED requires AUDIT_DATABASE_URL');
  }
}

export function getAuditPool(): pg.Pool | null {
  if (!isAuditSpineEnabled()) return null;
  assertAuditRuntimeConfig();
  const url = process.env.AUDIT_DATABASE_URL!.trim();
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

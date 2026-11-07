import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Optional server CA pin for the audit database (#74 A3).
 *
 * Without it the pool keeps whatever the connection string says. Staging today
 * uses `sslmode=no-verify`: the link is encrypted but the server certificate is
 * not checked, so anything on the network path that can present a certificate
 * could stand in for Cloud SQL.
 *
 * When AUDIT_DATABASE_CA_CERT holds the instance's server CA (PEM; the Cloud SQL
 * server CA is public, not a secret), the pool requires TLS and rejects any server
 * whose chain does not lead to that CA. The host name is not compared, because
 * Cloud SQL server certificates name the instance, not the private IP the app
 * dials. That is libpq's `verify-ca`.
 *
 * Any ssl* parameters in the URL are removed in that mode: node-postgres lets the
 * connection string override the ssl object, so a leftover `sslmode=no-verify`
 * would silently switch verification back off.
 */
const CA_CERT_ENV = 'AUDIT_DATABASE_CA_CERT';
const URL_TLS_PARAMS = ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl', 'uselibpqcompat'];
const PEM_CERT = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

export function isAuditSpineEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.AUDIT_SPINE_ENABLED || '').toLowerCase();
  return raw === 'true' || raw === '1';
}

function auditCaCert(env: NodeJS.ProcessEnv): string | null {
  const raw = env[CA_CERT_ENV];
  if (raw == null || raw.trim() === '') return null;
  // Secret Manager / yaml values sometimes arrive with literal "\n".
  const pem = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  if (!PEM_CERT.test(pem)) {
    throw new Error(`${CA_CERT_ENV} must be a PEM certificate`);
  }
  return pem.trim();
}

export function assertAuditRuntimeConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (!isAuditSpineEnabled(env)) return;
  if (!env.AUDIT_DATABASE_URL?.trim()) {
    throw new Error('AUDIT_SPINE_ENABLED requires AUDIT_DATABASE_URL');
  }
  auditCaCert(env);
}

function stripUrlTlsParams(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(`${CA_CERT_ENV} needs AUDIT_DATABASE_URL in URL form (postgres://...)`);
  }
  for (const key of URL_TLS_PARAMS) url.searchParams.delete(key);
  return url.toString();
}

/** Pool options for the audit database. Pure, so tests can inspect it. */
export function auditPoolConfig(env: NodeJS.ProcessEnv = process.env): pg.PoolConfig {
  assertAuditRuntimeConfig(env);
  const url = env.AUDIT_DATABASE_URL!.trim();
  const ca = auditCaCert(env);
  if (!ca) return { connectionString: url, max: 5 };
  return {
    connectionString: stripUrlTlsParams(url),
    max: 5,
    ssl: {
      ca,
      rejectUnauthorized: true,
      // verify-ca: chain must lead to the pinned CA; host name is not compared.
      checkServerIdentity: () => undefined,
    },
  };
}

export function getAuditPool(): pg.Pool | null {
  if (!isAuditSpineEnabled()) return null;
  if (!pool) {
    pool = new Pool(auditPoolConfig());
  }
  return pool;
}

export async function closeAuditPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

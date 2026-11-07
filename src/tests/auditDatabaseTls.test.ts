// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { assertAuditRuntimeConfig, auditPoolConfig } from '../../server/lib/audit/pool';

const PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBszCCAVmgAwIBAgIUZmFrZS1jYS1mb3ItdGVzdHMtb25seTAKBggqhkjOPQQDAjAA',
  '-----END CERTIFICATE-----',
].join('\n');

const base = {
  AUDIT_SPINE_ENABLED: 'true',
  AUDIT_DATABASE_URL: 'postgres://audit_runtime:pw@10.0.0.5:5432/audit?sslmode=no-verify',
} as NodeJS.ProcessEnv;

describe('#74 A3 audit database TLS', () => {
  it('keeps the connection string as-is when no CA is pinned', () => {
    const cfg = auditPoolConfig(base);
    expect(cfg.connectionString).toBe(base.AUDIT_DATABASE_URL);
    expect(cfg.ssl).toBeUndefined();
  });

  it('treats a blank CA value as unset', () => {
    const cfg = auditPoolConfig({ ...base, AUDIT_DATABASE_CA_CERT: '  ' });
    expect(cfg.ssl).toBeUndefined();
  });

  it('pins the CA, requires a valid chain, and drops URL ssl params that would override it', () => {
    const cfg = auditPoolConfig({ ...base, AUDIT_DATABASE_CA_CERT: PEM });
    const ssl = cfg.ssl as { ca: string; rejectUnauthorized: boolean; checkServerIdentity: () => unknown };
    expect(ssl.ca).toBe(PEM);
    expect(ssl.rejectUnauthorized).toBe(true);
    expect(ssl.checkServerIdentity()).toBeUndefined();
    const url = new URL(cfg.connectionString!);
    expect(url.searchParams.has('sslmode')).toBe(false);
    expect(url.hostname).toBe('10.0.0.5');
    expect(url.pathname).toBe('/audit');
    expect(url.username).toBe('audit_runtime');
  });

  it.each(['sslmode=disable', 'sslrootcert=/tmp/x.pem', 'ssl=false', 'uselibpqcompat=true&sslmode=prefer'])(
    'removes %s when a CA is pinned',
    (q) => {
      const cfg = auditPoolConfig({
        ...base,
        AUDIT_DATABASE_URL: `postgres://u:p@h:5432/db?${q}&application_name=audit`,
        AUDIT_DATABASE_CA_CERT: PEM,
      });
      const url = new URL(cfg.connectionString!);
      expect([...url.searchParams.keys()]).toEqual(['application_name']);
    },
  );

  it('accepts a PEM delivered with literal \\n separators', () => {
    const cfg = auditPoolConfig({ ...base, AUDIT_DATABASE_CA_CERT: PEM.replace(/\n/g, '\\n') });
    expect((cfg.ssl as { ca: string }).ca).toBe(PEM);
  });

  it('fails closed on a CA value that is not a PEM certificate', () => {
    const env = { ...base, AUDIT_DATABASE_CA_CERT: 'not-a-cert' };
    expect(() => assertAuditRuntimeConfig(env)).toThrow('AUDIT_DATABASE_CA_CERT must be a PEM certificate');
    expect(() => auditPoolConfig(env)).toThrow('must be a PEM certificate');
  });

  it('refuses a key/value connection string when a CA is pinned (cannot strip sslmode safely)', () => {
    expect(() =>
      auditPoolConfig({
        ...base,
        AUDIT_DATABASE_URL: 'host=/cloudsql/x dbname=audit sslmode=disable',
        AUDIT_DATABASE_CA_CERT: PEM,
      }),
    ).toThrow('needs AUDIT_DATABASE_URL in URL form');
  });

  it('ignores the CA when the spine is disabled', () => {
    expect(() =>
      assertAuditRuntimeConfig({ AUDIT_SPINE_ENABLED: 'false', AUDIT_DATABASE_CA_CERT: 'junk' }),
    ).not.toThrow();
  });
});

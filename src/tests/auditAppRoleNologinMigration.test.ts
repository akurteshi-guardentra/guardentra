import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

function readMigration(name: string): string {
  return readFileSync(resolve(root, 'migrations/audit', name), 'utf8');
}

function executableSql(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

describe('audit #74 NOLOGIN hardening migration (restricted-migrator safe)', () => {
  it('003 verifies NOLOGIN without ALTER/CREATE role attributes or passwords', () => {
    const sql = readMigration('003_harden_audit_app_nologin.sql');
    const executable = executableSql(sql);
    expect(executable).toMatch(/RAISE EXCEPTION/i);
    expect(executable).toMatch(/rolcanlogin/i);
    expect(executable).toMatch(/GRANT SELECT, INSERT ON audit_events/i);
    expect(executable).not.toMatch(/ALTER ROLE/i);
    expect(executable).not.toMatch(/CREATE ROLE/i);
    expect(executable).not.toMatch(/PASSWORD\s+'[^']+'/i);
  });

  it('admin-harden path holds role attribute authority separately from migrator SQL', () => {
    const admin = readFileSync(
      resolve(root, 'scripts/audit-managed-staging/admin-harden-audit-app.sql'),
      'utf8',
    );
    const executable = executableSql(admin);
    expect(executable).toMatch(/ALTER ROLE audit_app WITH NOLOGIN/i);
    expect(executable).toMatch(/ALTER ROLE audit_app WITH PASSWORD NULL/i);
    expect(executable).toMatch(/admin-harden requires a role administrator/i);
    expect(executable).not.toMatch(/PASSWORD\s+'[^']+'/i);
  });

  it('002 remains NOLOGIN greenfield create without rewriting history via 003 attributes', () => {
    const two = readMigration('002_roles.sql');
    expect(two).toMatch(/CREATE ROLE audit_app NOLOGIN/i);
    expect(two).not.toMatch(/LOGIN\s+PASSWORD/i);
    const three = readMigration('003_harden_audit_app_nologin.sql');
    expect(three).toMatch(/Issue #74/i);
  });
});

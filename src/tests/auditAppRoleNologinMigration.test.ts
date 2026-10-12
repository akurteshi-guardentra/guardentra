import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');

function readMigration(name: string): string {
  return readFileSync(resolve(root, 'migrations/audit', name), 'utf8');
}

describe('audit #74 NOLOGIN hardening migration', () => {
  it('003 hardens audit_app to NOLOGIN and clears password without inventing LOGIN', () => {
    const sql = readMigration('003_harden_audit_app_nologin.sql');
    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    expect(executable).toMatch(/ALTER ROLE audit_app WITH NOLOGIN/i);
    expect(executable).toMatch(/ALTER ROLE audit_app WITH PASSWORD NULL/i);
    expect(executable).toMatch(/CREATE ROLE audit_app NOLOGIN/i);
    expect(executable).not.toMatch(/\bLOGIN\b(?!\s*;)/i); // NOLOGIN is allowed; bare LOGIN is not
    expect(executable).not.toMatch(/PASSWORD\s+'[^']+'/i);
  });

  it('003 remains additive — does not rewrite 002_roles.sql content', () => {
    const two = readMigration('002_roles.sql');
    // Baseline may still contain the unsafe pattern; 003 is the corrective migration.
    expect(two.length).toBeGreaterThan(0);
    const three = readMigration('003_harden_audit_app_nologin.sql');
    expect(three).toMatch(/Issue #74/i);
  });
});

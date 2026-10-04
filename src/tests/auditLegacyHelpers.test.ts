import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('#74 historical audit helper quarantine', () => {
  it('fails closed instead of printing legacy Cloud SQL mutation commands', () => {
    const text = readRepoFile('scripts/phase2-cloudsql-staging.ps1');

    expect(text).toContain('REFUSED: this historical helper is quarantined');
    expect(text).toContain('Current staging target: guardentra-staging');
    expect(text).not.toMatch(/services\s+enable[^\n]*guardentra-7f582/i);
    expect(text).not.toMatch(/terraform[^\n]*(?:plan|apply)/i);
    expect(text).not.toMatch(/apphosting:secrets:grantaccess/i);
  });

  it('cannot mint tokens or call audit endpoints against the legacy project', () => {
    const text = readRepoFile('scripts/staging-dod-http-prove.mjs');

    expect(text).toContain('REFUSED: scripts/staging-dod-http-prove.mjs is a quarantined historical helper.');
    expect(text).toContain('Current staging target: guardentra-staging.');
    expect(text).not.toMatch(/firebase-admin\/auth/);
    expect(text).not.toMatch(/createCustomToken/);
    expect(text).not.toMatch(/\/api\/audit\/(?:emit|verify)/);
    expect(text).not.toMatch(/serviceAccountId\s*:/);
  });
});

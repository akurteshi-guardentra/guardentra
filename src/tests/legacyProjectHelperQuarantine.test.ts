import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('#130 legacy project helper quarantine', () => {
  it('fails closed on the historical bastion live-prove helper', () => {
    const text = readRepoFile('scripts/bastion-prove2.sh');
    expect(text).toContain('REFUSED: scripts/bastion-prove2.sh is a quarantined historical helper.');
    expect(text).toContain('Current staging authority: guardentra-staging');
    expect(text).not.toMatch(/cloud-sql-proxy\s+--private-ip/i);
    expect(text).not.toMatch(/gcloud\s+secrets\s+versions\s+access/i);
    expect(text).not.toMatch(/phase2-live-prove\.ts/);
  });

  it('cannot rewrite GitHub cloud variables from the historical auth helper', () => {
    const text = readRepoFile('scripts/phase2-auth-gh.ps1');
    expect(text).toContain('REFUSED: scripts/phase2-auth-gh.ps1 is a quarantined historical helper.');
    expect(text).not.toMatch(/gh\s+variable\s+set/i);
    expect(text).not.toMatch(/gh\s+auth\s+login/i);
  });

  it('cannot change gcloud project state from the historical auth helper', () => {
    const text = readRepoFile('scripts/phase2-auth-gcloud.ps1');
    expect(text).toContain('REFUSED: scripts/phase2-auth-gcloud.ps1 is a quarantined historical helper.');
    expect(text).not.toMatch(/application-default\s+set-quota-project/i);
    expect(text).not.toMatch(/config\s+set\s+project/i);
    expect(text).not.toMatch(/gcloud\s+auth\s+login/i);
  });

  it('cannot load local audit passwords or run historical migrations', () => {
    const text = readRepoFile('scripts/phase2-cloudsql-proxy-migrate.ps1');
    expect(text).toContain('REFUSED: scripts/phase2-cloudsql-proxy-migrate.ps1 is a quarantined historical helper.');
    expect(text).not.toMatch(/\.local-secrets/i);
    expect(text).not.toMatch(/migrate:audit/i);
    expect(text).not.toMatch(/phase2-live-prove/i);
  });

  it('cannot create WIF or IAM resources from the historical Week 0 helper', () => {
    const text = readRepoFile('scripts/phase2-week0-wif.ps1');
    expect(text).toContain('REFUSED: scripts/phase2-week0-wif.ps1 is a quarantined historical helper.');
    expect(text).not.toMatch(/workload-identity-pools\s+(?:create|providers\s+create)/i);
    expect(text).not.toMatch(/service-accounts\s+create/i);
    expect(text).not.toMatch(/add-iam-policy-binding/i);
  });

  it('keeps Firebase reauth environment-neutral', () => {
    const text = readRepoFile('scripts/firebase-reauth.mjs');
    expect(text).toContain('Use an explicit --project');
    expect(text).toContain('Issue #126');
    expect(text).not.toContain('guardentra-7f582');
    expect(text).not.toMatch(/apphosting:rollouts:list/);
  });

  it('does not present the legacy project as the only current cloud environment', () => {
    const text = readRepoFile('scripts/phase2-dual-firebase.ps1');
    expect(text).toContain('staging: guardentra-staging');
    expect(text).toContain('production: guardentra-prod');
    expect(text).toContain('guardentra-7f582 is demo/legacy only');
    expect(text).not.toContain('Visible GCP project today: guardentra-7f582 only.');
  });
});

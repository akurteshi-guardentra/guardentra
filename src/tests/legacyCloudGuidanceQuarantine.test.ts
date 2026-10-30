import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('#138 legacy cloud guidance quarantine', () => {
  it('does not equate protected main with production deployment authority', () => {
    const rules = read('.cursorrules');
    expect(rules).toContain('Protected `main` is the release source branch');
    expect(rules).toContain('P0 #126');
    expect(rules).not.toContain('main` for production deployments feeding guardentra.com');
  });

  it('keeps shared App Hosting guidance environment-bound and legacy-command free', () => {
    const text = read('apphosting.yaml');
    expect(text).toContain('staging=guardentra-staging');
    expect(text).toContain('production=guardentra-prod');
    expect(text).toContain('P0 #126');
    expect(text).not.toContain('main → production');
    expect(text).not.toMatch(/gcloud\s+secrets\s+create[^\n]*guardentra-7f582/i);
  });

  it('does not bind authentication guidance to the legacy cloud project or repo vars', () => {
    const text = read('docs/PHASE2_AUTH_NO_BROWSER.md');
    expect(text).toContain('Authentication is not project/change authority');
    expect(text).toContain('Issue #138');
    expect(text).not.toMatch(/set-quota-project\s+guardentra-7f582/i);
    expect(text).not.toMatch(/config\s+set\s+project\s+guardentra-7f582/i);
    expect(text).not.toMatch(/gh\s+variable\s+set\s+GCP_PROJECT_(?:ID|NUMBER)/i);
  });

  it('does not present the historical Week 0 bootstrap as executable current work', () => {
    const text = read('docs/PHASE2_WEEK0_START_HERE.md');
    expect(text).toContain('HISTORICAL BOOTSTRAP, QUARANTINED');
    expect(text).toContain('guardentra-staging');
    expect(text).toContain('guardentra-prod');
    expect(text).toContain('#136');
    expect(text).not.toMatch(/powershell\s+-File\s+scripts\/phase2-week0-wif\.ps1/i);
    expect(text).not.toMatch(/gh\s+variable\s+set/i);
  });

  it('treats dual Firebase as inventory-first gated roadmap work', () => {
    const text = read('docs/PHASE2_DUAL_FIREBASE.md');
    expect(text).toContain('GATED ROADMAP CAPABILITY');
    expect(text).toContain('fresh #116 read-only inventory');
    expect(text).toContain('guardentra-staging');
    expect(text).toContain('guardentra-prod');
    expect(text).not.toMatch(/firebase-tools\s+projects:create/i);
    expect(text).not.toContain('**Only** `guardentra-7f582`');
  });

  it('keeps historical Cloud SQL proof from advertising current legacy staging commands', () => {
    const text = read('docs/PHASE2_CLOUDSQL_STAGING.md');
    expect(text).toContain('Current #74 rule — historical operator steps superseded');
    expect(text).toContain('#116 read-only cloud inventory');
    expect(text).not.toContain('When a dedicated staging App Hosting backend exists');
    expect(text).not.toMatch(/apphosting:secrets:grantaccess\s+AUDIT_DATABASE_URL\s+--project=guardentra-7f582/i);
  });

  it('keeps historical ops status from presenting legacy work as current remaining actions', () => {
    const text = read('docs/PHASE2_OPS_STATUS.md');
    expect(text).toContain('Historical remaining items from 2026-08-11 — NOT CURRENT WORK');
    expect(text).toContain('Current #74 work begins with the #116 read-only inventory');
    expect(text).not.toContain('## Remaining (human / console)');
    expect(text).not.toMatch(/apphosting:secrets:grantaccess\s+AUDIT_DATABASE_URL\s+--project=guardentra-7f582/i);
    expect(text).not.toContain('There is **one** App Hosting backend (`guardentra` in `us-central1`) serving guardentra.com.');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
const infra = readFileSync(resolve(process.cwd(), '.github/workflows/infra-ci.yml'), 'utf8');

// Everything from the promote-staging job header to the end of the file (it is the last job).
const promoteJob = ci.slice(ci.indexOf('\n  promote-staging:'));

describe('#126 staging promotion gate', () => {
  it('runs CI on every push to release branches, not only on pull requests', () => {
    expect(ci).toMatch(/push:\s*\n(?:\s*#.*\n)*\s*branches: \[main, dev, 'release\/\*\*'\]/);
    expect(infra).toContain("branches: [main, 'release/**']");
  });

  it('never grants the workflow token write access, even in the promotion job', () => {
    expect(ci).toMatch(/\npermissions:\n\s+contents: read\n/);
    expect(ci).not.toMatch(/contents:\s*write/);
    expect(promoteJob).toContain('contents: read');
  });

  it('pushes with a deploy key that only the RC-scoped environment can read', () => {
    expect(promoteJob).toContain('environment: staging-promotion');
    expect(promoteJob).toContain('ssh-key: ${{ secrets.STAGING_PROMOTE_DEPLOY_KEY }}');
    expect(promoteJob).toContain('STAGING_PROMOTE_DEPLOY_KEY is not set');
    const keyRefs = ci.match(/secrets\.STAGING_PROMOTE_DEPLOY_KEY/g) ?? [];
    expect(keyRefs.length).toBe(promoteJob.match(/secrets\.STAGING_PROMOTE_DEPLOY_KEY/g)?.length);
  });

  it('promotes only after verify and dispatcher both succeed on a push to the RC branch', () => {
    expect(promoteJob).not.toBe(ci);
    expect(promoteJob).toContain('needs: [verify, dispatcher]');
    expect(promoteJob).toContain("github.event_name == 'push'");
    expect(promoteJob).toContain("github.ref == 'refs/heads/release/rc-2026-10-08'");
    expect(promoteJob).toContain("needs.verify.result == 'success'");
    expect(promoteJob).toContain("needs.dispatcher.result == 'success'");
    expect(promoteJob).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
  });

  it('refuses stale commits and commits with failed or unfinished checks', () => {
    expect(promoteJob).toContain('git ls-remote origin refs/heads/release/rc-2026-10-08');
    expect(promoteJob).toContain('Not promoting:');
    expect(promoteJob).toContain('did not finish in time; not promoting');
  });

  it('only fast-forwards deploy/staging and never force-pushes', () => {
    expect(promoteJob).toContain('git push origin "${GITHUB_SHA}:refs/heads/deploy/staging"');
    expect(promoteJob).not.toMatch(/--force|\s-f\s|\+\$\{GITHUB_SHA\}|\+refs\//);
  });

  it('holds no cloud credentials', () => {
    expect(ci).not.toContain('google-github-actions/auth');
    expect(ci).not.toMatch(/id-token\s*:\s*write/i);
    expect(ci).not.toMatch(/firebase deploy|apphosting/i);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/infra-ci.yml'), 'utf8');

describe('#136 Terraform CI quarantine', () => {
  it('does not authenticate to Google Cloud or request OIDC write permission', () => {
    expect(workflow).not.toContain('google-github-actions/auth');
    expect(workflow).not.toMatch(/id-token\s*:\s*write/i);
    expect(workflow).not.toContain('workload_identity_provider');
    expect(workflow).not.toContain('service_account:');
  });

  it('does not run remote Terraform plan, apply or force-unlock', () => {
    expect(workflow).not.toMatch(/terraform\s+plan\b/i);
    expect(workflow).not.toMatch(/terraform\s+apply\b/i);
    expect(workflow).not.toMatch(/force-unlock/i);
  });

  it('uses only cloud-neutral static validation for the historical EU root', () => {
    expect(workflow).toContain('terraform fmt -check -recursive infra');
    expect(workflow).toContain('terraform init -backend=false');
    expect(workflow).toContain('terraform validate');
    expect(workflow).toContain('contents: read');
  });
});

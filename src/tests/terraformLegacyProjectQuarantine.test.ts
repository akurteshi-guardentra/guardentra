import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('#134 EU-staging Terraform quarantine', () => {
  it('does not ship a legacy project or service-account execution default', () => {
    const vars = read('infra/envs/eu-staging/terraform.tfvars.example');
    expect(vars).not.toContain('project_id                    = "guardentra-7f582"');
    expect(vars).not.toContain('@guardentra-7f582.iam.gserviceaccount.com');
    expect(vars).toContain('REPLACE_FROM_APPROVED_ISSUE_PACKET');
    expect(vars).toContain('execution_issue');
    expect(vars).toContain('enable_vpc       = false');
    expect(vars).toContain('enable_cloud_sql = false');
  });

  it('fails closed on the legacy project and requires issue-bound execution scope', () => {
    const main = read('infra/envs/eu-staging/main.tf');
    expect(main).toContain('var.project_id != "guardentra-7f582"');
    expect(main).toContain('variable "execution_issue"');
    expect(main).toContain('can(regex("^#[1-9][0-9]*$"');
    expect(main).not.toMatch(/variable "execution_issue"[\s\S]{0,300}default\s*=/);
    expect(main).toContain('@guardentra-7f582.iam.gserviceaccount.com');
    expect(main).toContain('REFUSED:');
  });
});

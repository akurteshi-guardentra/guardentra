import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('#132 obsolete account migration quarantine', () => {
  for (const path of ['docs/MIGRATION_CLI.md', 'docs/ACCOUNT_MIGRATION.md']) {
    it(`${path} is historical-only and environment-current`, () => {
      const text = read(path);
      expect(text).toContain('QUARANTINED');
      expect(text).toContain('guardentra-staging');
      expect(text).toContain('guardentra-prod');
      expect(text).toContain('P0 #126');
      expect(text).toContain('Issue #132');
    });
  }

  it('removes executable legacy IAM/key/App Hosting mutation instructions from current CLI guide', () => {
    const text = read('docs/MIGRATION_CLI.md');
    expect(text).not.toMatch(/gcloud\s+services\s+enable/i);
    expect(text).not.toMatch(/api-keys\s+create/i);
    expect(text).not.toMatch(/get-key-string/i);
    expect(text).not.toMatch(/apphosting:secrets:set/i);
    expect(text).not.toMatch(/remove-iam-policy-binding/i);
    expect(text).not.toMatch(/config\s+set\s+project\s+guardentra-7f582/i);
  });

  it('removes old live-project ownership/billing instructions from current ownership guide', () => {
    const text = read('docs/ACCOUNT_MIGRATION.md');
    expect(text).not.toMatch(/Create a \*\*new\*\* Gemini API key inside/i);
    expect(text).not.toMatch(/Link project `guardentra-7f582` to/i);
    expect(text).not.toMatch(/IAM & Admin.*Grant access/i);
    expect(text).not.toContain('it holds all live data');
  });
});

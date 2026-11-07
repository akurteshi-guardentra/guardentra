import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('#146 Firebase deploy guidance', () => {
  const activeGuidance = [
    'docs/PRODUCT_FOCUS.md',
    'VENDOR_TEST_CHARTER.md',
  ];

  it.each(activeGuidance)('%s does not publish an unscoped rules deploy', (path) => {
    const text = read(path);
    expect(text).not.toMatch(
      /firebase\s+deploy\s+--only\s+firestore:rules,storage(?:\s*[\x60')\].,;]|\s*$)/im,
    );
  });

  it.each(activeGuidance)('%s names staging and production explicitly', (path) => {
    const text = read(path);
    expect(text).toContain('--project=guardentra-staging');
    expect(text).toContain('--project=guardentra-prod');
    expect(text).toMatch(/never rely on the Firebase CLI default project/i);
  });

  it('has no CLI default project, so every deploy must name its target', () => {
    // env-fixes R1: the default used to be guardentra-7f582 (legacy), so a bare
    // `firebase deploy` hit real legacy data.
    const firebaserc = JSON.parse(read('.firebaserc'));
    expect(firebaserc.projects).not.toHaveProperty('default');
    expect(JSON.stringify(firebaserc)).not.toMatch(/"default"/);
  });
});

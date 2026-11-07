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

  it('keeps the legacy default alias unchanged in this repository-only slice', () => {
    const firebaserc = read('.firebaserc');
    expect(firebaserc).toContain('"default": "guardentra-7f582"');
  });
});

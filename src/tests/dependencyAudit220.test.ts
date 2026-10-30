// @vitest-environment node
/**
 * GitHub #220 — in-range fixes for npm audit advisories (no --force, no overrides).
 * Fails if a later lockfile change silently reintroduces a patched-vulnerable version.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packages = (
  JSON.parse(readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8')) as {
    packages: Record<string, { version?: string }>;
  }
).packages;

const versionsOf = (name: string) =>
  Object.entries(packages)
    .filter(([p]) => p === `node_modules/${name}` || p.endsWith(`/node_modules/${name}`))
    .map(([, v]) => v.version as string);

const atLeast = (version: string, min: string) => {
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
};

// [package, first patched version, advisory]
const PATCHED: Array<[string, string, string]> = [
  ['body-parser', '2.4.0', 'GHSA-27r3-jxmh-p828 (compressed-body DoS)'],
  ['fast-uri', '3.1.9', 'GHSA-333x-w4r6-6crp et al. (host confusion)'],
  ['zod', '4.6.6', 'GHSA-mrhx-c7xc-m3w5 (memory exhaustion)'],
  ['@modelcontextprotocol/sdk', '1.32.0', 'GHSA-6prh-2h8m-c8cw et al.'],
  ['hono', '4.13.11', 'GHSA-5r4p-p66f-jhc7 et al.'],
  ['ip-address', '10.7.4', 'GHSA-rxp7-6hxx-x8q5 et al.'],
];

describe('#220 audited dependency floor', () => {
  it.each(PATCHED)('%s resolves at or above %s (%s)', (name, min) => {
    const versions = versionsOf(name).filter((v) => !v.startsWith('1.') || name !== 'body-parser');
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) expect(atLeast(v, min), `${name}@${v}`).toBe(true);
  });

  it('express 4 copy of body-parser (firebase-tools, dev only) is the 1.x line, outside the 2.x advisory', () => {
    for (const v of versionsOf('body-parser').filter((x) => x.startsWith('1.'))) {
      expect(atLeast(v, '1.20.3')).toBe(true);
    }
  });
});

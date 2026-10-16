import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const probe = path.join(root, 'src/tests/localDemoEgressProbe.mjs');

function runProbe(mode: string) {
  return spawnSync(process.execPath, [probe, mode], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('local demo network guard', () => {
  it('refuses external connect forms before the underlying socket or fetch', () => {
    const result = runProbe('stub');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ok stub');
  });

  it('allows loopback HTTP and refuses an external redirect', () => {
    const result = runProbe('transport');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ok transport');
  });
});

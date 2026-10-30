import { describe, expect, it } from 'vitest';
import { assertLocalEmulatorAllowed } from '../lib/localEmulatorGuard';

describe('local emulator guard', () => {
  it('stays off unless the flag is exactly 1', () => {
    expect(assertLocalEmulatorAllowed({ dev: true, flag: undefined, projectId: 'demo-guardentra-local' })).toBe(false);
    expect(assertLocalEmulatorAllowed({ dev: true, flag: 'true', projectId: 'demo-guardentra-local' })).toBe(false);
  });

  it('allows only the local demo project when opted in', () => {
    expect(
      assertLocalEmulatorAllowed({ dev: true, flag: '1', projectId: 'demo-guardentra-local' }),
    ).toBe(true);
  });

  it('refuses hosted projects, arbitrary project ids, and production builds', () => {
    for (const projectId of [
      'guardentra-staging',
      'guardentra-prod',
      'guardentra-7f582',
      'guardentra-dev',
      'my-real-project',
      '',
    ]) {
      expect(() => assertLocalEmulatorAllowed({ dev: true, flag: '1', projectId })).toThrow(/refused/);
    }
    expect(() =>
      assertLocalEmulatorAllowed({ dev: false, flag: '1', projectId: 'demo-guardentra-local' }),
    ).toThrow(/Vite dev/);
  });
});
import { describe, expect, it } from 'vitest';
import { assertLocalEmulatorAllowed } from '../lib/localEmulatorGuard';

describe('local emulator guard', () => {
  it('stays off unless the flag is exactly 1', () => {
    expect(assertLocalEmulatorAllowed({ dev: true, flag: undefined, projectId: 'demo-guardentra-local' })).toBe(false);
    expect(assertLocalEmulatorAllowed({ dev: true, flag: 'true', projectId: 'demo-guardentra-local' })).toBe(false);
  });

  it('allows a non-hosted dev project when opted in', () => {
    expect(
      assertLocalEmulatorAllowed({ dev: true, flag: '1', projectId: 'demo-guardentra-local' }),
    ).toBe(true);
  });

  it('refuses hosted projects, the legacy demo cloud project, and production builds', () => {
    for (const projectId of ['guardentra-staging', 'guardentra-prod', 'guardentra-7f582', '']) {
      expect(() => assertLocalEmulatorAllowed({ dev: true, flag: '1', projectId })).toThrow(/refused/);
    }
    expect(() =>
      assertLocalEmulatorAllowed({ dev: false, flag: '1', projectId: 'demo-guardentra-local' }),
    ).toThrow(/Vite dev/);
  });
});
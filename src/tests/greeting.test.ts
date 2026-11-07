import { describe, expect, it } from 'vitest';
import { dashboardGreeting, isReturningUser } from '../lib/greeting';

describe('dashboard greeting (#124 finding 2)', () => {
  it('says Welcome on the first session', () => {
    const t = '2026-10-30T23:00:00.000Z';
    expect(isReturningUser({ creationTime: t, lastSignInTime: t })).toBe(false);
    expect(dashboardGreeting('Ada', { creationTime: t, lastSignInTime: t })).toBe('Welcome, Ada');
  });

  it('treats a sign-in within minutes of signup as the first session', () => {
    expect(
      isReturningUser({
        creationTime: '2026-10-30T23:00:00.000Z',
        lastSignInTime: '2026-10-30T23:02:00.000Z',
      }),
    ).toBe(false);
  });

  it('says Welcome back on a later sign-in', () => {
    expect(
      dashboardGreeting('Ada', {
        creationTime: 'Thu, 30 Oct 2026 23:00:00 GMT',
        lastSignInTime: 'Fri, 31 Oct 2026 08:00:00 GMT',
      }),
    ).toBe('Welcome back, Ada');
  });

  it('falls back to Welcome when metadata is missing', () => {
    expect(dashboardGreeting('there', undefined)).toBe('Welcome, there');
    expect(isReturningUser({ creationTime: 'nope', lastSignInTime: null })).toBe(false);
  });
});

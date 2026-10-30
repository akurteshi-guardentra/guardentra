import { describe, expect, it } from 'vitest';
import { assertLocalDemoEnv, buildLocalDemoEnv } from '../../scripts/local-demo-preflight.mjs';

describe('local demo preflight', () => {
  it('builds a loopback env with no inherited secrets', () => {
    const env = buildLocalDemoEnv({
      PATH: '/usr/bin',
      HOME: '/tmp',
      GEMINI_API_KEY: 'should-not-leak',
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/key.json',
      SENDGRID_API_KEY: 'sg',
    }) as Record<string, string | undefined>;
    expect(env.GCLOUD_PROJECT).toBe('demo-guardentra-local');
    expect(env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(env.SENDGRID_API_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBe('your_gemini_api_key_here');
    expect(env.PORT).toBe('5173');
    expect(() => assertLocalDemoEnv(env)).not.toThrow();
  });

  it('refuses a cloud project and a live key', () => {
    const env = buildLocalDemoEnv();
    expect(() => assertLocalDemoEnv({ ...env, GCLOUD_PROJECT: 'guardentra-prod' })).toThrow(/project/);
    expect(() => assertLocalDemoEnv({ ...env, GEMINI_API_KEY: 'AIza-live' })).toThrow(/Gemini/);
    expect(() => assertLocalDemoEnv({ ...env, GOOGLE_APPLICATION_CREDENTIALS: '/tmp/sa.json' })).toThrow(
      /service account/,
    );
  });
});

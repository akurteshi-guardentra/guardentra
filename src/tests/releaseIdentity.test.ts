import { describe, expect, it } from 'vitest';
import { buildReleaseIdentity } from '../../server/lib/releaseIdentity';

describe('#176 release identity health readback', () => {
  it('reports only safe environment identity fields', () => {
    expect(
      buildReleaseIdentity({
        APP_ENV: 'staging',
        GOOGLE_CLOUD_PROJECT: 'guardentra-staging',
        K_SERVICE: 'guardentra-staging',
        K_REVISION: 'guardentra-staging-00042-abc',
        GUARDENTRA_SOURCE_SHA: 'abc123',
        STRIPE_SECRET_KEY: 'must-not-leak',
        AUDIT_DATABASE_URL: 'postgres://must-not-leak',
      } as NodeJS.ProcessEnv),
    ).toEqual({
      environment: 'staging',
      projectId: 'guardentra-staging',
      service: 'guardentra-staging',
      revision: 'guardentra-staging-00042-abc',
      sourceSha: 'abc123',
    });
  });

  it('falls back without inventing project/revision identity', () => {
    expect(
      buildReleaseIdentity({ NODE_ENV: 'development' } as NodeJS.ProcessEnv),
    ).toEqual({
      environment: 'development',
      projectId: null,
      service: null,
      revision: null,
      sourceSha: null,
    });
  });
});

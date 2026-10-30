import { describe, expect, it } from 'vitest';
import { resolveListenHost } from '../../server/lib/listenHost';

describe('resolveListenHost', () => {
  it('keeps production and the default server on all interfaces', () => {
    expect(resolveListenHost({ NODE_ENV: 'production' })).toBe('0.0.0.0');
    expect(resolveListenHost({ APP_ENV: 'staging', GUARDENTRA_LOCAL_DEMO: '1' })).toBe('0.0.0.0');
    expect(resolveListenHost({})).toBe('0.0.0.0');
  });

  it('binds the local demo to loopback only for demo-guardentra-local', () => {
    expect(
      resolveListenHost({
        NODE_ENV: 'development',
        GUARDENTRA_LOCAL_DEMO: '1',
        GCLOUD_PROJECT: 'demo-guardentra-local',
      }),
    ).toBe('127.0.0.1');
    expect(() =>
      resolveListenHost({
        NODE_ENV: 'development',
        GUARDENTRA_LOCAL_DEMO: '1',
        GCLOUD_PROJECT: 'guardentra-staging',
      }),
    ).toThrow(/refused/);
  });
});

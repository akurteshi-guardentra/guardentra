import { describe, expect, it } from 'vitest';
import {
  DEMO_ADMIN_STORAGE_BUCKET,
  DEMO_PROJECT_ID,
  adminAppOptions,
  assertAdminRuntimeConfig,
  getConfiguredStorageBucket,
  loadFirebaseAppletConfig,
  resolveAdminStorageBucket,
} from '../../server/lib/adminConfig';

const PROD_PROJECT = 'guardentra-prod';
const PROD_BUCKET = 'guardentra-prod.firebasestorage.app';
const STAGING_PROJECT = 'guardentra-staging';
const STAGING_BUCKET = 'guardentra-staging.firebasestorage.app';
const DEMO_APPLET = {
  projectId: DEMO_PROJECT_ID,
  storageBucket: DEMO_ADMIN_STORAGE_BUCKET,
};

function captureBucket(
  env: NodeJS.Dict<string | undefined>,
  applet = DEMO_APPLET
) {
  const calls: Array<string | undefined> = [];
  const bucket = getConfiguredStorageBucket(
    {
      bucket(name?: string) {
        if (!name) throw new Error('Bucket name not specified');
        calls.push(name);
        return { name };
      },
    },
    env,
    applet
  );
  return { calls, bucket };
}

describe('Admin Storage bucket configuration', () => {
  it('keeps committed demo applet fallback for local/development only', () => {
    expect(DEMO_ADMIN_STORAGE_BUCKET).toBe('guardentra-7f582.firebasestorage.app');
    expect(resolveAdminStorageBucket({ APP_ENV: 'development' }, DEMO_APPLET)).toBe(
      DEMO_ADMIN_STORAGE_BUCKET
    );

    const applet = loadFirebaseAppletConfig();
    expect(applet.projectId).toBe(DEMO_PROJECT_ID);
    expect(applet.storageBucket).toBe(DEMO_ADMIN_STORAGE_BUCKET);
    expect(adminAppOptions({ APP_ENV: 'development' }, applet)).toEqual({
      projectId: DEMO_PROJECT_ID,
      storageBucket: DEMO_ADMIN_STORAGE_BUCKET,
    });
  });

  it('uses explicit named production project and matching bucket', () => {
    const env = {
      APP_ENV: 'production',
      GCLOUD_PROJECT: PROD_PROJECT,
      FIREBASE_STORAGE_BUCKET: PROD_BUCKET,
    };
    expect(resolveAdminStorageBucket(env, DEMO_APPLET)).toBe(PROD_BUCKET);
    expect(adminAppOptions(env, DEMO_APPLET)).toEqual({
      projectId: PROD_PROJECT,
      storageBucket: PROD_BUCKET,
    });
  });

  it('uses explicit named staging project and matching bucket', () => {
    const env = {
      APP_ENV: 'staging',
      GCLOUD_PROJECT: STAGING_PROJECT,
      FIREBASE_STORAGE_BUCKET: STAGING_BUCKET,
    };
    expect(resolveAdminStorageBucket(env, DEMO_APPLET)).toBe(STAGING_BUCKET);
  });

  it('validates production-like config before server startup', () => {
    expect(() =>
      assertAdminRuntimeConfig(
        {
          APP_ENV: 'production',
          GCLOUD_PROJECT: PROD_PROJECT,
          FIREBASE_STORAGE_BUCKET: PROD_BUCKET,
        },
        DEMO_APPLET
      )
    ).not.toThrow();

    expect(() =>
      assertAdminRuntimeConfig(
        {
          APP_ENV: 'staging',
          GCLOUD_PROJECT: STAGING_PROJECT,
        },
        DEMO_APPLET
      )
    ).toThrow(/requires an explicit FIREBASE_STORAGE_BUCKET/i);

    expect(() =>
      assertAdminRuntimeConfig({ APP_ENV: 'development' }, DEMO_APPLET)
    ).not.toThrow();
  });

  it('fails closed when production-like runtime project is missing', () => {
    expect(() =>
      adminAppOptions(
        {
          APP_ENV: 'production',
          FIREBASE_STORAGE_BUCKET: PROD_BUCKET,
        },
        DEMO_APPLET
      )
    ).toThrow(/project is not configured for production-like runtime/i);
  });

  it('fails closed when production-like runtime bucket is missing', () => {
    expect(() =>
      resolveAdminStorageBucket(
        {
          APP_ENV: 'staging',
          GCLOUD_PROJECT: STAGING_PROJECT,
        },
        DEMO_APPLET
      )
    ).toThrow(/requires an explicit FIREBASE_STORAGE_BUCKET/i);
  });

  it('refuses the legacy demo project in production-like mode', () => {
    expect(() =>
      resolveAdminStorageBucket(
        {
          APP_ENV: 'production',
          GCLOUD_PROJECT: DEMO_PROJECT_ID,
          FIREBASE_STORAGE_BUCKET: DEMO_ADMIN_STORAGE_BUCKET,
        },
        DEMO_APPLET
      )
    ).toThrow(/cannot use demo\/legacy project/i);
  });

  it('fails closed when production-like bucket does not match runtime project', () => {
    expect(() =>
      resolveAdminStorageBucket(
        {
          APP_ENV: 'production',
          GCLOUD_PROJECT: PROD_PROJECT,
          FIREBASE_STORAGE_BUCKET: STAGING_BUCKET,
        },
        DEMO_APPLET
      )
    ).toThrow(/does not match the runtime project/i);
  });

  it('also refuses explicit cross-project buckets outside production-like mode', () => {
    expect(() =>
      resolveAdminStorageBucket(
        {
          APP_ENV: 'development',
          GCLOUD_PROJECT: STAGING_PROJECT,
          FIREBASE_STORAGE_BUCKET: DEMO_ADMIN_STORAGE_BUCKET,
        },
        DEMO_APPLET
      )
    ).toThrow(/does not match the runtime project/i);
  });

  it('always passes the explicit named bucket to Admin Storage', () => {
    const production = captureBucket(
      {
        APP_ENV: 'production',
        GCLOUD_PROJECT: PROD_PROJECT,
        FIREBASE_STORAGE_BUCKET: PROD_BUCKET,
      },
      DEMO_APPLET
    );
    expect(production.calls).toEqual([PROD_BUCKET]);
    expect(production.bucket).toEqual({ name: PROD_BUCKET });

    const staging = captureBucket(
      {
        APP_ENV: 'staging',
        GCLOUD_PROJECT: STAGING_PROJECT,
        FIREBASE_STORAGE_BUCKET: STAGING_BUCKET,
      },
      DEMO_APPLET
    );
    expect(staging.calls).toEqual([STAGING_BUCKET]);
    expect(staging.bucket).toEqual({ name: STAGING_BUCKET });
  });
});

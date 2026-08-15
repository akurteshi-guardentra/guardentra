import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_STORAGE_BUCKET,
  PRODUCTION_PROJECT_ID,
  adminAppOptions,
  getConfiguredStorageBucket,
  loadFirebaseAppletConfig,
  resolveAdminStorageBucket,
} from '../../server/lib/adminConfig';

const LIVE_BUCKET = 'guardentra-7f582.firebasestorage.app';
const STAGING_PROJECT = 'some-staging-project';
const STAGING_BUCKET = 'some-staging-project.firebasestorage.app';
const PRODUCTION_APPLET = {
  projectId: PRODUCTION_PROJECT_ID,
  storageBucket: LIVE_BUCKET,
};

function captureBucket(env: NodeJS.Dict<string | undefined>, applet = PRODUCTION_APPLET) {
  const calls: Array<string | undefined> = [];
  const bucket = getConfiguredStorageBucket(
    {
      bucket(name?: string) {
        if (!name) {
          throw new Error('Bucket name not specified');
        }
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
  it('production project resolves the production-equivalent bucket', () => {
    expect(DEFAULT_ADMIN_STORAGE_BUCKET).toBe(LIVE_BUCKET);
    expect(
      resolveAdminStorageBucket(
        { GCLOUD_PROJECT: PRODUCTION_PROJECT_ID },
        PRODUCTION_APPLET
      )
    ).toBe(LIVE_BUCKET);
    expect(
      resolveAdminStorageBucket(
        {
          GCLOUD_PROJECT: PRODUCTION_PROJECT_ID,
          FIREBASE_STORAGE_BUCKET: undefined,
          VITE_FIREBASE_STORAGE_BUCKET: undefined,
        },
        {}
      )
    ).toBe(LIVE_BUCKET);
  });

  it('explicit staging bucket resolves the staging bucket', () => {
    expect(
      resolveAdminStorageBucket(
        {
          GCLOUD_PROJECT: STAGING_PROJECT,
          FIREBASE_STORAGE_BUCKET: STAGING_BUCKET,
        },
        PRODUCTION_APPLET
      )
    ).toBe(STAGING_BUCKET);
  });

  it('prefers FIREBASE_STORAGE_BUCKET over VITE_FIREBASE_STORAGE_BUCKET', () => {
    expect(
      resolveAdminStorageBucket(
        {
          GCLOUD_PROJECT: STAGING_PROJECT,
          FIREBASE_STORAGE_BUCKET: STAGING_BUCKET,
          VITE_FIREBASE_STORAGE_BUCKET: LIVE_BUCKET,
        },
        PRODUCTION_APPLET
      )
    ).toBe(STAGING_BUCKET);
  });

  it('throws when runtime project mismatches production applet config', () => {
    expect(() =>
      resolveAdminStorageBucket(
        {
          GCLOUD_PROJECT: STAGING_PROJECT,
          FIREBASE_STORAGE_BUCKET: undefined,
          VITE_FIREBASE_STORAGE_BUCKET: undefined,
        },
        PRODUCTION_APPLET
      )
    ).toThrow(/Refusing to use guardentra-7f582\.firebasestorage\.app/);
  });

  it('does not fall back to the production bucket for another project', () => {
    expect(() =>
      resolveAdminStorageBucket(
        { GOOGLE_CLOUD_PROJECT: STAGING_PROJECT },
        {}
      )
    ).toThrow(/not configured for project "some-staging-project"/);

    expect(() =>
      resolveAdminStorageBucket(
        {
          GCLOUD_PROJECT: STAGING_PROJECT,
          FIREBASE_STORAGE_BUCKET: LIVE_BUCKET,
        },
        PRODUCTION_APPLET
      )
    ).toThrow(/production-equivalent bucket/);
  });

  it('uses committed applet config locally when no runtime project is set', () => {
    expect(resolveAdminStorageBucket({}, PRODUCTION_APPLET)).toBe(LIVE_BUCKET);
    const applet = loadFirebaseAppletConfig();
    expect(applet.storageBucket).toBe(LIVE_BUCKET);
    expect(resolveAdminStorageBucket({}, applet)).toBe(LIVE_BUCKET);
    expect(adminAppOptions({}, applet).storageBucket).toBe(LIVE_BUCKET);
    expect(adminAppOptions({}, applet).projectId).toBe(PRODUCTION_PROJECT_ID);
  });

  it('builds Admin init options with an explicit storageBucket for production', () => {
    const options = adminAppOptions(
      { GCLOUD_PROJECT: PRODUCTION_PROJECT_ID },
      { projectId: 'ignored-when-runtime-set', storageBucket: LIVE_BUCKET }
    );
    expect(options.storageBucket).toBe(LIVE_BUCKET);
    expect(options.projectId).toBe(PRODUCTION_PROJECT_ID);
  });

  it('always passes an explicit bucket name to Admin Storage', () => {
    const production = captureBucket({ GCLOUD_PROJECT: PRODUCTION_PROJECT_ID });
    expect(production.calls).toEqual([LIVE_BUCKET]);
    expect(production.bucket).toEqual({ name: LIVE_BUCKET });

    const staging = captureBucket(
      {
        GCLOUD_PROJECT: STAGING_PROJECT,
        FIREBASE_STORAGE_BUCKET: STAGING_BUCKET,
      },
      PRODUCTION_APPLET
    );
    expect(staging.calls).toEqual([STAGING_BUCKET]);
    expect(staging.bucket).toEqual({ name: STAGING_BUCKET });
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_STORAGE_BUCKET,
  adminAppOptions,
  getConfiguredStorageBucket,
  loadFirebaseAppletConfig,
  resolveAdminStorageBucket,
} from '../../server/lib/adminConfig';

const LIVE_BUCKET = 'guardentra-7f582.firebasestorage.app';

describe('Admin Storage bucket configuration', () => {
  it('defaults to the production-equivalent Storage bucket', () => {
    expect(DEFAULT_ADMIN_STORAGE_BUCKET).toBe(LIVE_BUCKET);
    expect(
      resolveAdminStorageBucket(
        { FIREBASE_STORAGE_BUCKET: undefined, VITE_FIREBASE_STORAGE_BUCKET: undefined },
        {}
      )
    ).toBe(LIVE_BUCKET);
  });

  it('uses applet storageBucket when env is unset', () => {
    expect(
      resolveAdminStorageBucket(
        {},
        { storageBucket: 'guardentra-7f582.firebasestorage.app' }
      )
    ).toBe(LIVE_BUCKET);
  });

  it('prefers FIREBASE_STORAGE_BUCKET over applet config', () => {
    expect(
      resolveAdminStorageBucket(
        { FIREBASE_STORAGE_BUCKET: 'other-project.firebasestorage.app' },
        { storageBucket: LIVE_BUCKET }
      )
    ).toBe('other-project.firebasestorage.app');
  });

  it('builds Admin init options with an explicit storageBucket', () => {
    const options = adminAppOptions(
      { GCLOUD_PROJECT: 'guardentra-7f582' },
      { projectId: 'ignored', storageBucket: LIVE_BUCKET }
    );
    expect(options.storageBucket).toBe(LIVE_BUCKET);
    expect(options.projectId).toBe('guardentra-7f582');
  });

  it('reads applet config from the working tree when env overrides are empty', () => {
    const applet = loadFirebaseAppletConfig();
    expect(applet.storageBucket).toBe(LIVE_BUCKET);
    expect(resolveAdminStorageBucket({}, applet)).toBe(LIVE_BUCKET);
    expect(adminAppOptions({}, applet).storageBucket).toBe(LIVE_BUCKET);
  });

  it('requires an explicit bucket name instead of getStorage().bucket() with no args', () => {
    const calls: Array<string | undefined> = [];
    const bucket = getConfiguredStorageBucket({
      bucket(name?: string) {
        if (!name) {
          throw new Error('Bucket name not specified');
        }
        calls.push(name);
        return { name };
      },
    });
    expect(calls).toEqual([LIVE_BUCKET]);
    expect(bucket).toEqual({ name: LIVE_BUCKET });
  });
});

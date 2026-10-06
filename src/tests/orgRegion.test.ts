import { describe, expect, it } from 'vitest';
import {
  assertDataRegionImmutable,
  isDataRegion,
  parseDataRegion,
} from '../lib/orgRegion';
import {
  assertRegionIsolation,
  rejectClientRegionOverride,
  resolveRegionBinding,
} from '../../server/lib/regionRouter';

const DEV_ENV = { APP_ENV: 'development' };
const PROD_US_ENV = {
  APP_ENV: 'production',
  GCLOUD_PROJECT: 'guardentra-prod',
  FIREBASE_STORAGE_BUCKET: 'guardentra-prod.firebasestorage.app',
};
const STAGING_US_ENV = {
  APP_ENV: 'staging',
  GCLOUD_PROJECT: 'guardentra-staging',
  FIREBASE_STORAGE_BUCKET: 'guardentra-staging.firebasestorage.app',
};

describe('P2B dataRegion helpers', () => {
  it('parses eu/us only', () => {
    expect(isDataRegion('eu')).toBe(true);
    expect(isDataRegion('us')).toBe(true);
    expect(isDataRegion('ap')).toBe(false);
    expect(parseDataRegion('eu')).toBe('eu');
    expect(parseDataRegion('nope', 'us')).toBe('us');
  });

  it('makes dataRegion immutable after first set', () => {
    expect(assertDataRegionImmutable(undefined, 'eu').ok).toBe(true);
    expect(assertDataRegionImmutable('eu', 'eu').ok).toBe(true);
    expect(assertDataRegionImmutable('eu', 'us').ok).toBe(false);
    expect(assertDataRegionImmutable('us', null).ok).toBe(false);
  });
});

describe('P2B region router isolation', () => {
  it('keeps local/demo bindings distinct for development', () => {
    const eu = resolveRegionBinding('eu', DEV_ENV);
    const us = resolveRegionBinding('us', DEV_ENV);
    expect(eu.region).toBe('eu');
    expect(us.region).toBe('us');
    expect(eu.firebaseProjectId).not.toBe(us.firebaseProjectId);
  });

  it('resolves named US production and staging bindings explicitly', () => {
    expect(resolveRegionBinding('us', PROD_US_ENV)).toEqual({
      region: 'us',
      firebaseProjectId: 'guardentra-prod',
      storageBucket: 'guardentra-prod.firebasestorage.app',
    });
    expect(resolveRegionBinding('us', STAGING_US_ENV)).toEqual({
      region: 'us',
      firebaseProjectId: 'guardentra-staging',
      storageBucket: 'guardentra-staging.firebasestorage.app',
    });
  });

  it('fails closed when production-like US binding is incomplete', () => {
    expect(() =>
      resolveRegionBinding('us', {
        APP_ENV: 'production',
        FIREBASE_STORAGE_BUCKET: 'guardentra-prod.firebasestorage.app',
      })
    ).toThrow(/binding is incomplete/i);

    expect(() =>
      resolveRegionBinding('us', {
        APP_ENV: 'production',
        GCLOUD_PROJECT: 'guardentra-prod',
      })
    ).toThrow(/binding is incomplete/i);
  });

  it('refuses legacy demo binding in production-like mode', () => {
    expect(() =>
      resolveRegionBinding('us', {
        APP_ENV: 'production',
        GCLOUD_PROJECT: 'guardentra-7f582',
        FIREBASE_STORAGE_BUCKET: 'guardentra-7f582.firebasestorage.app',
      })
    ).toThrow(/cannot use demo\/pending resources/i);
  });

  it('requires explicit EU residency project and bucket in production-like mode', () => {
    expect(() => resolveRegionBinding('eu', PROD_US_ENV)).toThrow(/binding is incomplete/i);

    expect(
      resolveRegionBinding('eu', {
        ...PROD_US_ENV,
        FIREBASE_PROJECT_ID_EU: 'guardentra-prod-eu',
        FIREBASE_STORAGE_BUCKET_EU: 'guardentra-prod-eu.firebasestorage.app',
      })
    ).toEqual({
      region: 'eu',
      firebaseProjectId: 'guardentra-prod-eu',
      storageBucket: 'guardentra-prod-eu.firebasestorage.app',
    });
  });

  it('forbids EU org from requesting US binding', () => {
    const denied = assertRegionIsolation('eu', 'us', DEV_ENV);
    expect(denied.ok).toBe(false);
    const allowed = assertRegionIsolation('eu', 'eu', DEV_ENV);
    expect(allowed.ok).toBe(true);
  });

  it('rejects client region override that disagrees with org', () => {
    expect(rejectClientRegionOverride('us', 'eu').ok).toBe(false);
    expect(rejectClientRegionOverride('us', 'us').ok).toBe(true);
    expect(rejectClientRegionOverride('us', null).ok).toBe(true);
  });
});

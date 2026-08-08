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
  it('resolves bindings from trusted org region only', () => {
    const eu = resolveRegionBinding('eu');
    const us = resolveRegionBinding('us');
    expect(eu.region).toBe('eu');
    expect(us.region).toBe('us');
    expect(eu.firebaseProjectId).not.toBe(us.firebaseProjectId);
  });

  it('forbids EU org from requesting US binding', () => {
    const denied = assertRegionIsolation('eu', 'us');
    expect(denied.ok).toBe(false);
    const allowed = assertRegionIsolation('eu', 'eu');
    expect(allowed.ok).toBe(true);
  });

  it('rejects client region override that disagrees with org', () => {
    expect(rejectClientRegionOverride('us', 'eu').ok).toBe(false);
    expect(rejectClientRegionOverride('us', 'us').ok).toBe(true);
    expect(rejectClientRegionOverride('us', null).ok).toBe(true);
  });
});

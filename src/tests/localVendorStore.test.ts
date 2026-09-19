import { beforeEach, describe, expect, it } from 'vitest';
import {
  HOSTED_ASSESSMENT_SAVE_FAILED,
  HOSTED_VENDOR_SAVE_FAILED,
  createLocalVendor,
  isFirestoreUnavailableError,
  listLocalVendors,
  mayCreateLocalAssessment,
  mayFallbackAssessmentCreateToLocal,
  mayFallbackVendorCreateToLocal,
  removeLocalVendor,
  replaceLocalVendors,
  shouldUseLocalPersistenceFallback,
} from '../lib/vendor/localVendorStore';

describe('localVendorStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and lists vendors per org', () => {
    createLocalVendor('org1', {
      name: 'Acme',
      category: 'SaaS',
      criticality: 'High',
      primaryContactEmail: 'a@b.com',
    });
    createLocalVendor('org2', {
      name: 'Other',
      category: 'IT Services',
      criticality: 'Low',
    });
    expect(listLocalVendors('org1')).toHaveLength(1);
    expect(listLocalVendors('org1')[0].name).toBe('Acme');
    expect(listLocalVendors('org2')[0].name).toBe('Other');
  });

  it('imports many vendors without collision', () => {
    for (let i = 0; i < 50; i++) {
      createLocalVendor('orgX', {
        name: `Bulk ${i}`,
        category: 'SaaS',
        criticality: 'Medium',
      });
    }
    expect(listLocalVendors('orgX')).toHaveLength(50);
  });

  it('detects firestore unavailable errors', () => {
    expect(isFirestoreUnavailableError(new Error("Database '(default)' not found"))).toBe(true);
    expect(isFirestoreUnavailableError({ code: 'unavailable', message: 'x' })).toBe(true);
    expect(isFirestoreUnavailableError(new Error('Cloud write timed out'))).toBe(true);
    expect(isFirestoreUnavailableError(new Error('permission-denied'))).toBe(false);
  });

  it('disables local persistence fallback on hosted project ids', () => {
    expect(shouldUseLocalPersistenceFallback('guardentra-staging')).toBe(false);
    expect(shouldUseLocalPersistenceFallback('guardentra-prod')).toBe(false);
    expect(shouldUseLocalPersistenceFallback('guardentra-7f582')).toBe(true);
    expect(shouldUseLocalPersistenceFallback('')).toBe(true);
    expect(shouldUseLocalPersistenceFallback('demo-guardentra')).toBe(true);
  });

  it('refuses hosted vendor/assessment fallback after timeout or rejection', () => {
    const timeout = new Error('Cloud write timed out');
    (timeout as { code?: string }).code = 'unavailable';
    const rejected = { code: 'unavailable', message: 'backend unavailable' };
    expect(mayFallbackVendorCreateToLocal(timeout, 'guardentra-staging')).toBe(false);
    expect(mayFallbackVendorCreateToLocal(rejected, 'guardentra-prod')).toBe(false);
    expect(mayFallbackAssessmentCreateToLocal(timeout, 'guardentra-staging')).toBe(false);
    expect(mayCreateLocalAssessment('local', 'cloud_v1', 'guardentra-prod')).toBe(false);
    expect(mayCreateLocalAssessment('firestore', 'local_abc', 'guardentra-staging')).toBe(false);
    expect(HOSTED_VENDOR_SAVE_FAILED).toMatch(/was not saved/i);
    expect(HOSTED_ASSESSMENT_SAVE_FAILED).toMatch(/was not saved/i);
  });

  it('keeps local/demo fallback for non-hosted timeout and local vendor ids', () => {
    const timeout = new Error('Cloud write timed out');
    (timeout as { code?: string }).code = 'unavailable';
    expect(mayFallbackVendorCreateToLocal(timeout, 'guardentra-7f582')).toBe(true);
    expect(mayFallbackAssessmentCreateToLocal(timeout, '')).toBe(true);
    expect(mayCreateLocalAssessment('local', 'cloud_v1', 'guardentra-7f582')).toBe(true);
    expect(mayCreateLocalAssessment('firestore', 'local_abc', '')).toBe(true);
  });

  it('replaceLocalVendors overwrites org slice', () => {
    createLocalVendor('orgZ', { name: 'A', category: 'SaaS', criticality: 'Low' });
    replaceLocalVendors('orgZ', []);
    expect(listLocalVendors('orgZ')).toEqual([]);
  });

  it('removeLocalVendor drops only the promoted row, leaving other org vendors intact', () => {
    const promoted = createLocalVendor('orgP', { name: 'Promoted Co', category: 'SaaS', criticality: 'High' });
    createLocalVendor('orgP', { name: 'Still Local Co', category: 'IT Services', criticality: 'Low' });
    expect(listLocalVendors('orgP')).toHaveLength(2);

    removeLocalVendor('orgP', promoted.id);

    const remaining = listLocalVendors('orgP');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Still Local Co');
  });
});

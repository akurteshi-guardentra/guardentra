import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalVendor,
  isFirestoreUnavailableError,
  listLocalVendors,
  replaceLocalVendors,
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
    expect(isFirestoreUnavailableError(new Error('permission-denied'))).toBe(false);
  });

  it('replaceLocalVendors overwrites org slice', () => {
    createLocalVendor('orgZ', { name: 'A', category: 'SaaS', criticality: 'Low' });
    replaceLocalVendors('orgZ', []);
    expect(listLocalVendors('orgZ')).toEqual([]);
  });
});

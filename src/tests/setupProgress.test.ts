import { describe, expect, it } from 'vitest';
import {
  deriveSetupChecklist,
  isOrganizationProfileComplete,
  isSetupChecklistComplete,
} from '../lib/setupProgress';
import { isProfileBootstrapped } from '../lib/bootstrapGate';

describe('bootstrapGate (#67)', () => {
  it('requires a non-empty organizationId (no tenant bypass)', () => {
    expect(isProfileBootstrapped(null)).toBe(false);
    expect(isProfileBootstrapped({})).toBe(false);
    expect(isProfileBootstrapped({ organizationId: '  ' })).toBe(false);
    expect(isProfileBootstrapped({ organizationId: 'org_abc' })).toBe(true);
  });
});

describe('setupProgress checklist (#67)', () => {
  it('derives incomplete checklist from empty real state', () => {
    const items = deriveSetupChecklist({
      org: { name: "Admin's Organization", autoCreated: true },
      vendorCount: 0,
      assessmentCount: 0,
      pendingTeammateInviteCount: 0,
      role: 'admin',
    });
    expect(items.find((i) => i.id === 'firstVendor')?.done).toBe(false);
    expect(items.find((i) => i.id === 'firstVendor')?.primary).toBe(true);
    expect(items.find((i) => i.id === 'organizationProfile')?.done).toBe(false);
    expect(items.find((i) => i.id === 'inviteTeammate')?.visible).toBe(true);
    expect(isSetupChecklistComplete(items)).toBe(false);
  });

  it('marks organization profile complete only when name + industry exist', () => {
    expect(isOrganizationProfileComplete({ name: 'Acme', industry: '' })).toBe(false);
    expect(isOrganizationProfileComplete({ name: 'Acme', industry: 'SaaS' })).toBe(true);
  });

  it('vendor creation advances first-vendor setup state', () => {
    const before = deriveSetupChecklist({
      org: { name: 'Acme', industry: 'SaaS', frameworkPackDefaults: { iso27001: 'pack_1' } },
      vendorCount: 0,
      assessmentCount: 0,
      pendingTeammateInviteCount: 0,
      role: 'admin',
    });
    expect(before.find((i) => i.id === 'firstVendor')?.done).toBe(false);

    const after = deriveSetupChecklist({
      org: { name: 'Acme', industry: 'SaaS', frameworkPackDefaults: { iso27001: 'pack_1' } },
      vendorCount: 1,
      assessmentCount: 0,
      pendingTeammateInviteCount: 0,
      role: 'admin',
    });
    expect(after.find((i) => i.id === 'firstVendor')?.done).toBe(true);
    expect(after.find((i) => i.id === 'firstVendor')?.primary).toBeFalsy();
  });

  it('hides invite teammate for non-admin members', () => {
    const items = deriveSetupChecklist({
      org: { name: 'Acme', industry: 'SaaS' },
      vendorCount: 1,
      assessmentCount: 1,
      pendingTeammateInviteCount: 0,
      role: 'member',
    });
    expect(items.find((i) => i.id === 'inviteTeammate')).toBeUndefined();
  });

  it('incomplete optional setup does not claim completion', () => {
    const items = deriveSetupChecklist({
      org: { name: 'Acme', industry: 'SaaS' },
      vendorCount: 0,
      assessmentCount: 0,
      pendingTeammateInviteCount: 0,
      role: 'admin',
    });
    expect(isSetupChecklistComplete(items)).toBe(false);
  });
});

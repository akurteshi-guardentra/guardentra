import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalAssessment,
  deriveStatusFromAssessments,
  listLocalAssessments,
  listLocalAssessmentsForVendor,
  removeLocalAssessment,
  replaceLocalAssessments,
} from '../lib/vendor/localAssessmentStore';
import {
  createLocalVendor,
  listLocalVendors,
  markLocalVendorAssessmentStarted,
  replaceLocalVendors,
} from '../lib/vendor/localVendorStore';

describe('local assessment store + vendor correlation', () => {
  const orgId = 'org-test-corr';

  beforeEach(() => {
    replaceLocalVendors(orgId, []);
    replaceLocalAssessments(orgId, []);
  });

  it('creates assessments linked to a vendor', () => {
    const vendor = createLocalVendor(orgId, {
      name: 'Acme Link Co',
      category: 'SaaS',
      criticality: 'High',
    });
    const branded = createLocalAssessment(orgId, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      frameworks: ['soc2'],
      requesterOrgName: 'Acme Buyer',
      requesterLogoUrl: 'https://cdn.example.com/logo.png',
    });
    expect(branded.requesterOrgName).toBe('Acme Buyer');
    expect(branded.requesterLogoUrl).toBe('https://cdn.example.com/logo.png');

    const asm = createLocalAssessment(orgId, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      frameworks: ['soc2'],
      frameworkName: 'SOC 2',
    });
    expect(asm.vendorId).toBe(vendor.id);
    expect(listLocalAssessments(orgId)).toHaveLength(2);
    expect(listLocalAssessmentsForVendor(orgId, vendor.id)).toHaveLength(2);
  });

  it('marks vendor assessment status when assessment is sent', () => {
    const vendor = createLocalVendor(orgId, {
      name: 'Status Co',
      category: 'Cloud Services',
      criticality: 'Medium',
    });
    expect(vendor.assessmentStatus).toBe('Not Started');
    markLocalVendorAssessmentStarted(orgId, vendor.id);
    const updated = listLocalVendors(orgId).find((v) => v.id === vendor.id);
    expect(updated?.assessmentStatus).toBe('Sent');
    expect(updated?.lastAssessmentAt).toBeTruthy();
  });

  it('derives directory chip status from linked assessments', () => {
    expect(deriveStatusFromAssessments([])).toBeUndefined();
    expect(deriveStatusFromAssessments([{ status: 'Sent', progressPct: 0 }])).toBe('Sent');
    expect(
      deriveStatusFromAssessments([
        { status: 'Sent', progressPct: 0 },
        { status: 'Sent', progressPct: 0 },
      ])
    ).toBe('Sent');
    expect(
      deriveStatusFromAssessments([
        { status: 'Completed', progressPct: 100 },
        { status: 'Sent', progressPct: 0 },
      ])
    ).toBe('Sent');
    expect(
      deriveStatusFromAssessments([
        { status: 'Sent', progressPct: 0 },
        { status: 'In Progress', progressPct: 40 },
      ])
    ).toBe('In Progress');
    expect(
      deriveStatusFromAssessments([
        { status: 'Completed', progressPct: 100 },
        { status: 'Completed', progress: 100 },
      ])
    ).toBe('Completed');
    expect(deriveStatusFromAssessments([{ status: 'Overdue', progressPct: 10 }])).toBe('Overdue');
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      deriveStatusFromAssessments([{ status: 'Sent', progressPct: 0, dueAt: past }])
    ).toBe('Overdue');
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      deriveStatusFromAssessments([{ status: 'Sent', progressPct: 0, dueAt: inThreeDays }])
    ).toBe('Due Soon');
    const inThreeWeeks = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      deriveStatusFromAssessments([{ status: 'Sent', progressPct: 0, dueAt: inThreeWeeks }])
    ).toBe('Sent');
    expect(
      deriveStatusFromAssessments([{ status: 'Under Review', progressPct: 100 }])
    ).toBe('Under Review');
  });

  it('removeLocalAssessment drops only the promoted row (used when Firestore reconnects)', () => {
    const vendor = createLocalVendor(orgId, { name: 'Promo Co', category: 'SaaS', criticality: 'High' });
    const promoted = createLocalAssessment(orgId, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      frameworks: ['soc2'],
    });
    createLocalAssessment(orgId, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      frameworks: ['iso27001'],
    });
    expect(listLocalAssessments(orgId)).toHaveLength(2);

    removeLocalAssessment(orgId, promoted.id);

    const remaining = listLocalAssessments(orgId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).not.toBe(promoted.id);
  });
});

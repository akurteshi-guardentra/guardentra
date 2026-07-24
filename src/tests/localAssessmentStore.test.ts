import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLocalAssessment,
  deriveStatusFromAssessments,
  listLocalAssessments,
  listLocalAssessmentsForVendor,
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
    const asm = createLocalAssessment(orgId, {
      vendorId: vendor.id,
      vendorName: vendor.name,
      frameworks: ['soc2'],
      frameworkName: 'SOC 2',
    });
    expect(asm.vendorId).toBe(vendor.id);
    expect(listLocalAssessments(orgId)).toHaveLength(1);
    expect(listLocalAssessmentsForVendor(orgId, vendor.id)).toHaveLength(1);
  });

  it('marks vendor assessment status when assessment starts', () => {
    const vendor = createLocalVendor(orgId, {
      name: 'Status Co',
      category: 'Cloud Services',
      criticality: 'Medium',
    });
    expect(vendor.assessmentStatus).toBe('Not Started');
    markLocalVendorAssessmentStarted(orgId, vendor.id);
    const updated = listLocalVendors(orgId).find((v) => v.id === vendor.id);
    expect(updated?.assessmentStatus).toBe('In Progress');
    expect(updated?.lastAssessmentAt).toBeTruthy();
  });

  it('derives directory chip status from linked assessments', () => {
    expect(deriveStatusFromAssessments([])).toBeUndefined();
    expect(deriveStatusFromAssessments([{ status: 'Sent', progressPct: 0 }])).toBe('In Progress');
    expect(
      deriveStatusFromAssessments([
        { status: 'Completed', progressPct: 100 },
        { status: 'Sent', progressPct: 0 },
      ])
    ).toBe('In Progress');
    expect(
      deriveStatusFromAssessments([
        { status: 'Completed', progressPct: 100 },
        { status: 'Completed', progress: 100 },
      ])
    ).toBe('Completed');
    expect(deriveStatusFromAssessments([{ status: 'Overdue', progressPct: 10 }])).toBe('Overdue');
  });
});

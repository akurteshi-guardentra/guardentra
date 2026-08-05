import { beforeEach, describe, expect, it } from 'vitest';
import {
  syncVendorAfterAssessmentApprove,
  syncVendorAfterAssessmentCreate,
  syncVendorAfterAssessmentProgress,
  syncVendorAfterAssessmentSubmit,
} from '../lib/vendor/syncVendorAssessment';
import {
  createLocalVendor,
  listLocalVendors,
  replaceLocalVendors,
} from '../lib/vendor/localVendorStore';
import { deriveStatusFromAssessments } from '../lib/vendor/localAssessmentStore';
import {
  buildArchiveEmptyAssessmentPatch,
  buildRecoverEmptyAssessmentPatch,
} from '../lib/vendor/emptyAssessmentRecovery';

/**
 * Local-prefer lifecycle coverage for the audit residuals that aren't full
 * portal/tracker UI integration tests: create → progress → submit → decide,
 * plus empty-snapshot recovery/archive patches composing cleanly with status chips.
 */
describe('vendor assessment status lifecycle (local prefer)', () => {
  const orgId = 'org-lifecycle';

  beforeEach(() => {
    replaceLocalVendors(orgId, []);
  });

  it('moves vendor chip Sent → In Progress → Under Review → Completed', async () => {
    const vendor = createLocalVendor(orgId, {
      name: 'Lifecycle Co',
      category: 'SaaS',
      criticality: 'High',
    });

    await syncVendorAfterAssessmentCreate(orgId, vendor.id, true);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Sent');

    await syncVendorAfterAssessmentProgress(orgId, vendor.id, true);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('In Progress');

    await syncVendorAfterAssessmentSubmit(orgId, vendor.id, true);
    expect(listLocalVendors(orgId)[0]?.assessmentStatus).toBe('Under Review');

    const nextReview = new Date();
    nextReview.setFullYear(nextReview.getFullYear() + 1);
    await syncVendorAfterAssessmentApprove(orgId, vendor.id, true, nextReview.toISOString());
    const closed = listLocalVendors(orgId)[0];
    expect(closed?.assessmentStatus).toBe('Completed');
    expect(closed?.nextReviewAt).toBe(nextReview.toISOString());
  });

  it('keeps Under Review badge when progress is 100 (portal submit shape)', () => {
    expect(
      deriveStatusFromAssessments([{ status: 'Under Review', progressPct: 100 }])
    ).toBe('Under Review');
  });

  it('recovery patch restores a usable Sent-ready questionnaire; archive closes chips', () => {
    const recovered = buildRecoverEmptyAssessmentPatch({
      frameworks: ['soc2'],
      questions: [],
    });
    expect(recovered.questions.length).toBeGreaterThan(0);
    expect(recovered.portalOpen).toBe(true);
    // After rebuild the row stays Sent/In Progress from its prior status; chip
    // derivation should not treat empty progress as Completed.
    expect(
      deriveStatusFromAssessments([{ status: 'Sent', progressPct: recovered.progressPct }])
    ).toBe('Sent');

    const archived = buildArchiveEmptyAssessmentPatch({
      reason: 'No packs — custom-only legacy',
      archivedBy: 'admin@example.com',
    });
    expect(
      deriveStatusFromAssessments([
        { status: archived.status, progressPct: archived.progressPct },
      ])
    ).toBe('Completed');
  });
});

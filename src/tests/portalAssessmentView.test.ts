// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildPortalAssessmentView, hasPrivateReviewerFields, portalAssessmentReadable } from '../../server/lib/portalAssessmentView';

describe('#124 finite vendor projection for historical records', () => {
  it('retains vendor work/receipt fields and omits reviewer and unknown fields', () => {
    const source = {
      vendorName: 'Vendor', status: 'Completed', decisionOutcome: 'approved',
      completedAt: '2026-11-01T00:00:00Z', organizationId: 'org-1',
      decisionNotes: 'secret', decidedBy: 'secret', decidedByName: 'secret',
      residualRiskLevel: 'secret', remediationOwner: 'secret', futureInternalField: 'secret',
      submittedSnapshot: { decisionNotes: 'secret' },
      questions: [{ id: 'q1', question: 'MFA?', required: true, decisionNotes: 'secret' }],
      answers: { q1: 'Yes' }, comments: { q1: 'Vendor comment' },
      evidenceByQuestion: { q1: [{ fileName: 'policy.pdf', storagePath: 'portal/a/policy.pdf', downloadUrl: 'secret' }] },
      evidenceTrustByStoragePath: { file: { state: 'clean', generation: '1', privateMetadata: 'secret',
        scanner: { engine: 'engine', verdict: 'clean', scannedAt: 'time', privateMetadata: 'secret' } } },
    };
    const view = buildPortalAssessmentView(source);
    expect(view).toMatchObject({ vendorName: 'Vendor', status: 'Completed', decisionOutcome: 'approved',
      answers: { q1: 'Yes' }, comments: { q1: 'Vendor comment' } });
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(source.decisionNotes).toBe('secret');
    expect(view.questions).toEqual([{ id: 'q1', question: 'MFA?', required: true }]);
  });
  it('normalizes Firestore timestamps without inventing missing timestamps', () => {
    expect(buildPortalAssessmentView({ completedAt: { toDate: () => new Date('2026-01-01T00:00:00Z') } })
      .completedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(buildPortalAssessmentView({ status: 'Completed' })).not.toHaveProperty('completedAt');
  });
  it('detects private-key presence even for null historical values', () => {
    expect(hasPrivateReviewerFields({ decisionNotes: null })).toBe(true);
    expect(hasPrivateReviewerFields({ status: 'Completed' })).toBe(false);
  });
  it('preserves readable receipts but refuses a closed, never-submitted assessment', () => {
    expect(portalAssessmentReadable({ portalOpen: true })).toBe(true);
    expect(portalAssessmentReadable({ status: 'Completed', portalOpen: false })).toBe(true);
    expect(portalAssessmentReadable({ status: 'Not Started', portalOpen: false })).toBe(false);
  });
});

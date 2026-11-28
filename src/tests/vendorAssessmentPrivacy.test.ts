import { describe, expect, it } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import {
  isFirestoreDeleteSentinel,
  toFirestoreAssessmentUpdate,
} from '../../server/lib/evidenceAccess';
import { partitionVendorAssessmentPatch } from '../lib/vendor/vendorAssessmentPrivacy';

describe('#124 vendor-safe assessment projection', () => {
  it('keeps the receipt outcome on the assessment and moves reviewer fields off it', () => {
    const patch = {
      decisionOutcome: 'conditional',
      decidedAt: '2026-11-24T12:00:00.000Z',
      status: 'Completed',
      portalOpen: false,
      decisionNotes: 'internal only',
      decidedBy: 'reviewer-1',
      decidedByName: 'Reviewer <r@org.example>',
      residualRiskLevel: 'High',
      remediationOwner: 'Security',
      remediationDueAt: '2026-12-31T00:00:00.000Z',
    };
    const { publicPatch, privatePatch, hasPrivate } = partitionVendorAssessmentPatch(patch);
    expect(hasPrivate).toBe(true);
    expect(publicPatch.decisionOutcome).toBe('conditional');
    expect(publicPatch.remediationDueAt).toBe('2026-12-31T00:00:00.000Z');
    expect(privatePatch).toMatchObject({
      decisionNotes: 'internal only',
      decidedBy: 'reviewer-1',
      decidedByName: 'Reviewer <r@org.example>',
      residualRiskLevel: 'High',
      remediationOwner: 'Security',
    });

    const update = toFirestoreAssessmentUpdate(publicPatch);
    for (const key of [
      'decisionNotes',
      'decidedBy',
      'decidedByName',
      'residualRiskLevel',
      'remediationOwner',
    ]) {
      expect(isFirestoreDeleteSentinel(update[key])).toBe(true);
      expect(update[key]).not.toBe(patch[key as keyof typeof patch]);
    }
    expect(update.decisionOutcome).toBe('conditional');
    expect(update.remediationDueAt).toBe('2026-12-31T00:00:00.000Z');
    expect(FieldValue.delete()).toBeTruthy();
  });

  it('does not touch the reviewer record for a portal answer save', () => {
    const split = partitionVendorAssessmentPatch({
      answers: { q1: 'Yes' },
      status: 'In Progress',
    });
    expect(split.hasPrivate).toBe(false);
    expect(split.privatePatch).toEqual({});
    expect(split.publicPatch).toEqual({ answers: { q1: 'Yes' }, status: 'In Progress' });
  });
});

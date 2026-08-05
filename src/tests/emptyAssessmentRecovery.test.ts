import { describe, expect, it } from 'vitest';
import {
  buildArchiveEmptyAssessmentPatch,
  buildRecoverEmptyAssessmentPatch,
  canRecoverEmptyAssessment,
  hasEmptyQuestionSnapshot,
  resolveRecoveryPackIds,
} from '../lib/vendor/emptyAssessmentRecovery';

describe('emptyAssessmentRecovery', () => {
  it('detects empty and missing question snapshots', () => {
    expect(hasEmptyQuestionSnapshot({ questions: [] })).toBe(true);
    expect(hasEmptyQuestionSnapshot({ questions: null })).toBe(true);
    expect(hasEmptyQuestionSnapshot({})).toBe(true);
    expect(hasEmptyQuestionSnapshot({ questions: [{ id: 'q1' }] })).toBe(false);
  });

  it('resolves pack ids from stamped packs before frameworks', () => {
    expect(
      resolveRecoveryPackIds({
        frameworkPackIds: ['soc2@current'],
        frameworks: ['iso27001'],
      })
    ).toEqual(['soc2@current']);
    expect(resolveRecoveryPackIds({ frameworks: ['soc2', 'custom'] })).toEqual(['soc2@current']);
    expect(resolveRecoveryPackIds({ frameworks: ['custom'] })).toEqual([]);
  });

  it('rebuilds questions from packs and clears stray answer maps', () => {
    const patch = buildRecoverEmptyAssessmentPatch(
      {
        frameworks: ['soc2'],
        questions: [],
      },
      undefined,
      '2026-08-05T12:00:00.000Z'
    );
    expect(patch.questions.length).toBeGreaterThan(0);
    expect(patch.frameworkPackIds).toEqual(['soc2@current']);
    expect(patch.questionCount).toBe(patch.questions.length);
    expect(patch.progressPct).toBe(0);
    expect(patch.portalOpen).toBe(true);
    expect(patch.answers).toEqual({});
    expect(patch.recoveredFrom).toBe('empty_snapshot');
    expect(patch.recoveredAt).toBe('2026-08-05T12:00:00.000Z');
  });

  it('refuses recovery when packs cannot be resolved', () => {
    expect(canRecoverEmptyAssessment({ frameworks: ['custom'], questions: [] })).toBe(false);
    expect(() =>
      buildRecoverEmptyAssessmentPatch({ frameworks: ['custom'], questions: [] })
    ).toThrow(/no framework packs/i);
    expect(() =>
      buildRecoverEmptyAssessmentPatch({
        frameworks: ['soc2'],
        questions: [{ id: 'already' }],
      })
    ).toThrow(/already has snapshotted/i);
  });

  it('archives empty assessments with a required reason', () => {
    expect(() =>
      buildArchiveEmptyAssessmentPatch({ reason: '  ', archivedBy: 'admin@example.com' })
    ).toThrow(/reason/i);

    const patch = buildArchiveEmptyAssessmentPatch({
      reason: 'Legacy empty create — vendor never received a questionnaire',
      archivedBy: 'admin@example.com',
      nowIso: '2026-08-05T12:00:00.000Z',
    });
    expect(patch.status).toBe('Completed');
    expect(patch.portalOpen).toBe(false);
    expect(patch.decisionOutcome).toBe('rejected');
    expect(patch.archiveReason).toMatch(/Legacy empty/);
    expect(patch.decisionNotes).toMatch(/Archived empty assessment/);
    expect(patch.decidedBy).toBe('admin@example.com');
  });
});

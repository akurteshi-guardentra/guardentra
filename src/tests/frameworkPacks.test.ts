import { describe, expect, it } from 'vitest';
import {
  FRAMEWORK_PACKS,
  buildQuestionsForPackIds,
  currentPackId,
  diffPacks,
  getCurrentPack,
  rebaselineAssessment,
  resolvePackIdsForFrameworks,
} from '../lib/vendor/frameworkPacks';
import { QUESTION_BANK_VERSION } from '../lib/vendor/questionBank';

describe('framework packs', () => {
  it('ships side-by-side NIST and ISO versions with a single current pack each', () => {
    expect(FRAMEWORK_PACKS.some((p) => p.packId === 'nist_csf_2@1.1' && p.status === 'superseded')).toBe(
      true
    );
    expect(FRAMEWORK_PACKS.some((p) => p.packId === 'nist_csf_2@2.0' && p.status === 'current')).toBe(
      true
    );
    expect(FRAMEWORK_PACKS.some((p) => p.packId === 'iso27001@2013' && p.status === 'superseded')).toBe(
      true
    );
    expect(FRAMEWORK_PACKS.some((p) => p.packId === 'iso27001@2022' && p.status === 'current')).toBe(
      true
    );
    expect(getCurrentPack('nist_csf_2')?.packId).toBe('nist_csf_2@2.0');
    expect(currentPackId('iso27001')).toBe('iso27001@2022');
  });

  it('resolves org pins over current defaults', () => {
    expect(resolvePackIdsForFrameworks(['iso27001', 'soc2'])).toEqual([
      'iso27001@2022',
      'soc2@current',
    ]);
    expect(
      resolvePackIdsForFrameworks(['iso27001'], { iso27001: 'iso27001@2013' })
    ).toEqual(['iso27001@2013']);
  });

  it('builds fewer questions for superseded NIST 1.1 than CSF 2.0', () => {
    const v11 = buildQuestionsForPackIds(['nist_csf_2@1.1']);
    const v20 = buildQuestionsForPackIds(['nist_csf_2@2.0']);
    expect(v11.length).toBeLessThan(v20.length);
    expect(v11.every((q) => q.controlKey)).toBe(true);
    expect(v20.every((q) => q.controlKey)).toBe(true);
  });

  it('diffs packs with added and removed controls', () => {
    const diff = diffPacks('nist_csf_2@1.1', 'nist_csf_2@2.0');
    expect(diff.added.length).toBeGreaterThan(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.unchanged).toBeGreaterThan(0);
  });

  it('rebaselines by controlKey and leaves unmatched answers for review', () => {
    const oldQs = buildQuestionsForPackIds(['iso27001@2013']);
    const answers: Record<string, string> = {};
    if (oldQs[0]) answers[oldQs[0].id] = 'Yes';
    answers['orphan_q'] = 'No';

    const result = rebaselineAssessment({
      questions: [
        ...oldQs.map((q) => ({ id: q.id, controlKey: q.controlKey, question: q.question })),
        { id: 'orphan_q', controlKey: 'gone_control_key', question: 'Removed control' },
      ],
      answers: { ...answers },
      targetPackIds: ['iso27001@2022'],
    });

    expect(result.questionBankVersion).toBe(QUESTION_BANK_VERSION);
    expect(result.frameworkPackIds).toEqual(['iso27001@2022']);
    expect(result.questions.length).toBeGreaterThan(oldQs.length);
    if (oldQs[0]) {
      const carried = result.questions.find((q) => q.controlKey === oldQs[0].controlKey);
      expect(carried && result.carriedAnswers[carried.id]).toBe('Yes');
    }
    expect(result.unmatchedAnswers.some((u) => u.controlKey === 'gone_control_key')).toBe(true);
  });
});

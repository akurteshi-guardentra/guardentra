import { describe, expect, it } from 'vitest';
import {
  buildQuestionsForFrameworks,
  categoryProgress,
  countQuestionsForFramework,
  isAnswered,
  overallProgressPct,
  QUESTION_CATEGORIES,
} from '../lib/vendor/questionBank';

describe('question bank', () => {
  it('builds unique portal questions with Yes/No/Partial/N/A', () => {
    const qs = buildQuestionsForFrameworks(['soc2', 'nist_csf_2']);
    expect(qs.length).toBeGreaterThan(10);
    expect(qs[0].options).toEqual(['Yes', 'No', 'Partially', 'Not Applicable']);
    const ids = new Set(qs.map((q) => q.id));
    expect(ids.size).toBe(qs.length);
  });

  it('tracks category and overall progress', () => {
    const qs = buildQuestionsForFrameworks([]);
    const answers = { [qs[0].id]: 'Yes' as const, [qs[1].id]: 'No' as const };
    expect(overallProgressPct(qs, answers)).toBe(Math.round((2 / qs.length) * 100));
    const cats = categoryProgress(qs, answers);
    expect(cats['Company Profile'].answered).toBeGreaterThanOrEqual(1);
  });

  it('actually deduplicates overlapping controls across frameworks (not a no-op)', () => {
    const nistOnly = buildQuestionsForFrameworks(['nist_csf_2']);
    const soc2Only = buildQuestionsForFrameworks(['soc2']);
    const combined = buildQuestionsForFrameworks(['nist_csf_2', 'soc2']);

    // Real dedup: shared controls (MFA, encryption, incident response, etc.) collapse to one
    // question, so the union must be smaller than the naive sum of the two frameworks alone.
    expect(combined.length).toBeLessThan(nistOnly.length + soc2Only.length);
    expect(combined.length).toBeGreaterThanOrEqual(Math.max(nistOnly.length, soc2Only.length));

    // Selecting a framework can only ever add questions, never remove them.
    expect(combined.length).toBeGreaterThanOrEqual(nistOnly.length);
    expect(combined.length).toBeGreaterThanOrEqual(soc2Only.length);
  });

  it('derives per-framework counts from the same bank buildQuestionsForFrameworks uses', () => {
    const frameworkIds = ['nist_csf_2', 'soc2', 'iso27001', 'hipaa', 'pci_dss_4', 'cis_controls'] as const;
    for (const id of frameworkIds) {
      expect(countQuestionsForFramework(id)).toBe(buildQuestionsForFrameworks([id]).length);
      expect(countQuestionsForFramework(id)).toBeGreaterThan(0);
    }
  });

  it('includes real single_choice and multiple_choice questions alongside yesno', () => {
    const qs = buildQuestionsForFrameworks([]);
    const singleChoice = qs.filter((q) => q.type === 'single_choice');
    const multipleChoice = qs.filter((q) => q.type === 'multiple_choice');
    const yesNo = qs.filter((q) => q.type === 'yesno');

    expect(singleChoice.length).toBeGreaterThan(0);
    expect(multipleChoice.length).toBeGreaterThan(0);
    expect(yesNo.length).toBeGreaterThan(0);

    // Non-yesno questions must carry their own answer choices, not the Yes/No/Partial/N/A rail.
    for (const q of [...singleChoice, ...multipleChoice]) {
      expect(q.options).not.toEqual(['Yes', 'No', 'Partially', 'Not Applicable']);
      expect(q.options.length).toBeGreaterThan(1);
    }
  });

  it('numbers questions in the order the portal actually walks them', () => {
    // Regression: the rich-answer-type questions were appended to the end of the bank
    // in mixed categories, while the portal walks category by category. That made the
    // "Question N of M" counter jump (…14, then 49, then 52) and put the Submit button
    // on the wrong question. Ids must follow the traversal order, not raw bank order.
    for (const frameworks of [[], ['soc2'], ['nist_csf_2', 'iso27001', 'pci_dss_4']] as const) {
      const qs = buildQuestionsForFrameworks([...frameworks] as never);
      const ranks = qs.map((q) => QUESTION_CATEGORIES.indexOf(q.category));

      // No question may belong to an earlier category than the one before it.
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
      }

      // And the ids stay a dense 1..n sequence in that same order.
      expect(qs.map((q) => q.id)).toEqual(qs.map((_, i) => `q_${i + 1}`));
    }
  });

  it('treats an empty multiple_choice selection as unanswered, a non-empty one as answered', () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered('')).toBe(false);
    expect(isAnswered([])).toBe(false);
    expect(isAnswered('Yes')).toBe(true);
    expect(isAnswered(['ISO 27001'])).toBe(true);
  });
});

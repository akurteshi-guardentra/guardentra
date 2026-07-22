import { describe, expect, it } from 'vitest';
import {
  buildQuestionsForFrameworks,
  categoryProgress,
  overallProgressPct,
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
});

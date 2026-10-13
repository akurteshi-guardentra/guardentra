import { describe, expect, it } from 'vitest';
import { parseReadinessScore } from '../lib/dashboardStats';

describe('parseReadinessScore (#42)', () => {
  it('preserves a valid zero readiness score', () => {
    expect(parseReadinessScore({ readinessScore: 0 })).toBe(0);
    expect(parseReadinessScore({ score: 0 })).toBe(0);
  });

  it('returns null for missing values', () => {
    expect(parseReadinessScore(null)).toBeNull();
    expect(parseReadinessScore(undefined)).toBeNull();
    expect(parseReadinessScore({})).toBeNull();
    expect(parseReadinessScore({ readinessScore: null })).toBeNull();
    expect(parseReadinessScore({ readinessScore: '' })).toBeNull();
  });

  it('returns null for invalid numbers', () => {
    expect(parseReadinessScore({ readinessScore: 'nope' })).toBeNull();
    expect(parseReadinessScore({ readinessScore: Number.NaN })).toBeNull();
    expect(parseReadinessScore({ readinessScore: Infinity })).toBeNull();
  });

  it('returns finite nonzero scores', () => {
    expect(parseReadinessScore({ readinessScore: 72 })).toBe(72);
    expect(parseReadinessScore({ score: '41.5' })).toBe(41.5);
    expect(parseReadinessScore({ readinessScore: undefined, score: 9 })).toBe(9);
  });
});

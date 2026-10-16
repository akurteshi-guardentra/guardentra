import { describe, expect, it } from 'vitest';
import { parseReadinessScore, readinessMetricCaption } from '../lib/dashboardStats';

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

  it('rejects whitespace, booleans, and arrays instead of coercing them', () => {
    expect(parseReadinessScore({ readinessScore: ' 72' })).toBeNull();
    expect(parseReadinessScore({ readinessScore: '72 ' })).toBeNull();
    expect(parseReadinessScore({ readinessScore: true })).toBeNull();
    expect(parseReadinessScore({ readinessScore: false })).toBeNull();
    expect(parseReadinessScore({ readinessScore: [] })).toBeNull();
    expect(parseReadinessScore({ readinessScore: [72] })).toBeNull();
    expect(parseReadinessScore({ score: ' 0 ' })).toBeNull();
  });

  it('returns finite nonzero scores', () => {
    expect(parseReadinessScore({ readinessScore: 72 })).toBe(72);
    expect(parseReadinessScore({ score: '41.5' })).toBe(41.5);
    expect(parseReadinessScore({ readinessScore: undefined, score: 9 })).toBe(9);
  });
});

describe('readinessMetricCaption', () => {
  it('labels a synthetic readiness row and leaves a real score unlabeled', () => {
    expect(readinessMetricCaption('LOCAL_FIXTURE_NOT_AN_AUDIT')).toMatch(/Sample data/);
    expect(readinessMetricCaption('  sample  ')).toMatch(/Sample data/);
    expect(readinessMetricCaption('')).toBe('Latest readiness score');
    expect(readinessMetricCaption(undefined)).toBe('Latest readiness score');
    expect(readinessMetricCaption(64)).toBe('Latest readiness score');
  });
});

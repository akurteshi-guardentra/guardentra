import { describe, expect, it } from 'vitest';
import { assessmentDueDay, formatDueDay } from '../lib/vendor/dueDate';

describe('assessment due day (#124 finding 4)', () => {
  it('prefers the stored calendar dueDate', () => {
    expect(assessmentDueDay({ dueDate: '2026-11-13', dueAt: '2026-11-13T23:40:00.000Z' })).toBe('2026-11-13');
  });

  it('falls back to the UTC day of dueAt', () => {
    expect(assessmentDueDay({ dueAt: '2026-11-13T23:40:00.000Z' })).toBe('2026-11-13');
    expect(assessmentDueDay({ dueDate: 'bad', dueAt: 'also bad' })).toBeNull();
    expect(assessmentDueDay({})).toBeNull();
  });

  it('formats the same calendar day regardless of the viewer timezone', () => {
    // Journey run: dueAt 2026-11-13T23:xxZ, portal (UTC+1) showed Nov 14, tracker 2026-11-13.
    const day = assessmentDueDay({ dueAt: '2026-11-13T23:40:00.000Z' });
    expect(formatDueDay(day, 'en-US')).toBe('Nov 13, 2026');
  });

  it('renders a dash when there is no due day', () => {
    expect(formatDueDay(null)).toBe('—');
    expect(formatDueDay('2026/11/13')).toBe('—');
  });
});

import { describe, expect, it } from 'vitest';
import { classifyPortalSessionFailure } from '../lib/vendor/portalSessionError';

describe('classifyPortalSessionFailure', () => {
  it('treats closed and unknown links the same, and network or server failures as unreachable', () => {
    expect(classifyPortalSessionFailure(400)).toBe('unavailable');
    expect(classifyPortalSessionFailure(403)).toBe('unavailable');
    expect(classifyPortalSessionFailure(404)).toBe('unavailable');
    expect(classifyPortalSessionFailure(429)).toBe('unavailable');
    expect(classifyPortalSessionFailure(500)).toBe('unreachable');
    expect(classifyPortalSessionFailure(503)).toBe('unreachable');
    expect(classifyPortalSessionFailure(null)).toBe('unreachable');
  });
});

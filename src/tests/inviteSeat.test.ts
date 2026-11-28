import { describe, expect, it } from 'vitest';
import { inviteSeatUnclaimed } from '../../server/lib/inviteSeat';

describe('KI#12 invite seat marker', () => {
  it('treats only an explicit false as an unclaimed invite', () => {
    expect(inviteSeatUnclaimed({ seatCountApplied: false })).toBe(true);
    expect(inviteSeatUnclaimed({ seatCountApplied: true })).toBe(false);
    expect(inviteSeatUnclaimed({ organizationId: 'org-1', role: 'admin' })).toBe(false);
    expect(inviteSeatUnclaimed({ seatCountApplied: 'false' })).toBe(false);
    expect(inviteSeatUnclaimed(null)).toBe(false);
    expect(inviteSeatUnclaimed(undefined)).toBe(false);
  });
});

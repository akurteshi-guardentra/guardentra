/**
 * KI#12. An invite join stores `seatCountApplied: false` until one transaction
 * counts the seat and flips the marker. Founder creates and historical
 * profiles omit the field and stay members. Only an explicit boolean false
 * is an unclaimed invite. Admin SDK routes bypass Firestore rules, so they
 * must apply the same distinction themselves.
 */
export function inviteSeatUnclaimed(profile: object | null | undefined): boolean {
  if (!profile) return false;
  return (profile as { seatCountApplied?: unknown }).seatCountApplied === false;
}

export const INVITE_SEAT_UNCLAIMED_MESSAGE = 'Invite seat is not claimed.';

export class InviteSeatUnclaimedError extends Error {
  readonly code = 'seat_unclaimed';
  readonly status = 403;

  constructor() {
    super(INVITE_SEAT_UNCLAIMED_MESSAGE);
    this.name = 'InviteSeatUnclaimedError';
  }
}

/**
 * Session-scoped acknowledgement that this uid completed a durable
 * users/{uid}.onboarded=true write in the current browser session.
 *
 * Not durable authority — Firestore remains authoritative. This only bridges
 * the gap between a successful updateDoc and the AuthContext onSnapshot.
 * Cleared when the cloud snapshot confirms onboarded=true, on logout/account
 * switch, or when a definitive cloud false arrives without a pending ack.
 */
const pendingByUid = new Map<string, number>();

export function acknowledgeOnboardingComplete(uid: string): void {
  pendingByUid.set(uid, Date.now());
}

export function hasOnboardingAck(uid: string): boolean {
  return pendingByUid.has(uid);
}

export function clearOnboardingAck(uid: string): void {
  pendingByUid.delete(uid);
}

/** Clear all acks (logout / auth teardown). */
export function clearAllOnboardingAcks(): void {
  pendingByUid.clear();
}

/** Test-only helper. */
export function __resetOnboardingAcksForTests(): void {
  pendingByUid.clear();
}

// Per-uid local onboarding flag. Cache/optimization only — never the
// authoritative success condition for production onboarding. Cloud
// users/{uid}.onboarded governs durable completion.
const LOCAL_ONBOARDED_KEY = 'guardentra.onboarded.v1';

export function isLocallyOnboarded(uid: string): boolean {
  try {
    return localStorage.getItem(`${LOCAL_ONBOARDED_KEY}.${uid}`) === 'true';
  } catch {
    return false;
  }
}

/** Set only after users/{uid}.onboarded === true has been durably persisted. */
export function setLocallyOnboarded(uid: string) {
  try {
    localStorage.setItem(`${LOCAL_ONBOARDED_KEY}.${uid}`, 'true');
  } catch {
    /* localStorage unavailable (private mode) — non-fatal, Firestore profile still governs */
  }
}

/** Clear stale local cache when cloud profile says onboarding is incomplete. */
export function clearLocallyOnboarded(uid: string) {
  try {
    localStorage.removeItem(`${LOCAL_ONBOARDED_KEY}.${uid}`);
  } catch {
    /* non-fatal */
  }
}

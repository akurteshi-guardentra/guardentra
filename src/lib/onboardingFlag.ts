// Per-uid local onboarding flag. Replaces the old global 'guardentra_onboarded'
// key, which marked the whole browser onboarded regardless of which account
// was signed in — so a second account on the same device would skip the
// wizard it had never actually completed.
const LOCAL_ONBOARDED_KEY = 'guardentra.onboarded.v1';

export function isLocallyOnboarded(uid: string): boolean {
  try {
    return localStorage.getItem(`${LOCAL_ONBOARDED_KEY}.${uid}`) === 'true';
  } catch {
    return false;
  }
}

export function setLocallyOnboarded(uid: string) {
  try {
    localStorage.setItem(`${LOCAL_ONBOARDED_KEY}.${uid}`, 'true');
  } catch {
    /* localStorage unavailable (private mode) — non-fatal, Firestore profile still governs */
  }
}

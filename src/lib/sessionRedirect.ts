/**
 * Cheap localStorage probe — avoids loading the Firebase SDK on anonymous
 * marketing visits. Only when a persisted auth user key exists do we hydrate Auth.
 */
export function hasPersistedFirebaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firebase:authUser:')) return true;
    }
  } catch {
    // private mode / blocked storage
  }
  return false;
}

/** Resolves dashboard/onboarding path for an already-signed-in user, or null. */
export async function resolveSignedInRedirect(): Promise<string | null> {
  const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }, { isLocallyOnboarded }] =
    await Promise.all([
      import('../firebase'),
      import('firebase/auth'),
      import('firebase/firestore'),
      import('./onboardingFlag'),
    ]);

  const user = await new Promise<(typeof auth)['currentUser']>((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (!user) return null;

  if (isLocallyOnboarded(user.uid)) return '/dashboard';

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      // Known profile: honor onboarded. Missing/false → onboarding.
      // Do not treat a failed/empty read as onboarding for marketing redirects —
      // that caused a blink of /onboarding for returning users.
      return snap.data()?.onboarded ? '/dashboard' : '/onboarding';
    }
  } catch {
    // Profile read failed — stay on Landing; Login/Auth will resolve the gate.
    return null;
  }

  // No user doc yet — first-run path.
  return '/onboarding';
}

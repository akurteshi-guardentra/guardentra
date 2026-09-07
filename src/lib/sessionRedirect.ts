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
  const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }, { clearLocallyOnboarded, setLocallyOnboarded }] =
    await Promise.all([
      import('../firebase'),
      import('firebase/auth'),
      import('firebase/firestore'),
      import('./onboardingFlag'),
    ]);

  const user = await new Promise<(typeof auth)['currentUser']>((resolve) => {
    let unsub: () => void = () => {};
    unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (!user) return null;

  // Cloud profile is authoritative. Do not short-circuit on the local cache —
  // a stale local flag must not skip a genuinely incomplete cloud profile.
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const onboarded = !!snap.data()?.onboarded;
      if (onboarded) {
        setLocallyOnboarded(user.uid);
        return '/dashboard';
      }
      clearLocallyOnboarded(user.uid);
      return '/onboarding';
    }
  } catch {
    // Profile read failed — stay on Landing; Login/Auth will resolve the gate.
    return null;
  }

  // No user doc yet — first-run path.
  return '/onboarding';
}

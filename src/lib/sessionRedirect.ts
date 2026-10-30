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

/**
 * Resolves post-sign-in destination for an already-authenticated user.
 * Issue #67: bootstrapped tenants (organizationId bound) go to Dashboard.
 * Incomplete optional setup never redirects back to the old wizard.
 */
export async function resolveSignedInRedirect(): Promise<string | null> {
  const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }, { clearLocallyOnboarded, setLocallyOnboarded }] =
    await Promise.all([
      import('../firebase'),
      import('firebase/auth'),
      import('firebase/firestore'),
      import('./onboardingFlag'),
    ]);
  const { isProfileBootstrapped } = await import('./bootstrapGate');

  const user = await new Promise<(typeof auth)['currentUser']>((resolve) => {
    let unsub: () => void = () => {};
    unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  if (!user) return null;

  // Cloud profile is authoritative. organizationId proves #61 bootstrap completed.
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data() || {};
      if (isProfileBootstrapped(data as { organizationId?: string })) {
        // Keep local cache in sync for legacy helpers; not a routing authority.
        if (data.onboarded) setLocallyOnboarded(user.uid);
        else clearLocallyOnboarded(user.uid);
        return '/dashboard';
      }
      clearLocallyOnboarded(user.uid);
      // Profile exists but lacks organizationId — Auth/Login will surface recovery.
      return null;
    }
  } catch {
    // Profile read failed — stay on Landing; Login/Auth will resolve the gate.
    return null;
  }

  // No user doc yet — AuthContext will run bootstrap; send to dashboard shell.
  return '/dashboard';
}

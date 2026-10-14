import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import demoConfig from '../firebase-applet-config.json';
import { resolveFirebaseClientConfig } from './lib/firebaseClientConfig';
import { assertLocalEmulatorAllowed } from './lib/localEmulatorGuard';

/**
 * Prefer a complete VITE_FIREBASE_* set per environment.
 * Production builds fail closed — no field-by-field demo JSON merge
 * (see docs/ENVIRONMENTS.md).
 */
const firebaseConfig = resolveFirebaseClientConfig(import.meta.env, demoConfig, {
  log: (message) => {
    // Safe diagnostics only (projectId + environment) — never API keys.
    console.info(message);
  },
});

const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

if (
  assertLocalEmulatorAllowed({
    dev: Boolean(import.meta.env.DEV),
    flag: import.meta.env.VITE_USE_LOCAL_EMULATORS,
    projectId: firebaseConfig.projectId,
  })
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  console.info('GuardEntra local synthetic emulators attached. Not staging or production.');
}

// Explicitly set persistence to local to handle iframe storage restrictions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Failed to set auth persistence:', err);
});

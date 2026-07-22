import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import demoConfig from '../firebase-applet-config.json';

/**
 * Prefer VITE_FIREBASE_* (per-env) over committed demo JSON.
 * See docs/ENVIRONMENTS.md — demo project is not for production.
 */
function resolveFirebaseConfig(): FirebaseOptions & { firestoreDatabaseId?: string } {
  const env = import.meta.env;
  const projectId = env.VITE_FIREBASE_PROJECT_ID || demoConfig.projectId;
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || demoConfig.apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || demoConfig.authDomain,
    projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || demoConfig.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || demoConfig.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || demoConfig.appId,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || demoConfig.measurementId || undefined,
    firestoreDatabaseId: env.VITE_FIRESTORE_DATABASE_ID || (demoConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId,
  };
}

const firebaseConfig = resolveFirebaseConfig();
const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Explicitly set persistence to local to handle iframe storage restrictions
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});

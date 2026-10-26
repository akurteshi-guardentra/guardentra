import { initializeApp, getApp, getApps, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import demoConfig from '../../../firebase-applet-config.json';
import { resolveFirebaseClientConfig } from '../firebaseClientConfig';
import type { AuthHeaderProvider } from '../authHeaders';
import { assertLocalEmulatorAllowed, LOCAL_EMULATOR_ENDPOINTS } from '../localEmulatorGuard';

/**
 * Secondary Firebase Auth for the vendor portal.
 * Portal custom tokens must not replace the org user's session on the default `auth`.
 *
 * Lazy-init so importing `isPortalUid` (e.g. from AuthContext) does not spin up a
 * second Firebase app during app boot or unit tests that never open the portal.
 */
function resolveConfig(): FirebaseOptions {
  return resolveFirebaseClientConfig(import.meta.env, demoConfig);
}

const PORTAL_APP_NAME = 'guardentra-portal';

function getPortalApp() {
  const existing = getApps().find((a) => a.name === PORTAL_APP_NAME);
  if (existing) return existing;
  try {
    return getApp(PORTAL_APP_NAME);
  } catch {
    return initializeApp(resolveConfig(), PORTAL_APP_NAME);
  }
}

let portalAuthInstance: Auth | null = null;
let portalDbInstance: Firestore | null = null;
let portalStorageInstance: FirebaseStorage | null = null;
let portalEmulatorsConnected = false;

function connectPortalEmulators(app: FirebaseApp): void {
  if (portalEmulatorsConnected) return;
  const config = resolveConfig();
  const allowed = assertLocalEmulatorAllowed({
    dev: Boolean(import.meta.env.DEV),
    flag: import.meta.env.VITE_USE_LOCAL_EMULATORS,
    projectId: String(config.projectId || ''),
  });
  if (!allowed) return;
  connectAuthEmulator(getAuth(app), LOCAL_EMULATOR_ENDPOINTS.authUrl, { disableWarnings: true });
  connectFirestoreEmulator(
    getFirestore(app),
    LOCAL_EMULATOR_ENDPOINTS.firestoreHost,
    LOCAL_EMULATOR_ENDPOINTS.firestorePort,
  );
  connectStorageEmulator(
    getStorage(app),
    LOCAL_EMULATOR_ENDPOINTS.storageHost,
    LOCAL_EMULATOR_ENDPOINTS.storagePort,
  );
  portalEmulatorsConnected = true;
}

export function getPortalAuth(): Auth {
  const app = getPortalApp();
  connectPortalEmulators(app);
  if (!portalAuthInstance) {
    portalAuthInstance = getAuth(app);
  }
  return portalAuthInstance;
}

/** Firestore bound to the portal app, never the reviewer's default app. */
export function getPortalDb(): Firestore {
  const app = getPortalApp();
  connectPortalEmulators(app);
  if (!portalDbInstance) portalDbInstance = getFirestore(app);
  return portalDbInstance;
}

/** Storage bound to the portal app so uploads carry the portal claim. */
export function getPortalStorage(): FirebaseStorage {
  const app = getPortalApp();
  connectPortalEmulators(app);
  if (!portalStorageInstance) portalStorageInstance = getStorage(app);
  return portalStorageInstance;
}

export function isPortalUid(uid: string | null | undefined): boolean {
  return Boolean(uid && uid.startsWith('portal_'));
}

/**
 * Authorization header for /api/* calls made from a vendor portal session
 * (e.g. `/api/audit/emit`). Sources the ID token from the **portal** Firebase
 * app only — never the default app `authHeaders()` reads — so a signed-in
 * org/admin session can never be substituted for a portal identity and a
 * portal call can never be credited to the wrong tenant path (GitHub #63).
 *
 * Fails closed: a missing or unrefreshable portal session throws rather than
 * returning headers without an Authorization value, so a caller can never
 * silently send (or report success for) an unauthenticated portal request.
 * The thrown error carries only a fixed, static message — never the ID token
 * or any header value — so it is always safe to log.
 */
export const getPortalAuthHeaders: AuthHeaderProvider = async (extra = {}) => {
  const user = getPortalAuth().currentUser;
  if (!user) {
    throw new Error('Portal auth headers requested with no signed-in portal session.');
  }
  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new Error('Portal session ID token could not be refreshed.');
  }
  return { ...extra, Authorization: `Bearer ${token}` };
};

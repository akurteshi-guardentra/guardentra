import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import demoConfig from '../../../firebase-applet-config.json';
import { resolveFirebaseClientConfig } from '../firebaseClientConfig';

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

export function getPortalAuth(): Auth {
  if (!portalAuthInstance) {
    portalAuthInstance = getAuth(getPortalApp());
  }
  return portalAuthInstance;
}

export function isPortalUid(uid: string | null | undefined): boolean {
  return Boolean(uid && uid.startsWith('portal_'));
}

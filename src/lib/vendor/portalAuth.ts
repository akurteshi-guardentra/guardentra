import { initializeApp, getApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import demoConfig from '../../../firebase-applet-config.json';

/**
 * Secondary Firebase Auth for the vendor portal.
 * Portal custom tokens must not replace the org user's session on the default `auth`.
 *
 * Lazy-init so importing `isPortalUid` (e.g. from AuthContext) does not spin up a
 * second Firebase app during app boot or unit tests that never open the portal.
 */
function isUsableWebApiKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith('AIza') && key.length > 20;
}

function resolveConfig(): FirebaseOptions {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY || demoConfig.apiKey;
  if (!isUsableWebApiKey(apiKey)) {
    throw new Error('Missing Firebase Web API key for portal auth.');
  }
  return {
    apiKey,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || demoConfig.authDomain,
    projectId: env.VITE_FIREBASE_PROJECT_ID || demoConfig.projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || demoConfig.storageBucket,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || demoConfig.messagingSenderId,
    appId: env.VITE_FIREBASE_APP_ID || demoConfig.appId,
  };
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

import fs from 'fs';
import path from 'path';

/** Production-equivalent default; not a secret. Override via env or applet config. */
export const DEFAULT_ADMIN_STORAGE_BUCKET = 'guardentra-7f582.firebasestorage.app';

export type FirebaseAppletConfig = {
  projectId?: string;
  storageBucket?: string;
  firestoreDatabaseId?: string;
};

export function loadFirebaseAppletConfig(
  cwd = process.cwd()
): FirebaseAppletConfig {
  try {
    const configPath = path.join(cwd, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return {};
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as FirebaseAppletConfig;
  } catch {
    return {};
  }
}

export function resolveAdminStorageBucket(
  env: NodeJS.Dict<string | undefined> = process.env,
  applet: FirebaseAppletConfig = loadFirebaseAppletConfig()
): string {
  const fromEnv =
    env.FIREBASE_STORAGE_BUCKET?.trim() || env.VITE_FIREBASE_STORAGE_BUCKET?.trim();
  if (fromEnv) return fromEnv;
  const fromApplet = applet.storageBucket?.trim();
  if (fromApplet) return fromApplet;
  return DEFAULT_ADMIN_STORAGE_BUCKET;
}

export function adminAppOptions(
  env: NodeJS.Dict<string | undefined> = process.env,
  applet: FirebaseAppletConfig = loadFirebaseAppletConfig()
): { projectId?: string; storageBucket: string } {
  const projectId =
    env.GCLOUD_PROJECT?.trim() ||
    env.GOOGLE_CLOUD_PROJECT?.trim() ||
    applet.projectId?.trim();
  return {
    ...(projectId ? { projectId } : {}),
    storageBucket: resolveAdminStorageBucket(env, applet),
  };
}

/** Always pass an explicit bucket so Admin never uses an unspecified default. */
export function getConfiguredStorageBucket<T>(storage: {
  bucket: (name?: string) => T;
}): T {
  const name = resolveAdminStorageBucket();
  if (!name) {
    throw new Error('Firebase Admin Storage bucket name is not configured');
  }
  return storage.bucket(name);
}

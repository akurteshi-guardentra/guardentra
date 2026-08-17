import fs from 'fs';
import path from 'path';

export const PRODUCTION_PROJECT_ID = 'guardentra-7f582';

/** Production-equivalent default; not a secret. Never use this for a different runtime project. */
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

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

export function runtimeProjectId(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return trim(env.GCLOUD_PROJECT) || trim(env.GOOGLE_CLOUD_PROJECT);
}

function isProductionBucket(bucket: string): boolean {
  return (
    bucket === DEFAULT_ADMIN_STORAGE_BUCKET ||
    bucket === `${PRODUCTION_PROJECT_ID}.appspot.com`
  );
}

function bucketMatchesProject(bucket: string, projectId: string): boolean {
  return (
    bucket === `${projectId}.firebasestorage.app` ||
    bucket === `${projectId}.appspot.com`
  );
}

function failClosed(projectId: string, detail: string): never {
  throw new Error(
    `Firebase Admin Storage is not configured for project "${projectId}". ` +
      `Set FIREBASE_STORAGE_BUCKET to that project's bucket. ` +
      `Refusing to use ${DEFAULT_ADMIN_STORAGE_BUCKET} for a different project. ${detail}`
  );
}

function appletBucketIfCompatible(
  runtimeProject: string | undefined,
  applet: FirebaseAppletConfig
): string | undefined {
  const appletProject = trim(applet.projectId);
  const appletBucket = trim(applet.storageBucket);
  if (!appletBucket) return undefined;

  if (!runtimeProject) {
    return appletBucket;
  }

  if (appletProject && appletProject !== runtimeProject) {
    return undefined;
  }

  if (!appletProject && !bucketMatchesProject(appletBucket, runtimeProject)) {
    return undefined;
  }

  return appletBucket;
}

export function resolveAdminStorageBucket(
  env: NodeJS.Dict<string | undefined> = process.env,
  applet: FirebaseAppletConfig = loadFirebaseAppletConfig()
): string {
  const runtimeProject = runtimeProjectId(env);
  const explicit =
    trim(env.FIREBASE_STORAGE_BUCKET) || trim(env.VITE_FIREBASE_STORAGE_BUCKET);

  if (explicit) {
    if (
      runtimeProject &&
      runtimeProject !== PRODUCTION_PROJECT_ID &&
      isProductionBucket(explicit)
    ) {
      failClosed(
        runtimeProject,
        `FIREBASE_STORAGE_BUCKET/VITE_FIREBASE_STORAGE_BUCKET is the production-equivalent bucket.`
      );
    }
    return explicit;
  }

  const compatibleApplet = appletBucketIfCompatible(runtimeProject, applet);
  if (compatibleApplet) {
    if (
      runtimeProject &&
      runtimeProject !== PRODUCTION_PROJECT_ID &&
      isProductionBucket(compatibleApplet)
    ) {
      failClosed(runtimeProject, 'Applet storageBucket is the production-equivalent bucket.');
    }
    return compatibleApplet;
  }

  if (runtimeProject === PRODUCTION_PROJECT_ID) {
    return DEFAULT_ADMIN_STORAGE_BUCKET;
  }

  if (runtimeProject) {
    failClosed(
      runtimeProject,
      'No matching FIREBASE_STORAGE_BUCKET and applet storageBucket is missing or belongs to another project.'
    );
  }

  throw new Error(
    'Firebase Admin Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or provide a compatible firebase-applet-config.json storageBucket.'
  );
}

export function adminAppOptions(
  env: NodeJS.Dict<string | undefined> = process.env,
  applet: FirebaseAppletConfig = loadFirebaseAppletConfig()
): { projectId?: string; storageBucket: string } {
  const projectId =
    runtimeProjectId(env) || trim(applet.projectId);
  return {
    ...(projectId ? { projectId } : {}),
    storageBucket: resolveAdminStorageBucket(env, applet),
  };
}

/** Always pass an explicit bucket so Admin never uses an unspecified default. */
export function getConfiguredStorageBucket<T>(
  storage: {
    bucket: (name?: string) => T;
  },
  env: NodeJS.Dict<string | undefined> = process.env,
  applet: FirebaseAppletConfig = loadFirebaseAppletConfig()
): T {
  const name = resolveAdminStorageBucket(env, applet);
  if (!name) {
    throw new Error('Firebase Admin Storage bucket name is not configured');
  }
  return storage.bucket(name);
}

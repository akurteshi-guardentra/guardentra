import fs from 'fs';
import path from 'path';

export const DEMO_PROJECT_ID = 'guardentra-7f582';
export const DEMO_ADMIN_STORAGE_BUCKET = 'guardentra-7f582.firebasestorage.app';

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

function runtimeMode(
  env: NodeJS.Dict<string | undefined>
): string {
  return (trim(env.APP_ENV) || trim(env.NODE_ENV) || '').toLowerCase();
}

export function isProductionLikeRuntime(
  env: NodeJS.Dict<string | undefined> = process.env
): boolean {
  const mode = runtimeMode(env);
  return mode === 'production' || mode === 'prod' || mode === 'staging';
}

export function runtimeProjectId(
  env: NodeJS.Dict<string | undefined> = process.env
): string | undefined {
  return trim(env.GCLOUD_PROJECT) || trim(env.GOOGLE_CLOUD_PROJECT);
}

function bucketMatchesProject(bucket: string, projectId: string): boolean {
  return (
    bucket === `${projectId}.firebasestorage.app` ||
    bucket === `${projectId}.appspot.com`
  );
}

function failClosed(projectId: string, detail: string): never {
  throw new Error(
    `Firebase Admin Storage is not configured safely for project "${projectId}". ` +
      `Set FIREBASE_STORAGE_BUCKET to that project's bucket. ${detail}`
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
  const productionLike = isProductionLikeRuntime(env);
  const explicit =
    trim(env.FIREBASE_STORAGE_BUCKET) || trim(env.VITE_FIREBASE_STORAGE_BUCKET);

  if (productionLike) {
    if (!runtimeProject) {
      throw new Error(
        'Firebase Admin project is not configured for production-like runtime. ' +
          'Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT explicitly.'
      );
    }
    if (runtimeProject === DEMO_PROJECT_ID) {
      throw new Error(
        `REFUSED: production-like runtime cannot use demo/legacy project "${DEMO_PROJECT_ID}".`
      );
    }
    if (!explicit) {
      failClosed(
        runtimeProject,
        'Production-like runtime requires an explicit FIREBASE_STORAGE_BUCKET.'
      );
    }
    if (!bucketMatchesProject(explicit, runtimeProject)) {
      failClosed(
        runtimeProject,
        `Configured bucket "${explicit}" does not match the runtime project.`
      );
    }
    return explicit;
  }

  if (explicit) {
    if (runtimeProject && !bucketMatchesProject(explicit, runtimeProject)) {
      failClosed(
        runtimeProject,
        `Configured bucket "${explicit}" does not match the runtime project.`
      );
    }
    return explicit;
  }

  const compatibleApplet = appletBucketIfCompatible(runtimeProject, applet);
  if (compatibleApplet) {
    return compatibleApplet;
  }

  if (runtimeProject) {
    failClosed(
      runtimeProject,
      'No matching FIREBASE_STORAGE_BUCKET and applet storageBucket is missing or belongs to another project.'
    );
  }

  throw new Error(
    'Firebase Admin Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or provide a compatible firebase-applet-config.json storageBucket for local/development use.'
  );
}

export function adminAppOptions(
  env: NodeJS.Dict<string | undefined> = process.env,
  applet: FirebaseAppletConfig = loadFirebaseAppletConfig()
): { projectId?: string; storageBucket: string } {
  const runtimeProject = runtimeProjectId(env);
  if (isProductionLikeRuntime(env) && !runtimeProject) {
    throw new Error(
      'Firebase Admin project is not configured for production-like runtime. ' +
        'Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT explicitly.'
    );
  }

  const projectId = runtimeProject || trim(applet.projectId);
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

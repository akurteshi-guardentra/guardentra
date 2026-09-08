/**
 * Coherent Firebase web client configuration resolver.
 *
 * Production Vite builds must receive one complete environment's VITE_FIREBASE_*
 * set. Field-by-field merge with demo `firebase-applet-config.json` is forbidden
 * in PROD — that path mixed staging/prod API keys with guardentra-7f582 IDs.
 */

export const DEMO_FIREBASE_PROJECT_ID = 'guardentra-7f582';

export const REQUIRED_FIREBASE_CLIENT_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export type RequiredFirebaseClientEnvKey = (typeof REQUIRED_FIREBASE_CLIENT_ENV_KEYS)[number];

export type FirebaseClientEnvSource = {
  MODE?: string;
  DEV?: boolean;
  PROD?: boolean;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_MEASUREMENT_ID?: string;
  VITE_FIRESTORE_DATABASE_ID?: string;
};

export type FirebaseDemoConfig = {
  apiKey?: string;
  projectId?: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
};

export type ResolvedFirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
};

export type ResolveFirebaseClientConfigOptions = {
  /** When true (Vite production build), demo fallback is disabled. */
  isProductionBuild?: boolean;
  /** Safe diagnostic logger — must never receive API keys. */
  log?: (message: string) => void;
};

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isUsableWebApiKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith('AIza') && key.length > 20;
}

function isProductionBuild(env: FirebaseClientEnvSource, explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  if (typeof env.PROD === 'boolean') return env.PROD;
  return env.MODE === 'production';
}

function readEnvField(
  env: FirebaseClientEnvSource,
  key: RequiredFirebaseClientEnvKey | 'VITE_FIREBASE_MEASUREMENT_ID' | 'VITE_FIRESTORE_DATABASE_ID',
): string {
  return trim(env[key]);
}

function identifierKeysPresent(env: FirebaseClientEnvSource): RequiredFirebaseClientEnvKey[] {
  return REQUIRED_FIREBASE_CLIENT_ENV_KEYS.filter((key) => {
    if (key === 'VITE_FIREBASE_API_KEY') return false;
    return Boolean(readEnvField(env, key));
  });
}

function expectedAuthDomain(projectId: string): string {
  return `${projectId}.firebaseapp.com`;
}

function storageBucketMatchesProject(bucket: string, projectId: string): boolean {
  const allowed = new Set([
    `${projectId}.firebasestorage.app`,
    `${projectId}.appspot.com`,
  ]);
  return allowed.has(bucket);
}

function missingRequired(
  env: FirebaseClientEnvSource,
  keys: readonly RequiredFirebaseClientEnvKey[],
): RequiredFirebaseClientEnvKey[] {
  return keys.filter((key) => !readEnvField(env, key));
}

function assertCoherentIdentifiers(config: {
  projectId: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}): void {
  const { projectId, authDomain, storageBucket, messagingSenderId, appId } = config;

  if (!projectId) {
    throw new Error('Firebase client config invalid: projectId is empty.');
  }
  if (!appId) {
    throw new Error('Firebase client config invalid: appId is empty.');
  }
  if (!messagingSenderId) {
    throw new Error('Firebase client config invalid: messagingSenderId is empty.');
  }

  const expectedDomain = expectedAuthDomain(projectId);
  if (authDomain !== expectedDomain) {
    throw new Error(
      `Firebase client config invalid: authDomain "${authDomain}" does not match projectId "${projectId}" (expected "${expectedDomain}").`,
    );
  }

  if (!storageBucketMatchesProject(storageBucket, projectId)) {
    throw new Error(
      `Firebase client config invalid: storageBucket "${storageBucket}" does not belong to projectId "${projectId}".`,
    );
  }

  // App IDs look like "1:<projectNumber>:web:<hash>". Sender ID should match the number segment.
  const appIdMatch = /^1:(\d+):web:[a-f0-9]+$/i.exec(appId);
  if (!appIdMatch) {
    throw new Error(
      `Firebase client config invalid: appId "${appId}" is not a web app id.`,
    );
  }
  if (appIdMatch[1] !== messagingSenderId) {
    throw new Error(
      `Firebase client config invalid: messagingSenderId "${messagingSenderId}" does not match appId project number.`,
    );
  }
}

function configFromEnv(env: FirebaseClientEnvSource): ResolvedFirebaseClientConfig {
  const apiKey = readEnvField(env, 'VITE_FIREBASE_API_KEY');
  if (!isUsableWebApiKey(apiKey)) {
    throw new Error(
      'Missing Firebase Web API key. Set VITE_FIREBASE_API_KEY for this environment (see docs/SECRETS.md).',
    );
  }

  const missing = missingRequired(env, REQUIRED_FIREBASE_CLIENT_ENV_KEYS);
  if (missing.length > 0) {
    throw new Error(
      `Incomplete Firebase client config for deployed builds. Missing: ${missing.join(', ')}. ` +
        'Provide one coherent VITE_FIREBASE_* set — field-by-field demo fallback is disabled.',
    );
  }

  const resolved: ResolvedFirebaseClientConfig = {
    apiKey,
    projectId: readEnvField(env, 'VITE_FIREBASE_PROJECT_ID'),
    authDomain: readEnvField(env, 'VITE_FIREBASE_AUTH_DOMAIN'),
    storageBucket: readEnvField(env, 'VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: readEnvField(env, 'VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: readEnvField(env, 'VITE_FIREBASE_APP_ID'),
  };

  const measurementId = readEnvField(env, 'VITE_FIREBASE_MEASUREMENT_ID');
  if (measurementId) resolved.measurementId = measurementId;

  const firestoreDatabaseId = readEnvField(env, 'VITE_FIRESTORE_DATABASE_ID');
  if (firestoreDatabaseId) resolved.firestoreDatabaseId = firestoreDatabaseId;

  assertCoherentIdentifiers(resolved);
  return resolved;
}

function configFromDemo(
  env: FirebaseClientEnvSource,
  demo: FirebaseDemoConfig,
): ResolvedFirebaseClientConfig {
  const apiKey = readEnvField(env, 'VITE_FIREBASE_API_KEY') || trim(demo.apiKey);
  if (!isUsableWebApiKey(apiKey)) {
    throw new Error(
      'Missing Firebase Web API key. Copy .env.example → .env.local and set VITE_FIREBASE_API_KEY ' +
        '(Firebase Console → Project settings → Your apps). Do not commit real keys — see docs/SECRETS.md.',
    );
  }

  const projectId = trim(demo.projectId);
  const resolved: ResolvedFirebaseClientConfig = {
    apiKey,
    projectId,
    authDomain: trim(demo.authDomain),
    storageBucket: trim(demo.storageBucket),
    messagingSenderId: trim(demo.messagingSenderId),
    appId: trim(demo.appId),
  };

  const measurementId = trim(demo.measurementId);
  if (measurementId) resolved.measurementId = measurementId;

  const firestoreDatabaseId = trim(demo.firestoreDatabaseId);
  if (firestoreDatabaseId) resolved.firestoreDatabaseId = firestoreDatabaseId;

  assertCoherentIdentifiers(resolved);
  return resolved;
}

/**
 * Resolve a single coherent Firebase web client config.
 *
 * - Production Vite builds: require the full VITE_FIREBASE_* set; never merge demo JSON.
 * - Local/dev: may use committed demo identifiers when no project identifiers are set.
 * - Partial env identifiers never combine with demo fields.
 */
export function resolveFirebaseClientConfig(
  env: FirebaseClientEnvSource,
  demo: FirebaseDemoConfig,
  options: ResolveFirebaseClientConfigOptions = {},
): ResolvedFirebaseClientConfig {
  const isProdBuild = isProductionBuild(env, options.isProductionBuild);
  const presentIdentifiers = identifierKeysPresent(env);
  const hasAnyIdentifier = presentIdentifiers.length > 0;
  const hasAllIdentifiers = REQUIRED_FIREBASE_CLIENT_ENV_KEYS.filter(
    (k) => k !== 'VITE_FIREBASE_API_KEY',
  ).every((k) => Boolean(readEnvField(env, k)));

  let resolved: ResolvedFirebaseClientConfig;

  if (isProdBuild) {
    // Fail closed: every required field must come from env. No demo JSON merge.
    // Explicit coherent demo identifiers are allowed for local packaging only;
    // App Hosting staging/prod must supply their own project IDs via apphosting.*.yaml.
    resolved = configFromEnv(env);
  } else if (hasAnyIdentifier) {
    if (!hasAllIdentifiers) {
      const missing = missingRequired(
        env,
        REQUIRED_FIREBASE_CLIENT_ENV_KEYS.filter((k) => k !== 'VITE_FIREBASE_API_KEY'),
      );
      throw new Error(
        `Partial Firebase client env is not allowed (would mix with demo). Missing: ${missing.join(', ')}.`,
      );
    }
    resolved = configFromEnv(env);
  } else {
    resolved = configFromDemo(env, demo);
  }

  const modeLabel = env.MODE || (isProdBuild ? 'production' : 'development');
  options.log?.(
    `[firebase] client config projectId=${resolved.projectId} environment=${modeLabel}`,
  );

  return resolved;
}

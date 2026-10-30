/**
 * Server-side regional binding registry (P2B).
 * Region is taken only from a trusted organization record — never from the client body.
 */
export type DataRegion = 'eu' | 'us';

export type RegionBinding = {
  region: DataRegion;
  firebaseProjectId: string;
  storageBucket: string;
};

const DEMO_PROJECT_ID = 'guardentra-7f582';
const PENDING_EU_PROJECT_ID = 'guardentra-eu-pending';

export function isDataRegion(value: unknown): value is DataRegion {
  return value === 'eu' || value === 'us';
}

export function parseDataRegion(value: unknown, fallback: DataRegion = 'us'): DataRegion {
  return isDataRegion(value) ? value : fallback;
}

function trim(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function productionLike(env: NodeJS.Dict<string | undefined>): boolean {
  const mode = (trim(env.APP_ENV) || trim(env.NODE_ENV) || '').toLowerCase();
  return mode === 'production' || mode === 'prod' || mode === 'staging';
}

function bucketMatchesProject(bucket: string, projectId: string): boolean {
  return (
    bucket === `${projectId}.firebasestorage.app` ||
    bucket === `${projectId}.appspot.com`
  );
}

function productionBinding(
  region: DataRegion,
  env: NodeJS.Dict<string | undefined>
): RegionBinding {
  const runtimeProject = trim(env.GCLOUD_PROJECT) || trim(env.GOOGLE_CLOUD_PROJECT);

  const firebaseProjectId =
    region === 'eu'
      ? trim(env.FIREBASE_PROJECT_ID_EU)
      : trim(env.FIREBASE_PROJECT_ID_US) || runtimeProject;

  const storageBucket =
    region === 'eu'
      ? trim(env.FIREBASE_STORAGE_BUCKET_EU)
      : trim(env.FIREBASE_STORAGE_BUCKET_US) || trim(env.FIREBASE_STORAGE_BUCKET);

  if (!firebaseProjectId || !storageBucket) {
    throw new Error(
      `REFUSED: production-like ${region.toUpperCase()} Firebase binding is incomplete.`
    );
  }
  if (
    firebaseProjectId === DEMO_PROJECT_ID ||
    firebaseProjectId === PENDING_EU_PROJECT_ID ||
    storageBucket.includes(DEMO_PROJECT_ID) ||
    storageBucket.includes(PENDING_EU_PROJECT_ID)
  ) {
    throw new Error(
      `REFUSED: production-like ${region.toUpperCase()} Firebase binding cannot use demo/pending resources.`
    );
  }
  if (!bucketMatchesProject(storageBucket, firebaseProjectId)) {
    throw new Error(
      `REFUSED: production-like ${region.toUpperCase()} Firebase bucket does not match project.`
    );
  }

  return { region, firebaseProjectId, storageBucket };
}

function envBinding(
  region: DataRegion,
  env: NodeJS.Dict<string | undefined> = process.env
): RegionBinding {
  if (productionLike(env)) {
    return productionBinding(region, env);
  }

  if (region === 'eu') {
    return {
      region: 'eu',
      firebaseProjectId:
        trim(env.FIREBASE_PROJECT_ID_EU) ||
        trim(env.GCLOUD_PROJECT) ||
        trim(env.GOOGLE_CLOUD_PROJECT) ||
        PENDING_EU_PROJECT_ID,
      storageBucket:
        trim(env.FIREBASE_STORAGE_BUCKET_EU) ||
        trim(env.FIREBASE_STORAGE_BUCKET) ||
        `${PENDING_EU_PROJECT_ID}.appspot.com`,
    };
  }

  return {
    region: 'us',
    firebaseProjectId:
      trim(env.FIREBASE_PROJECT_ID_US) ||
      trim(env.GCLOUD_PROJECT) ||
      trim(env.GOOGLE_CLOUD_PROJECT) ||
      DEMO_PROJECT_ID,
    storageBucket:
      trim(env.FIREBASE_STORAGE_BUCKET_US) ||
      trim(env.FIREBASE_STORAGE_BUCKET) ||
      `${DEMO_PROJECT_ID}.appspot.com`,
  };
}

/** Resolve binding from trusted org.dataRegion only. */
export function resolveRegionBinding(
  trustedOrgDataRegion: unknown,
  env: NodeJS.Dict<string | undefined> = process.env
): RegionBinding {
  const region = parseDataRegion(trustedOrgDataRegion, 'us');
  return envBinding(region, env);
}

/**
 * Isolation check: a request scoped to region A must not receive region B's project.
 */
export function assertRegionIsolation(
  trustedOrgDataRegion: unknown,
  requestedRegion: unknown,
  env: NodeJS.Dict<string | undefined> = process.env
): { ok: true; binding: RegionBinding } | { ok: false; error: string } {
  if (!isDataRegion(requestedRegion)) {
    return { ok: false, error: 'requested region invalid' };
  }
  const binding = resolveRegionBinding(trustedOrgDataRegion, env);
  if (binding.region !== requestedRegion) {
    return {
      ok: false,
      error: `cross-region forbidden: org=${binding.region} requested=${requestedRegion}`,
    };
  }
  return { ok: true, binding };
}

/** Reject client-supplied region overrides when they disagree with the org record. */
export function rejectClientRegionOverride(
  trustedOrgDataRegion: unknown,
  clientClaimedRegion: unknown
): { ok: true } | { ok: false; error: string } {
  if (clientClaimedRegion == null || clientClaimedRegion === '') return { ok: true };
  if (!isDataRegion(clientClaimedRegion)) {
    return { ok: false, error: 'client region claim invalid' };
  }
  const trusted = parseDataRegion(trustedOrgDataRegion, 'us');
  if (clientClaimedRegion !== trusted) {
    return { ok: false, error: 'client cannot override organization dataRegion' };
  }
  return { ok: true };
}

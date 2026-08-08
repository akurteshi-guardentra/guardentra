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

export function isDataRegion(value: unknown): value is DataRegion {
  return value === 'eu' || value === 'us';
}

export function parseDataRegion(value: unknown, fallback: DataRegion = 'us'): DataRegion {
  return isDataRegion(value) ? value : fallback;
}

function envBinding(region: DataRegion): RegionBinding {
  if (region === 'eu') {
    return {
      region: 'eu',
      firebaseProjectId:
        process.env.FIREBASE_PROJECT_ID_EU ||
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        'guardentra-eu-pending',
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET_EU ||
        process.env.FIREBASE_STORAGE_BUCKET ||
        'guardentra-eu-pending.appspot.com',
    };
  }
  return {
    region: 'us',
    firebaseProjectId:
      process.env.FIREBASE_PROJECT_ID_US ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      'guardentra-7f582',
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET_US ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      'guardentra-7f582.appspot.com',
  };
}

/** Resolve binding from trusted org.dataRegion only. */
export function resolveRegionBinding(trustedOrgDataRegion: unknown): RegionBinding {
  const region = parseDataRegion(trustedOrgDataRegion, 'us');
  return envBinding(region);
}

/**
 * Isolation check: a request scoped to region A must not receive region B's project.
 */
export function assertRegionIsolation(
  trustedOrgDataRegion: unknown,
  requestedRegion: unknown
): { ok: true; binding: RegionBinding } | { ok: false; error: string } {
  if (!isDataRegion(requestedRegion)) {
    return { ok: false, error: 'requested region invalid' };
  }
  const binding = resolveRegionBinding(trustedOrgDataRegion);
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

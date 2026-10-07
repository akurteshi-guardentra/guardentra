export interface GuardEntraReleaseIdentity {
  environment: string;
  projectId: string | null;
  service: string | null;
  revision: string | null;
  sourceSha: string | null;
}

function safeValue(value: string | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function buildReleaseIdentity(
  env: NodeJS.ProcessEnv = process.env,
): GuardEntraReleaseIdentity {
  return {
    environment:
      safeValue(env.APP_ENV) ||
      safeValue(env.NODE_ENV) ||
      'development',
    projectId:
      safeValue(env.GOOGLE_CLOUD_PROJECT) ||
      safeValue(env.GCLOUD_PROJECT) ||
      safeValue(env.FIREBASE_PROJECT_ID) ||
      null,
    service: safeValue(env.K_SERVICE),
    revision: safeValue(env.K_REVISION),
    sourceSha: safeValue(env.GUARDENTRA_SOURCE_SHA),
  };
}

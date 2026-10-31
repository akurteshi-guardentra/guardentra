import { readFileSync } from 'fs';

/** Read the git SHA written by the build step (dist/.commit-sha), if present. */
function readCommitShaFile(): string | null {
  try {
    const sha = readFileSync('./dist/.commit-sha', 'utf8').trim();
    return sha || null;
  } catch {
    return null;
  }
}

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
    sourceSha: safeValue(env.GUARDENTRA_SOURCE_SHA) || readCommitShaFile(),
  };
}

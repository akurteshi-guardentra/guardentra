import { auth } from '../firebase';

/**
 * Shape shared by every /api/* header provider (this default-app one and the
 * portal-app one in `lib/vendor/portalAuth.ts`). Keeping one shared type is what
 * lets callers like `auditClient.ts` accept either provider interchangeably
 * without ever mixing which Firebase app's token backs a given request
 * (GitHub #63 — vendor-portal audit calls were reading the default app's
 * `auth.currentUser` instead of the portal app's).
 */
export type AuthHeaderProvider = (
  extra?: Record<string, string>
) => Promise<Record<string, string>>;

/** Authorization header for /api/* when the org/admin user is signed in on the default Firebase app. */
export async function authHeaders(
  extra: Record<string, string> = {},
  opts?: { organizationId?: string | null }
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      /* proceed without token — server allows unauth only in non-prod */
    }
  }
  const orgId = opts?.organizationId?.trim();
  if (orgId) headers['X-Org-Id'] = orgId;
  return headers;
}

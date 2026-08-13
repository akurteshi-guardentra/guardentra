import { auth } from '../firebase';

/** Authorization header for /api/* when the user is signed in. */
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

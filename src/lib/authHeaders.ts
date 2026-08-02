import { auth } from '../firebase';

/** Authorization header for /api/ai when the user is signed in. */
export async function authHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
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
  return headers;
}

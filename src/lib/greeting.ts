/**
 * Dashboard greeting (#124 journey finding 2): a first session must not say "Welcome back".
 * Firebase sets creationTime and lastSignInTime to the same instant on the first sign-in;
 * a later sign-in moves lastSignInTime forward.
 */
export type SignInMetadata = { creationTime?: string | null; lastSignInTime?: string | null };

/** Sign-ins within this window of account creation still count as the first session. */
const FIRST_SESSION_WINDOW_MS = 5 * 60 * 1000;

export function isReturningUser(metadata?: SignInMetadata | null): boolean {
  const created = Date.parse(metadata?.creationTime || '');
  const lastSignIn = Date.parse(metadata?.lastSignInTime || '');
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return lastSignIn - created > FIRST_SESSION_WINDOW_MS;
}

export function dashboardGreeting(firstName: string, metadata?: SignInMetadata | null): string {
  return `${isReturningUser(metadata) ? 'Welcome back' : 'Welcome'}, ${firstName}`;
}

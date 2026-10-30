/**
 * Issue #67: Dashboard access requires durable tenant bootstrap (#61),
 * not completion of the old three-step onboarding wizard.
 *
 * Bootstrapped = cloud (or local-dev) profile carries a bound organizationId.
 * organizationId / role / membership remain server-authoritative via orgBootstrap.
 */

export function isProfileBootstrapped(
  profile: { organizationId?: string | null } | null | undefined,
): boolean {
  const orgId = typeof profile?.organizationId === 'string' ? profile.organizationId.trim() : '';
  return orgId.length > 0;
}

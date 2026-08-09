/**
 * SaaS plan catalog (server). Keep caps aligned with src/lib/plans.ts.
 * @see docs/ARCHITECTURE_FOUNDATION.md §4
 */

export type PlanId = 'starter' | 'growth' | 'gov';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  vendorCap: number;
  seatCap: number;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: { id: 'starter', name: 'Starter', vendorCap: 25, seatCap: 3 },
  growth: { id: 'growth', name: 'Growth', vendorCap: 150, seatCap: 10 },
  gov: { id: 'gov', name: 'Gov', vendorCap: 10_000, seatCap: 100 },
};

export const DEFAULT_PLAN_ID: PlanId = 'starter';

export function isPlanId(value: unknown): value is PlanId {
  return value === 'starter' || value === 'growth' || value === 'gov';
}

export function getPlan(planId: unknown): PlanDefinition {
  return isPlanId(planId) ? PLANS[planId] : PLANS[DEFAULT_PLAN_ID];
}

export function planCaps(planId: unknown): { vendorCap: number; seatCap: number; planId: PlanId } {
  const plan = getPlan(planId);
  return { planId: plan.id, vendorCap: plan.vendorCap, seatCap: plan.seatCap };
}

/** Env-backed Stripe price → plan map (server secrets / App Hosting env). */
export function buildServerStripePriceMap(
  env: NodeJS.ProcessEnv = process.env
): Partial<Record<string, PlanId>> {
  const map: Partial<Record<string, PlanId>> = {};
  const pairs: [string | undefined, PlanId][] = [
    [env.STRIPE_PRICE_STARTER_MONTHLY || env.VITE_STRIPE_PRICE_STARTER_MONTHLY, 'starter'],
    [env.STRIPE_PRICE_STARTER_ANNUAL || env.VITE_STRIPE_PRICE_STARTER_ANNUAL, 'starter'],
    [env.STRIPE_PRICE_GROWTH_MONTHLY || env.VITE_STRIPE_PRICE_GROWTH_MONTHLY, 'growth'],
    [env.STRIPE_PRICE_GROWTH_ANNUAL || env.VITE_STRIPE_PRICE_GROWTH_ANNUAL, 'growth'],
  ];
  for (const [priceId, planId] of pairs) {
    if (priceId) map[priceId] = planId;
  }
  return map;
}

export function resolvePlanIdFromPriceId(
  priceId: string | null | undefined,
  priceMap: Partial<Record<string, PlanId>> = buildServerStripePriceMap()
): PlanId | null {
  if (!priceId) return null;
  return priceMap[priceId] || null;
}

/**
 * SaaS plan catalog — single source for Starter / Growth / Gov caps and labels.
 * Keep in sync with server/lib/plans.ts (Stripe webhook applies the same caps).
 * @see docs/ARCHITECTURE_FOUNDATION.md §4
 */

export type PlanId = 'starter' | 'growth' | 'gov';

export type PlanDefinition = {
  id: PlanId;
  name: string;
  vendorCap: number;
  seatCap: number;
  description: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    vendorCap: 25,
    seatCap: 3,
    description: 'The vendor TPRM spine for teams getting off spreadsheets.',
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    vendorCap: 150,
    seatCap: 10,
    description: 'More vendors, more frameworks, more seats.',
  },
  gov: {
    id: 'gov',
    name: 'Gov',
    vendorCap: 10_000,
    seatCap: 100,
    description: 'Higher volume, SSO/SAML, dedicated staging, BAA/DPA process.',
  },
};

export const DEFAULT_PLAN_ID: PlanId = 'starter';
export const DEFAULT_VENDOR_CAP = PLANS.starter.vendorCap;
export const DEFAULT_SEAT_CAP = PLANS.starter.seatCap;

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

/** Map a Stripe Price ID (from env-backed catalog) to a plan. */
export function resolvePlanIdFromPriceId(
  priceId: string | null | undefined,
  priceMap: Partial<Record<string, PlanId>>
): PlanId | null {
  if (!priceId) return null;
  return priceMap[priceId] || null;
}

export function buildViteStripePriceMap(): Partial<Record<string, PlanId>> {
  const map: Partial<Record<string, PlanId>> = {};
  const pairs: [string | undefined, PlanId][] = [
    [import.meta.env.VITE_STRIPE_PRICE_STARTER_MONTHLY, 'starter'],
    [import.meta.env.VITE_STRIPE_PRICE_STARTER_ANNUAL, 'starter'],
    [import.meta.env.VITE_STRIPE_PRICE_GROWTH_MONTHLY, 'growth'],
    [import.meta.env.VITE_STRIPE_PRICE_GROWTH_ANNUAL, 'growth'],
  ];
  for (const [priceId, planId] of pairs) {
    if (priceId) map[priceId] = planId;
  }
  return map;
}

import { describe, expect, it } from 'vitest';
import {
  catalogPlanIdForCheckoutPrice,
  planIdForCompletedCheckout,
} from '../../server/lib/plans';

const catalog = {
  price_starter_m: 'starter' as const,
  price_growth_m: 'growth' as const,
};

describe('#144 checkout catalog price', () => {
  it('returns the catalog plan for an exact price id', () => {
    expect(catalogPlanIdForCheckoutPrice('price_growth_m', catalog)).toBe('growth');
    expect(catalogPlanIdForCheckoutPrice('price_starter_m', catalog)).toBe('starter');
  });

  it('does not fall back to Starter for an unmapped, blank, or non-string price', () => {
    expect(catalogPlanIdForCheckoutPrice('price_free_test', catalog)).toBeNull();
    expect(catalogPlanIdForCheckoutPrice(' price_starter_m', catalog)).toBeNull();
    expect(catalogPlanIdForCheckoutPrice('', catalog)).toBeNull();
    expect(catalogPlanIdForCheckoutPrice(null, catalog)).toBeNull();
    expect(catalogPlanIdForCheckoutPrice(25, catalog)).toBeNull();
  });

  it('activates a completed checkout from the subscription price, not session metadata', () => {
    expect(planIdForCompletedCheckout('price_growth_m', catalog)).toBe('growth');
    expect(planIdForCompletedCheckout('price_not_in_catalog', catalog)).toBeNull();
    expect(planIdForCompletedCheckout(null, catalog)).toBeNull();
    expect(planIdForCompletedCheckout(undefined, catalog)).toBeNull();
  });
});

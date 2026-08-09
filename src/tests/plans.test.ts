import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_ID,
  DEFAULT_SEAT_CAP,
  DEFAULT_VENDOR_CAP,
  getPlan,
  planCaps,
  PLANS,
  resolvePlanIdFromPriceId,
} from '../lib/plans';

describe('plans catalog', () => {
  it('Starter defaults match ARCHITECTURE_FOUNDATION sketch', () => {
    expect(DEFAULT_PLAN_ID).toBe('starter');
    expect(DEFAULT_VENDOR_CAP).toBe(25);
    expect(DEFAULT_SEAT_CAP).toBe(3);
    expect(PLANS.growth.vendorCap).toBe(150);
    expect(PLANS.growth.seatCap).toBe(10);
  });

  it('getPlan falls back to Starter for unknown ids', () => {
    expect(getPlan('nope').id).toBe('starter');
    expect(planCaps('growth')).toEqual({
      planId: 'growth',
      vendorCap: 150,
      seatCap: 10,
    });
  });

  it('resolvePlanIdFromPriceId maps configured price ids', () => {
    const map = {
      price_starter_m: 'starter' as const,
      price_growth_a: 'growth' as const,
    };
    expect(resolvePlanIdFromPriceId('price_growth_a', map)).toBe('growth');
    expect(resolvePlanIdFromPriceId('price_unknown', map)).toBeNull();
  });
});

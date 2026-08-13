import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../lib/AuthContext';
import { db } from '../firebase';
import { DEFAULT_SEAT_CAP, DEFAULT_VENDOR_CAP, getPlan } from '../lib/plans';

type OrgPlanSnap = {
  planId?: string;
  vendorCount?: number;
  vendorCap?: number;
  seatCount?: number;
  seatCap?: number;
  subscriptionStatus?: string;
};

/**
 * SaaS plan meter for the customer org — vendors/seats used vs cap + upgrade path.
 */
export function PlanUsageCard() {
  const { profile } = useAuth();
  const orgId = profile?.organizationId;
  const [org, setOrg] = useState<OrgPlanSnap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getDoc(doc(db, 'organizations', orgId)).then((snap) => {
      if (cancelled) return;
      setOrg((snap.data() as OrgPlanSnap) || {});
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const plan = getPlan(org?.planId);
  const vendorCount = typeof org?.vendorCount === 'number' ? org.vendorCount : 0;
  const vendorCap = typeof org?.vendorCap === 'number' ? org.vendorCap : DEFAULT_VENDOR_CAP;
  const seatCount = typeof org?.seatCount === 'number' ? org.seatCount : 1;
  const seatCap = typeof org?.seatCap === 'number' ? org.seatCap : DEFAULT_SEAT_CAP;
  const vendorsNear = vendorCount >= Math.max(1, vendorCap - 2);
  const seatsNear = seatCount >= seatCap;
  const atVendorCap = vendorCount >= vendorCap;

  return (
    <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl">
      <CardHeader className="border-b border-white/5">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5 text-primary" />
          Subscription plan
        </CardTitle>
        <CardDescription>
          Your company manages vendors under this plan. Caps apply when adding vendors or inviting
          seats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading plan…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Current plan</p>
                <p className="mt-1 text-xl font-semibold text-white">{plan.name}</p>
              </div>
              {org?.subscriptionStatus && org.subscriptionStatus !== 'none' ? (
                <span className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {org.subscriptionStatus}
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Meter
                label="Vendors"
                used={vendorCount}
                cap={vendorCap}
                warn={vendorsNear}
              />
              <Meter label="Seats" used={seatCount} cap={seatCap} warn={seatsNear} />
            </div>
            {atVendorCap || seatsNear ? (
              <p className="text-xs text-amber-200/90">
                {atVendorCap
                  ? 'Vendor limit reached. Upgrade to add more third parties.'
                  : 'Seat limit reached. Upgrade or remove a member before inviting.'}
              </p>
            ) : null}
            <Link
              to="/pricing"
              className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-transparent px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              {atVendorCap || seatsNear ? 'Upgrade plan' : 'View plans'}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Meter({
  label,
  used,
  cap,
  warn,
}: {
  label: string;
  used: number;
  cap: number;
  warn: boolean;
}) {
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="mb-2 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className={warn ? 'text-amber-300' : 'text-slate-300'}>
          {used} / {cap}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full transition-all ${warn ? 'bg-amber-400' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

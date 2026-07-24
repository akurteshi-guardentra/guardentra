import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { featureLabelForPath } from '../lib/featureFlags';

/** Shown when a frozen (flagged-off) route is opened directly. */
export function ComingLater() {
  const location = useLocation();
  const label = featureLabelForPath(location.pathname);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center space-y-4 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <Lock className="h-6 w-6 text-amber-300" />
      </div>
      <h1 className="font-display text-2xl font-bold text-white">Coming later</h1>
      <p className="text-sm text-slate-400">
        <span className="font-mono text-slate-300">{label}</span> is frozen while we finish the Vendor
        TPRM spine (directory → assessment wizard → portal). It will return behind a feature flag.
      </p>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link
          to="/vendors"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
        >
          Back to Vendors
        </Link>
        <Link
          to="/assessments"
          className="inline-flex h-9 items-center rounded-md border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5"
        >
          Assessments
        </Link>
      </div>
    </div>
  );
}

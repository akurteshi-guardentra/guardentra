import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { isProfileBootstrapped } from '../lib/bootstrapGate';
import { Loader2 } from 'lucide-react';

/**
 * Legacy /onboarding route (Issue #67).
 *
 * The blocking three-step wizard and production "Load sample demo data" entry
 * are removed from the critical path. Secure tenant + membership bootstrap
 * remains in AuthContext / orgBootstrap (#61). Progressive setup lives on
 * Dashboard.
 *
 * Bookmarks to /onboarding redirect to Dashboard once bootstrapped.
 */
export function Onboarding() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-label="Loading" />
      </div>
    );
  }

  if (!isProfileBootstrapped(profile)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-label="Loading" />
      </div>
    );
  }

  return <Navigate to="/dashboard" replace />;
}

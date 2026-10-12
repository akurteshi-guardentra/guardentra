import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../lib/AuthContext';
import { logOut } from '../lib/firebase-utils';

/**
 * Recoverable UI when a cloud profile exists but lacks organizationId (#61/#67).
 * Never invents local_org_*, never grants Dashboard access, never loops onboarding.
 */
export function BootstrapRecoveryPanel() {
  const { retryProfileLoad, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div
        role="alert"
        data-testid="bootstrap-recovery-panel"
        className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-slate-100 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-3">
            <h1 className="text-lg font-semibold tracking-tight">Workspace not ready</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your account is signed in, but no organization membership is bound yet. GuardEntra will
              not open the product until secure tenant bootstrap completes. Retry after an invite is
              accepted, or sign out and try again.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                data-testid="bootstrap-recovery-retry"
                onClick={() => retryProfileLoad()}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Retrying…
                  </>
                ) : (
                  'Retry'
                )}
              </Button>
              <Button
                type="button"
                data-testid="bootstrap-recovery-sign-out"
                variant="outline"
                onClick={() => {
                  void logOut('/login');
                }}
                className="border-slate-600 text-slate-200"
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

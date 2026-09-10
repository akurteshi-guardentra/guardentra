import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../lib/AuthContext';
import { logOut } from '../lib/firebase-utils';

/**
 * Recoverable hosted profile failure UI.
 * Shown only when cloud users/{uid} could not be loaded after bounded retries.
 * Never invents onboarded=false / local_org_* / onboarding redirects.
 */
export function ProfileLoadErrorPanel() {
  const { profileError, retryProfileLoad, loading } = useAuth();

  if (!profileError) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div
        role="alert"
        className="max-w-md w-full rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-slate-100 shadow-lg"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-3">
            <h1 className="text-lg font-semibold tracking-tight">Profile could not be loaded</h1>
            <p className="text-sm text-slate-300 leading-relaxed">{profileError}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
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

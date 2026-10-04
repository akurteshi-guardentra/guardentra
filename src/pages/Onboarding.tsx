import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { db } from '../firebase';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logOut } from '../lib/firebase-utils';
import { clearLocallyOnboarded } from '../lib/onboardingFlag';
import { clearOnboardingAck, hasOnboardingAck } from '../lib/onboardingAck';

/**
 * #67 progressive onboarding.
 *
 * Secure tenant + membership bootstrap remains authoritative in orgBootstrap.
 * This route is only a bounded migration/retry bridge for older profiles that
 * still have onboarded=false. It never writes organization configuration,
 * framework defaults, or sample/demo data.
 */
export function Onboarding() {
  const { profile, user, loading, acknowledgeDurableOnboarding } = useAuth();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const automaticAttemptKey = useRef<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishBootstrap = useCallback(async (manualRetry = false) => {
    if (inFlight.current || !user || !profile) return;

    if (profile.onboarded || hasOnboardingAck(user.uid)) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!profile.organizationId) {
      setError('Your secure organization bootstrap is incomplete. Retry after your profile finishes loading.');
      return;
    }

    const attemptKey = `${user.uid}:${profile.organizationId}`;
    if (!manualRetry && automaticAttemptKey.current === attemptKey) return;
    if (!manualRetry) automaticAttemptKey.current = attemptKey;

    inFlight.current = true;
    setFinishing(true);
    setError(null);
    clearLocallyOnboarded(user.uid);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        onboarded: true,
        updatedAt: new Date().toISOString(),
      });

      acknowledgeDurableOnboarding();
      localStorage.setItem('guardentra_fallback_org_id', profile.organizationId);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      clearLocallyOnboarded(user.uid);
      clearOnboardingAck(user.uid);
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not finish secure workspace bootstrap.';
      setError(`${message} Nothing was marked complete; retry is safe.`);
    } finally {
      inFlight.current = false;
      setFinishing(false);
    }
  }, [acknowledgeDurableOnboarding, navigate, profile, user]);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.onboarded || hasOnboardingAck(user.uid)) {
      navigate('/dashboard', { replace: true });
      return;
    }
    void finishBootstrap();
  }, [finishBootstrap, loading, navigate, profile, user]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <Card className="w-full max-w-xl border-white/10 bg-slate-900/60">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-white">Your GuardEntra workspace is ready</CardTitle>
          <CardDescription>
            Secure tenant setup is complete. We are taking you to the dashboard so you can add your first
            real vendor. Organization profile and assessment-pack defaults can be completed later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!error ? (
            <div className="flex items-center justify-center rounded-xl border border-white/10 bg-black/20 p-5 text-sm text-slate-300">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {finishing ? 'Finalizing your profile…' : 'Preparing dashboard…'}
            </div>
          ) : (
            <div className="space-y-3">
              <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
                {error}
              </p>
              <Button type="button" className="w-full" onClick={() => void finishBootstrap(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry secure setup
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full text-slate-500 hover:text-white"
            onClick={() => void logOut('/')}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

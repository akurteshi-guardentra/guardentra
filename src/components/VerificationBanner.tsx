import React from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import {
  resendVerificationEmail,
  type VerificationResendResult,
} from '../lib/firebase-utils';

export const VERIFICATION_RESEND_COOLDOWN_MS = 30_000;
export const VERIFICATION_RESEND_ERROR_COOLDOWN_MS = 5_000;

const REQUESTED_NOTICE = 'Verification email requested. Delivery is not confirmed.';
const STILL_UNVERIFIED_NOTICE = 'Email is still unverified.';

export function verificationFailureMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment, then try again.';
  if (code === 'auth/network-request-failed') return 'Network problem. Check your connection and try again.';
  return 'Could not request a verification email. Try again.';
}

function resultMessage(result: VerificationResendResult): string | null {
  if (result.status === 'sent') return REQUESTED_NOTICE;
  if (result.status === 'no-user') return 'Sign in again before requesting another verification email.';
  if (result.status === 'anonymous') return 'This session has no email address to verify.';
  if (result.status === 'session-changed') return 'That request ended because the signed-in account changed.';
  return null;
}

/**
 * Unverified-email banner. Resend and recheck share one in-flight guard.
 * Completions from an older account, sign-out, or unmount are ignored.
 */
export function VerificationBanner() {
  const { user, refreshVerification, verificationRefreshError } = useAuth();
  const uid = user && !user.isAnonymous && user.email ? user.uid : null;
  const [phase, setPhase] = React.useState<'idle' | 'sending' | 'cooldown'>('idle');
  const [notice, setNotice] = React.useState<string | null>(null);
  const [tone, setTone] = React.useState<'info' | 'error' | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [boundUid, setBoundUid] = React.useState(uid);
  const phaseRef = React.useRef(phase);
  const epoch = React.useRef(0);
  const busy = React.useRef(false);
  const mounted = React.useRef(true);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  phaseRef.current = phase;

  if (uid !== boundUid) {
    setBoundUid(uid);
    setPhase('idle');
    setNotice(null);
    setTone(null);
    setDismissed(false);
    epoch.current += 1;
    busy.current = false;
    phaseRef.current = 'idle';
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current += 1;
      busy.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = !!user && !user.isAnonymous && !!user.email && !user.emailVerified && !dismissed;

  const armCooldown = (ticket: number, delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!mounted.current || ticket !== epoch.current) return;
      phaseRef.current = 'idle';
      setPhase('idle');
    }, delay);
  };

  const stillCurrent = (ticket: number) => mounted.current && ticket === epoch.current;

  const onResend = () => {
    if (busy.current || phaseRef.current === 'sending' || phaseRef.current === 'cooldown') return;
    busy.current = true;
    const ticket = epoch.current;
    phaseRef.current = 'sending';
    setPhase('sending');
    setNotice(null);
    setTone(null);
    void (async () => {
      try {
        const result = await resendVerificationEmail();
        if (!stillCurrent(ticket)) return;
        if (result.status === 'sent') {
          phaseRef.current = 'cooldown';
          setPhase('cooldown');
          setTone('info');
          setNotice(REQUESTED_NOTICE);
          armCooldown(ticket, VERIFICATION_RESEND_COOLDOWN_MS);
          return;
        }
        if (result.status === 'already-verified') {
          phaseRef.current = 'idle';
          setPhase('idle');
          await refreshVerification();
          return;
        }
        const message = resultMessage(result);
        phaseRef.current = 'cooldown';
        setPhase('cooldown');
        setTone('error');
        setNotice(message);
        armCooldown(ticket, VERIFICATION_RESEND_ERROR_COOLDOWN_MS);
      } catch (error) {
        if (!stillCurrent(ticket)) return;
        phaseRef.current = 'cooldown';
        setPhase('cooldown');
        setTone('error');
        setNotice(verificationFailureMessage(error));
        armCooldown(ticket, VERIFICATION_RESEND_ERROR_COOLDOWN_MS);
      } finally {
        if (ticket === epoch.current) busy.current = false;
      }
    })();
  };

  const onRecheck = (quiet: boolean) => {
    if (busy.current || phaseRef.current === 'sending') return;
    busy.current = true;
    const ticket = epoch.current;
    void (async () => {
      try {
        const result = await refreshVerification();
        if (!stillCurrent(ticket)) return;
        if (!quiet && result === 'unverified') {
          setTone('info');
          setNotice(STILL_UNVERIFIED_NOTICE);
        }
        if (result === 'verified') {
          setNotice(null);
          setTone(null);
        }
      } finally {
        if (ticket === epoch.current) busy.current = false;
      }
    })();
  };

  const recheckRef = React.useRef(onRecheck);
  recheckRef.current = onRecheck;
  React.useEffect(() => {
    if (!show) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      recheckRef.current(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [show]);

  if (!show) return null;

  const alertText = tone === 'error' ? notice : verificationRefreshError;
  const statusText =
    phase === 'sending'
      ? 'Requesting a verification email…'
      : notice && tone !== 'error'
        ? notice
        : 'Please verify your email address to secure your account.';
  const resendDisabled = phase === 'sending' || phase === 'cooldown';

  return (
    <div
      className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
      data-testid="verification-banner"
    >
      <div>
        <p role="status">{statusText}</p>
        {alertText && (
          <p role="alert" className="mt-1 text-amber-200">
            {alertText}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid="resend-verification"
          onClick={onResend}
          disabled={resendDisabled}
          className="font-medium underline underline-offset-2 hover:text-amber-200 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
        >
          Resend email
        </button>
        <button
          type="button"
          data-testid="recheck-verification"
          onClick={() => onRecheck(false)}
          disabled={phase === 'sending'}
          className="font-medium underline underline-offset-2 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Check verification
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-400/70 hover:text-amber-300"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

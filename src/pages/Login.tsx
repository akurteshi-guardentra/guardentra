import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } from '../lib/firebase-utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Shield, Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { isLocallyOnboarded } from '../lib/onboardingFlag';

export function Login() {
  const { user, profile, loading: authLoading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const isInIframe = window.self !== window.top;

  // Wait until auth + profile are resolved. A signed-in user with profile still
  // null must not be sent to /onboarding (that flash hit already-onboarded accounts).
  if (authLoading || (user && !profile && !isLocallyOnboarded(user.uid))) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (user) {
    const done = profile?.onboarded || isLocallyOnboarded(user.uid);
    return <Navigate to={done ? '/dashboard' : '/onboarding'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResetMessage('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Password is required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (isSignUp && !name.trim()) {
      setError('Full name is required for registration');
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email.trim(), password, name.trim());
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      console.error('Auth Error:', err);
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Sign in instead, or use Forgot password.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (code === 'auth/operation-not-allowed') {
        setError(
          'Email/password sign-in is not enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method.'
        );
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Check your connection and try again.');
      } else {
        setError(err?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      if (err.message?.includes('popup') || err.code?.includes('popup')) {
        setError('Login popup blocked. Please allow popups for this site, or open the app in a new tab.');
      } else {
        setError(err?.message || 'Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setResetMessage('');
    if (!email.trim()) {
      setError('Enter your email above first, then click "Forgot password?"');
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setResetMessage('Password reset email sent — check your inbox.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setResetMessage('If an account exists for that email, a reset link has been sent.');
      } else {
        setError(err.message || 'Could not send reset email.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-panel p-8 rounded-2xl max-w-md w-full text-center relative z-10 border-indigo-500/30">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-500/20 rounded-2xl border border-indigo-500/30">
            <Shield className="h-12 w-12 text-indigo-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white font-display mb-2">Guardentra</h1>
        <p className="text-slate-400 mb-8">Enterprise Risk & Compliance Intelligence</p>

        {isInIframe && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs text-left flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-bold mb-1 uppercase tracking-wider">Browser Security Restriction</p>
              <p>
                Google Login may be blocked in this preview iframe. For the best experience, please open the app in a new
                tab using the external link icon (top-right corner) before signing in.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {resetMessage && (
          <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
            {resetMessage}
          </div>
        )}

        <form method="post" action="/login" onSubmit={handleSubmit} className="space-y-4 mb-6" autoComplete="on">
          {isSignUp && (
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 bg-black/20 border-white/10 text-white"
                required={isSignUp}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              type="email"
              name="username"
              autoComplete="username"
              inputMode="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 bg-black/20 border-white/10 text-white"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              type="password"
              name="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 bg-black/20 border-white/10 text-white"
              required
              minLength={6}
            />
          </div>
          {!isSignUp && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}
          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-900 text-slate-500">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-white text-black hover:bg-slate-200 h-11 text-base font-medium mb-6"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google
        </Button>

        <p className="text-slate-400 text-sm">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setResetMessage('');
            }}
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}

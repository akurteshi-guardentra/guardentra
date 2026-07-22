import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { RiskManagement } from './pages/RiskManagement';
import { Compliance } from './pages/Compliance';
import { Incidents } from './pages/Incidents';
import { Connectors } from './pages/Connectors';
import { Policies } from './pages/Policies';
import { VendorRisk } from './pages/VendorRisk';
import { Assessments } from './pages/Assessments';
import { VendorPortal } from './pages/VendorPortal';
import { AuditReadiness } from './pages/AuditReadiness';
import { SystemHealth } from './pages/SystemHealth';
import { ExecutiveReports } from './pages/ExecutiveReports';
import { PolicyDraftsman } from './pages/PolicyDraftsman';
import { AuditCalendar } from './pages/AuditCalendar';
import { Settings } from './pages/Settings';
import { Pricing } from './pages/Pricing';
import { Documentation } from './pages/Documentation';
import { LiveAssistant } from './pages/LiveAssistant';
import { Onboarding } from './pages/Onboarding';
import { IdentityAccess } from './pages/Devices';
import { TrustVault } from './pages/TrustVault';
import { ContractNegotiator } from './pages/ContractNegotiator';
import { Landing } from './pages/Landing';
import { GovIntelSuite } from './pages/GovIntelSuite';
import { TrustIntelligence } from './pages/TrustIntelligence';
import { GmailAudit } from './pages/GmailAudit';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { DemoProvider } from './lib/DemoContext';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from './lib/firebase-utils';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Shield, Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { cn } from './lib/utils';

// Connectivity Test (Mandatory constraint)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
  } catch (error: any) {
    if (error?.message?.includes('the client is offline') || error?.message?.includes('Missing or insufficient permissions')) {
      console.warn("Guardentra Connectivity: Firestore is restricted or offline. This is expected if the 'system' doc is not created yet.");
    }
  }
}
testConnection();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    console.log("ProtectedRoute: No user, redirecting to /login");
    return <Navigate to="/login" />;
  }

  // If user is authenticated but not onboarded, and not already on onboarding page
  if (profile && !profile.onboarded && localStorage.getItem('guardentra_onboarded') !== 'true' && window.location.pathname !== '/onboarding' && window.location.pathname !== '/login') {
    console.log("ProtectedRoute: User not onboarded, redirecting to /onboarding from", window.location.pathname);
    return <Navigate to="/onboarding" />;
  }

  console.log("ProtectedRoute: Access granted. Profile onboarded:", profile?.onboarded);

  return <>{children}</>;
};

const Login = () => {
  const { user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isInIframe = window.self !== window.top;

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!password) {
      setError("Password is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (isSignUp && !name.trim()) {
      setError("Full name is required for registration");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in your Firebase Console.');
      } else if (err.code === 'auth/network-request-failed' || err.message?.includes('popup-closed-by-user') === false) {
        setError('Action Required: If the login popup didn\'t appear, please open this app in a new tab using the external link icon (top right) to bypass iframe security restrictions.');
      } else {
        setError(`${err.message} (Code: ${err.code || 'unknown'})`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log("App: handleGoogleSignIn clicked");
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      console.log("App: handleGoogleSignIn success");
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.message?.includes('popup') || err.code?.includes('popup')) {
        setError('Login popup blocked. Please click the "External Link" icon in the top-right corner of the screen to open the app in a new tab.');
      } else {
        setError('Google Sign-In Error. Please ensure popups are allowed or try opening the app in a new tab to bypass iframe restrictions.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
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
              <p>Google Login may be blocked in this preview iframe. For the best experience, please open the app in a new tab using the external link icon (top-right corner) before signing in.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          {isSignUp && (
            <div className="relative">
              <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              <Input 
                type="text" 
                placeholder="Full Name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10 bg-black/20 border-white/10 text-white"
                required
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input 
              type="email" 
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
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 bg-black/20 border-white/10 text-white"
              required
              minLength={6}
            />
          </div>
          <Button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isSignUp ? 'Create Account' : 'Sign In')}
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
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </Button>

        <p className="text-slate-400 text-sm">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }} 
            className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            {isSignUp ? 'Sign In' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <DemoProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/portal/:assessmentId" element={<VendorPortal />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <Routes>
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/*" element={
                    <Layout>
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/gov-intel" element={<GovIntelSuite />} />
                        <Route path="/trust-intelligence" element={<TrustIntelligence />} />
                        <Route path="/risks" element={<RiskManagement />} />
                        <Route path="/compliance" element={<Compliance />} />
                        <Route path="/incidents" element={<Incidents />} />
                        <Route path="/devices" element={<IdentityAccess />} />
                        <Route path="/trust-vault" element={<TrustVault />} />
                        <Route path="/contract-negotiator" element={<ContractNegotiator />} />
                        <Route path="/connectors" element={<Connectors />} />
                        <Route path="/gmail-audit" element={<GmailAudit />} />
                        <Route path="/policies" element={<Policies />} />
                        <Route path="/policies/draftsman" element={<PolicyDraftsman />} />
                        <Route path="/vendors" element={<VendorRisk />} />
                        <Route path="/assessments" element={<Assessments />} />
                        <Route path="/audit-readiness" element={<AuditReadiness />} />
                        <Route path="/calendar" element={<AuditCalendar />} />
                        <Route path="/executive-reports" element={<ExecutiveReports />} />
                        <Route path="/health" element={<SystemHealth />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/docs" element={<Documentation />} />
                        <Route path="/ai-assistant" element={<LiveAssistant />} />
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      </Routes>
                    </Layout>
                  } />
                </Routes>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </DemoProvider>
    </AuthProvider>
  );
}

export default App;

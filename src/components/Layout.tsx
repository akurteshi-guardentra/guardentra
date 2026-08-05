import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Menu,
  X,
  Sparkles,
  LogOut,
  Globe,
  CreditCard,
  BookOpen,
  ClipboardCheck,
  ShieldCheck,
  Scale,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from './ui/button';
import { useAuth } from '../lib/AuthContext';
import { logOut, resendVerificationEmail } from '../lib/firebase-utils';
import { useTranslation } from 'react-i18next';
import { UserGuide } from './UserGuide';
import { BackButton } from './BackButton';
import { AICopilotPanel } from './AICopilotPanel';
import { FEATURES, isFeatureEnabled, type FeatureKey } from '../lib/featureFlags';

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  flag: FeatureKey;
};

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  // Primary nav destinations — Back is for nested flows (impact, triage, wizard), not these hubs.
  const PRIMARY_NAV_PATHS = new Set([
    '/dashboard',
    '/vendors',
    '/assessments',
    '/audit-readiness',
    '/docs',
    '/pricing',
    '/settings',
  ]);
  const pathNorm = location.pathname.replace(/\/+$/, '') || '/';
  const showBackButton = !PRIMARY_NAV_PATHS.has(pathNorm);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = React.useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
  const { user, profile } = useAuth();
  const { i18n } = useTranslation();
  const [verificationDismissed, setVerificationDismissed] = React.useState(false);
  const [verificationResent, setVerificationResent] = React.useState(false);
  const showVerificationBanner =
    !!user && !user.isAnonymous && !user.emailVerified && !verificationDismissed;

  const handleResendVerification = async () => {
    try {
      await resendVerificationEmail();
      setVerificationResent(true);
    } catch {
      /* resendVerificationEmail already logs the error */
    }
  };

  React.useEffect(() => {
    const hasSeenGuide = localStorage.getItem('guardentra_guide_seen');
    if (!hasSeenGuide) {
      const timer = setTimeout(() => setIsUserGuideOpen(true), 2000);
      localStorage.setItem('guardentra_guide_seen', 'true');
      return () => clearTimeout(timer);
    }
  }, []);

  const navGroups = [
    {
      label: 'Command',
      items: [{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, flag: 'dashboard' as FeatureKey }],
    },
    {
      label: 'Operations',
      items: [
        { name: 'Vendors', href: '/vendors', icon: ShieldCheck, flag: 'vendorSpine' as FeatureKey },
        { name: 'Assessments', href: '/assessments', icon: ClipboardCheck, flag: 'assessments' as FeatureKey },
      ],
    },
    {
      label: 'Assurance',
      items: [
        { name: 'Audit Lab', href: '/audit-readiness', icon: Scale, flag: 'auditReadiness' as FeatureKey },
      ],
    },
    {
      label: 'Platform',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen, flag: 'docs' as FeatureKey },
        { name: 'Pricing', href: '/pricing', icon: CreditCard, flag: 'pricing' as FeatureKey },
        { name: 'Settings', href: '/settings', icon: Settings, flag: 'settings' as FeatureKey },
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isFeatureEnabled(item.flag)),
    }))
    .filter((group) => group.items.length > 0);

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('en') ? 'de' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      <UserGuide isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />

      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-white/10 text-slate-300 glass-panel transition-transform duration-300 ease-in-out lg:static lg:block lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-white/5 px-6">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/50 border-glow bg-primary/20">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="ml-3 font-display text-xl font-bold tracking-tight text-white text-glow">
            Guardentra
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-slate-400 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-8 overflow-y-auto px-4 py-6">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <h3 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                {group.label}
              </h3>
              {group.items.map((item) => {
                const isActive =
                  location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'border border-primary/30 bg-primary/15 text-white shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 h-4 w-4 flex-shrink-0 transition-colors',
                        isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300'
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {(FEATURES.aiCopilot || FEATURES.voiceStudio) && (
          <div className="mt-auto space-y-2 border-t border-white/5 p-4">
            {FEATURES.aiCopilot && (
              <Button
                onClick={() => setIsCopilotOpen(true)}
                className="h-9 w-full cursor-pointer select-none justify-start border-none border-glow bg-indigo-600 text-xs text-white hover:bg-indigo-500"
              >
                <Sparkles className="mr-2 h-4 w-4 text-indigo-200" />
                AI Trust Copilot
              </Button>
            )}
            {FEATURES.voiceStudio && (
              <Link
                to="/ai-assistant"
                className="mt-1 block text-center text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300"
              >
                Open Voice Studio ➜
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-x-4 border-b border-white/5 bg-slate-900/60 px-4 shadow-lg sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="-m-2.5 p-2.5 text-slate-400 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </Button>
          <div className="flex flex-1 items-center justify-end gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsUserGuideOpen(true)}
                className="h-8 w-8 text-slate-400 transition-colors hover:text-primary"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-slate-400 hover:text-white"
              >
                <Globe className="h-4 w-4" />
                <span className="text-xs font-bold uppercase">{i18n.language.substring(0, 2)}</span>
              </Button>
              <div className="flex items-center gap-x-3">
                <div className="mr-2 hidden flex-col items-end sm:flex">
                  <span className="text-sm font-medium text-white">
                    {profile?.displayName || user?.displayName || 'Analyst'}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {profile?.role?.toUpperCase() || 'CISO'}
                  </span>
                </div>
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-blue-500 p-[1px]">
                  <img
                    className="h-full w-full rounded-full object-cover"
                    src={user?.photoURL || 'https://picsum.photos/seed/cyber/32/32'}
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button
                  onClick={logOut}
                  className="ml-2 p-2 text-slate-400 transition-colors hover:text-rose-400"
                  title="Log out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          {showVerificationBanner && (
            <div className="mx-auto max-w-7xl mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <span>
                {verificationResent
                  ? 'Verification email sent — check your inbox.'
                  : 'Please verify your email address to secure your account.'}
              </span>
              <div className="flex items-center gap-3">
                {!verificationResent && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="font-medium underline underline-offset-2 hover:text-amber-200"
                  >
                    Resend email
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVerificationDismissed(true)}
                  className="text-amber-400/70 hover:text-amber-300"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {showBackButton && <BackButton className="mb-2 sm:mb-4" />}
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {FEATURES.aiCopilot && (
        <AICopilotPanel isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
      )}
    </div>
  );
}

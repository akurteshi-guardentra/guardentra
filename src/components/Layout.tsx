import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, LayoutDashboard, AlertTriangle, FileCheck, AlertCircle, Settings, Menu, X, Sparkles, LogOut, Globe, CreditCard, Share2, FileText, Users, Scale, Activity, BarChart4, Zap, CalendarDays, HelpCircle, BookOpen, ClipboardCheck, ShieldCheck, Mail } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button } from './ui/button';
import { useAuth } from '../lib/AuthContext';
import { logOut } from '../lib/firebase-utils';
import { useTranslation } from 'react-i18next';
import { UserGuide } from './UserGuide';
import { BackButton } from './BackButton';
import { AICopilotPanel } from './AICopilotPanel';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = React.useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation();

  // Auto-trigger guide for new users
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
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Trust Intelligence', href: '/trust-intelligence', icon: ShieldCheck },
        { name: 'Agency Intelligence', href: '/gov-intel', icon: Sparkles },
        { name: 'Trust Vault', href: '/trust-vault', icon: Globe },
        { name: 'Executive Reports', href: '/executive-reports', icon: BarChart4 },
      ]
    },
    {
      label: 'Operations',
      items: [
        { name: 'Risks', href: '/risks', icon: AlertTriangle },
        { name: 'Incidents', href: '/incidents', icon: AlertCircle },
        { name: 'Identity Surface', href: '/devices', icon: Users },
        { name: 'Vendors', href: '/vendors', icon: ShieldCheck },
        { name: 'Assessments', href: '/assessments', icon: ClipboardCheck },
      ]
    },
    {
      label: 'Strategy',
      items: [
        { name: 'Compliance', href: '/compliance', icon: FileCheck },
        { name: 'Contract Audit', href: '/contract-negotiator', icon: Scale },
        { name: 'Policies', href: '/policies', icon: FileText },
        { name: 'Connectors', href: '/connectors', icon: Share2 },
        { name: 'Gmail Auditor', href: '/gmail-audit', icon: Mail },
      ]
    },
    {
      label: 'Assurance',
      items: [
        { name: 'Audit Lab', href: '/audit-readiness', icon: Scale },
        { name: 'Audit Calendar', href: '/calendar', icon: CalendarDays },
      ]
    },
    {
      label: 'Platform',
      items: [
        { name: 'Documentation', href: '/docs', icon: BookOpen },
        { name: 'Health & QA Lab', href: '/health', icon: Activity },
        { name: 'Pricing', href: '/pricing', icon: CreditCard },
      ]
    }
  ];

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('en') ? 'de' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-transparent flex">
      <UserGuide isOpen={isUserGuideOpen} onClose={() => setIsUserGuideOpen(false)} />
      
      {/* Mobile sidebar overlay */}
      <div className={cn("fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden", sidebarOpen ? "block" : "hidden")} onClick={() => setSidebarOpen(false)} />
      
      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 glass-panel border-r border-white/10 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block flex flex-col h-screen",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-white/5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 border border-primary/50 border-glow">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="ml-3 text-xl font-bold text-white tracking-tight font-display text-glow">Guardentra</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] px-3 mb-2">{group.label}</h3>
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-primary/15 text-white border border-primary/30 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 mt-auto space-y-2 border-t border-white/5">
          <Button 
            onClick={() => setIsCopilotOpen(true)}
            className="w-full justify-start bg-indigo-600 hover:bg-indigo-500 text-white border-none border-glow h-9 text-xs cursor-pointer select-none"
          >
            <Sparkles className="mr-2 h-4 w-4 text-indigo-200" />
            AI Trust Copilot
          </Button>
          <Link to="/ai-assistant" className="block text-center text-[10px] text-indigo-400 hover:text-indigo-300 font-bold tracking-widest uppercase mt-1">
            Open Voice Studio ➜
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <header className="flex h-16 shrink-0 items-center gap-x-4 border-b border-white/5 bg-slate-900/60 shadow-lg px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="-m-2.5 p-2.5 text-slate-400 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </Button>
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsUserGuideOpen(true)}
                className="text-slate-400 hover:text-primary transition-colors h-8 w-8"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleLanguage} className="text-slate-400 hover:text-white flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="uppercase text-xs font-bold">{i18n.language.substring(0, 2)}</span>
              </Button>
              <div className="flex items-center gap-x-3">
                <div className="flex flex-col items-end hidden sm:flex mr-2">
                  <span className="text-sm font-medium text-white">{profile?.displayName || user?.displayName || 'Analyst'}</span>
                  <span className="text-xs text-slate-400 font-mono">{profile?.role?.toUpperCase() || 'CISO'}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-blue-500 p-[1px]">
                  <img
                    className="h-full w-full rounded-full object-cover"
                    src={user?.photoURL || "https://picsum.photos/seed/cyber/32/32"}
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <button onClick={logOut} className="ml-2 p-2 text-slate-400 hover:text-rose-400 transition-colors" title="Log out">
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          {!isDashboard && <BackButton className="mb-2 sm:mb-4" />}
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Persistent Guardentra Trust Copilot panel */}
      <AICopilotPanel isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  );
}

